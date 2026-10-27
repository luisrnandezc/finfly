(() => {
  const style = document.createElement('style');
  style.textContent = `
    body.finfly-shell-body {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    body.finfly-shell-body > #container {
      flex: 1 1 auto;
      min-height: 0;
      height: auto;
    }
    .finfly-shell {
      box-sizing: border-box;
      display: flex;
      flex: 0 0 44px;
      align-items: center;
      gap: 1rem;
      min-height: 44px;
      padding: 0 1rem;
      color: #1d2d3e;
      background: #fff;
      border-bottom: 1px solid #d5dadd;
      font: 14px "72", Arial, sans-serif;
    }
    .finfly-shell__brand { font-size: 16px; font-weight: 700; }
    .finfly-shell__organization {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .finfly-shell__apps {
      display: none;
      margin-left: auto;
    }
    .finfly-shell__apps--visible { display: flex; }
    .finfly-shell__apps select {
      padding: 6px 28px 6px 9px;
      color: #1d2d3e;
      background: #fff;
      border: 1px solid #89919a;
      border-radius: 6px;
      font: inherit;
      cursor: pointer;
    }
    .finfly-shell__logout { margin-left: auto; }
    .finfly-shell__apps--visible + .finfly-shell__logout { margin-left: 0; }
    .finfly-shell__logout button {
      padding: 6px 12px;
      color: #0064d9;
      background: transparent;
      border: 1px solid #bcc3ca;
      border-radius: 6px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .finfly-shell__logout button:hover { background: #eef5fc; }
  `;
  document.head.append(style);

  const shell = document.createElement('header');
  shell.className = 'finfly-shell';
  shell.innerHTML = `
    <span class="finfly-shell__brand">FinFly</span>
    <span class="finfly-shell__organization" aria-live="polite">Loading organization…</span>
    <label class="finfly-shell__apps">
      <select aria-label="Switch application"></select>
    </label>
    <form class="finfly-shell__logout" method="post" action="/auth/logout">
      <button type="submit">Log out</button>
    </form>
  `;
  document.body.classList.add('finfly-shell-body');
  document.body.prepend(shell);

  fetch('/auth/context', { credentials: 'same-origin' })
    .then((response) => {
      if (response.status === 401) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
        return undefined;
      }
      if (!response.ok) throw new Error('Unable to load account information');
      return response.json();
    })
    .then((context) => {
      if (!context) return;
      shell.querySelector('.finfly-shell__organization').textContent = context.organizationName;
      if (context.applications.length > 1) {
        const appSwitcher = shell.querySelector('.finfly-shell__apps');
        const select = appSwitcher.querySelector('select');
        for (const application of context.applications) {
          const option = document.createElement('option');
          option.value = application.path;
          option.textContent = application.label;
          option.selected = window.location.pathname.startsWith(
            application.path.replace('/index.html', ''),
          );
          select.append(option);
        }
        select.addEventListener('change', () => window.location.assign(select.value));
        appSwitcher.classList.add('finfly-shell__apps--visible');
      }
    })
    .catch(() => {
      shell.querySelector('.finfly-shell__organization').textContent = 'Organization unavailable';
    });
})();
