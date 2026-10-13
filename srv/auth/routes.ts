import cds from '@sap/cds';
import type { Application, Request, Response } from 'express';
import express from 'express';
import { hashPassword, validatePassword, verifyPassword } from './passwords.ts';
import {
  cookieValue,
  newSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  sessionTokenHash,
} from './session.ts';

const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

type LoginRecord = {
  ID: string;
  userId: string;
  organization_ID: string;
  isPilot: boolean;
  isAuditor: boolean;
  isAdmin: boolean;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  credentialID: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeReturnPath(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : undefined;
}

function defaultPath(user: LoginRecord): string {
  if (user.isAdmin) return '/finfly.admin/index.html';
  if (user.isAuditor) return '/finfly.audit/index.html';
  return '/finfly.flightreports/index.html';
}

function loginPage(error = '', returnTo?: string): string {
  const message = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
  const target = returnTo
    ? `<input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in | FinFly</title><style>
:root{font-family:"72",Arial,sans-serif;color:#1d2d3e;background:#f5f6f7}body{margin:0}main{max-width:390px;margin:10vh auto;padding:32px;background:#fff;border:1px solid #d5dadd;border-radius:12px;box-shadow:0 4px 18px #00000012}h1{margin:0 0 8px}p{color:#556b82}label{display:grid;gap:6px;margin:18px 0 0;font-weight:600}input{font:inherit;padding:11px;border:1px solid #89919a;border-radius:6px}button{width:100%;margin-top:24px;padding:12px;border:0;border-radius:6px;background:#0070f2;color:#fff;font:inherit;font-weight:700;cursor:pointer}.error{padding:10px;border-radius:6px;background:#ffeaf4;color:#aa0808}</style></head>
<body><main><h1>Sign in to FinFly</h1><p>Use the organization code and credentials provided by your administrator.</p>${message}
<form method="post" action="/auth/login">${target}<label>Organization code<input name="organization" autocomplete="organization" required></label><label>User ID<input name="userId" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form>
</main></body></html>`;
}

function changePasswordPage(error = ''): string {
  const message = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Change password | FinFly</title><style>
:root{font-family:"72",Arial,sans-serif;color:#1d2d3e;background:#f5f6f7}main{max-width:390px;margin:10vh auto;padding:32px;background:#fff;border:1px solid #d5dadd;border-radius:12px}label{display:grid;gap:6px;margin:18px 0;font-weight:600}input{font:inherit;padding:11px}button{width:100%;padding:12px;border:0;border-radius:6px;background:#0070f2;color:#fff;font-weight:700}.error{padding:10px;background:#ffeaf4;color:#aa0808}</style></head><body><main><h1>Choose a new password</h1><p>Your administrator issued a temporary password. Replace it before continuing.</p>${message}<form method="post" action="/auth/change-password"><label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><label>Confirm password<input name="confirmation" type="password" autocomplete="new-password" minlength="12" required></label><button type="submit">Save password</button></form></main></body></html>`;
}

async function findLogin(
  organizationCode: string,
  userId: string,
): Promise<LoginRecord | undefined> {
  const db = await cds.connect.to('db');
  const entities = cds.entities('finfly');
  const organization = (await db.run(
    SELECT.one.from(entities.Organizations).columns('ID').where({
      code: organizationCode,
      active: true,
    }),
  )) as { ID: string } | undefined;
  if (!organization) return undefined;

  const user = (await db.run(
    SELECT.one.from(entities.CrewMembers).where({
      organization_ID: organization.ID,
      userId,
      active: true,
    }),
  )) as Omit<LoginRecord, 'passwordHash' | 'credentialID'> | undefined;
  if (!user) return undefined;

  const membership = await db.run(
    SELECT.one.from(entities.OrganizationMembers).columns('ID').where({
      organization_ID: organization.ID,
      userId,
      active: true,
    }),
  );
  if (!membership) return undefined;

  const credential = (await db.run(
    SELECT.one.from(entities.UserCredentials).where({ crewMember_ID: user.ID }),
  )) as
    | {
        ID: string;
        passwordHash: string;
        mustChangePassword: boolean;
        failedLoginAttempts: number;
        lockedUntil?: string | null;
      }
    | undefined;
  return credential
    ? { ...user, ...credential, credentialID: credential.ID }
    : undefined;
}

function secureCookie(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function registerAuthenticationRoutes(app: Application): void {
  app.get('/', (_req, res) => {
    res.redirect('/auth/login');
  });

  app.use(express.urlencoded({ extended: false, limit: '8kb' }));

  app.get('/auth/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(loginPage('', safeReturnPath(req.query.returnTo)));
  });

  app.post('/auth/login', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const organizationCode = String(req.body.organization ?? '').trim().toUpperCase();
    const userId = String(req.body.userId ?? '').trim();
    const password = String(req.body.password ?? '');
    const returnTo = safeReturnPath(req.body.returnTo);
    const record = await findLogin(organizationCode, userId);
    const now = Date.now();
    const locked = record?.lockedUntil && new Date(record.lockedUntil).getTime() > now;
    const valid = record && !locked && (await verifyPassword(password, record.passwordHash));

    if (!valid) {
      if (record && !locked) {
        const attempts = record.failedLoginAttempts + 1;
        const changes: Record<string, unknown> = { failedLoginAttempts: attempts };
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          changes.lockedUntil = new Date(now + LOCK_DURATION_MS).toISOString();
        }
        const db = await cds.connect.to('db');
        await db.run(
          UPDATE.entity('finfly.UserCredentials').set(changes).where({ ID: record.credentialID }),
        );
      }
      return res.status(401).type('html').send(loginPage('Invalid credentials', returnTo));
    }

    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    const token = newSessionToken();
    await db.run(
      UPDATE.entity(entities.UserCredentials)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where({ ID: record.credentialID }),
    );
    await db.run(
      INSERT.into(entities.UserSessions).entries({
        tokenHash: sessionTokenHash(token),
        crewMember_ID: record.ID,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + SESSION_DURATION_MS).toISOString(),
      }),
    );
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: secureCookie(),
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });
    return res.redirect(
      record.mustChangePassword ? '/auth/change-password' : (returnTo ?? defaultPath(record)),
    );
  });

  app.get('/auth/change-password', (req, res) => {
    if (!cookieValue(req.headers.cookie, SESSION_COOKIE)) return res.redirect('/auth/login');
    res.set('Cache-Control', 'no-store');
    return res.type('html').send(changePasswordPage());
  });

  app.post('/auth/change-password', async (req: Request, res: Response) => {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    if (!token) return res.redirect('/auth/login');
    const password = String(req.body.password ?? '');
    if (password !== String(req.body.confirmation ?? '')) {
      return res.status(400).type('html').send(changePasswordPage('Passwords do not match'));
    }
    try {
      validatePassword(password);
    } catch (error) {
      return res.status(400).type('html').send(changePasswordPage((error as Error).message));
    }

    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    const tokenHash = sessionTokenHash(token);
    const session = (await db.run(
      SELECT.one.from(entities.UserSessions).columns('crewMember_ID').where({
        tokenHash,
        expiresAt: { '>': new Date().toISOString() },
      }),
    )) as { crewMember_ID: string } | undefined;
    if (!session) return res.redirect('/auth/login');

    await db.run(
      UPDATE.entity(entities.UserCredentials)
        .set({ passwordHash: await hashPassword(password), mustChangePassword: false })
        .where({ crewMember_ID: session.crewMember_ID }),
    );
    await db.run(
      DELETE.from(entities.UserSessions).where({
        crewMember_ID: session.crewMember_ID,
        tokenHash: { '!=': tokenHash },
      }),
    );
    const user = (await db.run(
      SELECT.one
        .from(entities.CrewMembers)
        .columns('isAdmin', 'isAuditor', 'isPilot')
        .where({ ID: session.crewMember_ID }),
    )) as LoginRecord;
    return res.redirect(defaultPath(user));
  });

  app.post('/auth/logout', async (req: Request, res: Response) => {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    if (token) {
      const db = await cds.connect.to('db');
      await db.run(
        DELETE.from('finfly.UserSessions').where({ tokenHash: sessionTokenHash(token) }),
      );
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return res.redirect('/auth/login');
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/finfly.') && !cookieValue(req.headers.cookie, SESSION_COOKIE)) {
      return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
    }
    next();
  });
}
