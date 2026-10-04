import type { Application, NextFunction, Request, Response } from 'express';

const COOKIE_NAME = 'finfly_demo_user';

type DemoUser = {
  password: string;
  label: string;
  description: string;
  defaultPath: string;
};

const demoUsers: Record<string, DemoUser> = {
  pilot: {
    password: 'pilot',
    label: 'Pilot',
    description: 'Create and maintain flight reports',
    defaultPath: '/finfly.flightreports/index.html',
  },
  auditor: {
    password: 'auditor',
    label: 'Auditor',
    description: 'Review reports and expenses',
    defaultPath: '/finfly.audit/index.html',
  },
  admin: {
    password: 'admin',
    label: 'Administrator',
    description: 'Manage users, aircraft, reports, and audits',
    defaultPath: '/finfly.admin/index.html',
  },
  otherpilot: {
    password: 'otherpilot',
    label: 'Other-organization pilot',
    description: 'Verify organization data isolation',
    defaultPath: '/finfly.flightreports/index.html',
  },
};

function cookiesFrom(req: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const item of (req.headers.cookie ?? '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function safeReturnPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

function freshAppPath(path: string, userID: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}finfly-user=${encodeURIComponent(userID)}&v=${Date.now()}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loginPage(currentUser?: string, returnTo?: string): string {
  const cards = Object.entries(demoUsers)
    .map(([id, user]) => {
      const active = id === currentUser ? ' active' : '';
      const current = id === currentUser ? '<span>Current user</span>' : '';
      const returnParameter = returnTo
        ? `&amp;returnTo=${encodeURIComponent(returnTo)}`
        : '';
      return `<a class="user${active}" href="/dev/login?user=${encodeURIComponent(id)}${returnParameter}">
        <strong>${escapeHtml(user.label)}</strong>${current}
        <small>${escapeHtml(user.description)}</small>
        <code>${escapeHtml(id)} / ${escapeHtml(user.password)}</code>
      </a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FinFly Demo Login</title>
  <style>
    :root { color-scheme: light; font-family: "72", Arial, sans-serif; }
    body { margin: 0; background: #f5f6f7; color: #1d2d3e; }
    main { width: min(720px, calc(100% - 32px)); margin: 64px auto; }
    h1 { margin-bottom: 8px; font-size: 2rem; }
    p { margin-top: 0; color: #556b82; }
    .users { display: grid; gap: 12px; margin-top: 28px; }
    .user { position: relative; display: grid; gap: 6px; padding: 18px 20px;
      border: 1px solid #d5dadd; border-radius: 10px; background: white;
      color: inherit; text-decoration: none; box-shadow: 0 1px 2px #0000000d; }
    .user:hover { border-color: #0070f2; box-shadow: 0 2px 8px #0000001a; }
    .user.active { border-color: #188918; }
    .user span { position: absolute; top: 16px; right: 18px; color: #188918;
      font-size: .8rem; font-weight: 700; }
    .user small { color: #556b82; }
    code { width: fit-content; padding: 3px 6px; border-radius: 4px; background: #eef1f3; }
    footer { margin-top: 24px; color: #6a7d8f; font-size: .85rem; }
  </style>
</head>
<body>
  <main>
    <h1>FinFly demo login</h1>
    <p>Select a local demo identity. You can return to <strong>/dev/login</strong> at any time to switch users.</p>
    <div class="users">${cards}</div>
    <footer>This development helper is registered only by <code>npm start</code>.</footer>
  </main>
</body>
</html>`;
}

/** Adds a retryable, cookie-based user selector in front of CAP mocked auth. */
export function registerDevelopmentLogin(app: Application): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/finfly.') || req.path.startsWith('/dev/')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  });

  app.get('/dev/login', (req: Request, res: Response) => {
    const requestedUser =
      typeof req.query.user === 'string' ? req.query.user : undefined;
    const selectedUser = requestedUser ? demoUsers[requestedUser] : undefined;

    if (requestedUser && selectedUser) {
      res.cookie(COOKIE_NAME, requestedUser, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      const returnPath = safeReturnPath(
        req.query.returnTo,
        selectedUser.defaultPath,
      );
      return res.redirect(freshAppPath(returnPath, requestedUser));
    }

    const currentUser = cookiesFrom(req)[COOKIE_NAME];
    const returnTo =
      typeof req.query.returnTo === 'string'
        ? safeReturnPath(req.query.returnTo, '/')
        : undefined;
    return res.type('html').send(loginPage(currentUser, returnTo));
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const selectedUserID = cookiesFrom(req)[COOKIE_NAME];
    const selectedUser = selectedUserID ? demoUsers[selectedUserID] : undefined;

    if (selectedUserID && selectedUser) {
      const credentials = Buffer.from(
        `${selectedUserID}:${selectedUser.password}`,
      ).toString('base64');
      req.headers.authorization = `Basic ${credentials}`;
      return next();
    }

    const acceptsHtml = req.accepts('html') && !req.path.startsWith('/dev/');
    if (acceptsHtml && (req.method === 'GET' || req.method === 'HEAD')) {
      const returnTo = encodeURIComponent(req.originalUrl);
      return res.redirect(`/dev/login?returnTo=${returnTo}`);
    }

    return next();
  });
}
