import cds from '@sap/cds';
import { readFileSync } from 'node:fs';

describe('username labels', () => {
  it('labels account identifiers as Username in Admin and Staff metadata', async () => {
    const model = await cds.load(['srv', 'app']);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;

    for (const entityName of [
      'AdminService.Users',
      'StaffService.Users',
      'StaffService.Administrators',
    ]) {
      const elements = definitions?.[entityName]?.elements as
        | Record<string, Record<string, unknown>>
        | undefined;
      expect(elements?.userId?.['@title']).toEqual('Username');
    }
  });

  it('uses Username on the login form', () => {
    const routes = readFileSync(
      new URL('../srv/auth/routes.ts', import.meta.url),
      'utf8',
    );

    expect(routes).toContain('<label>Username<input name="userId"');
  });
});
