import { readFileSync } from 'node:fs';

describe('shared application shell', () => {
  it('displays the authenticated username from the session context', () => {
    const shell = readFileSync(
      new URL('../app/common/finfly-shell.js', import.meta.url),
      'utf8',
    );

    expect(shell).toContain('class="finfly-shell__username"');
    expect(shell).toContain('`Username: ${context.userId}`');
  });
});
