import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import cds from '@sap/cds';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { resolveSessionUser } from '../srv/auth/authentication.ts';
import { bootstrapOrganizationAdministrator } from '../srv/auth/bootstrap-admin.ts';
import { verifyPassword } from '../srv/auth/passwords.ts';
import { registerAuthenticationRoutes } from '../srv/auth/routes.ts';
import { sessionTokenHash } from '../srv/auth/session.ts';
import { expenseServiceTest } from './support/expense-service-test';

expenseServiceTest();

const { DELETE, SELECT } = cds.ql;
const temporaryPassword = 'Temporary route password 42!';
const replacementPassword = 'Replacement route password 84!';
const testSuffix = randomUUID().slice(0, 8);
const input = {
  organizationCode: `AUTH-${testSuffix}`,
  organizationName: 'Authentication Route Test',
  userId: `auth.route.${testSuffix}`,
  password: temporaryPassword,
  nationalId: `AUTH-${testSuffix}`,
  firstName: 'Authentication',
  lastName: 'Administrator',
};

describe('forced password change', () => {
  let server: Server;
  let baseUrl: string;
  let organizationID: string;
  let crewMemberID: string;

  beforeAll(async () => {
    const db = await cds.connect.to('db');
    const result = await bootstrapOrganizationAdministrator(db, input);
    organizationID = result.organizationID;
    crewMemberID = result.crewMemberID;

    const app = express();
    registerAuthenticationRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    await db.run(DELETE.from(entities.UserSessions).where({ crewMember_ID: crewMemberID }));
    await db.run(DELETE.from(entities.UserCredentials).where({ crewMember_ID: crewMemberID }));
    await db.run(
      DELETE.from(entities.OrganizationMembers).where({
        organization_ID: organizationID,
        userId: input.userId,
      }),
    );
    await db.run(DELETE.from(entities.CrewMembers).where({ ID: crewMemberID }));
    await db.run(DELETE.from(entities.Organizations).where({ ID: organizationID }));
  });

  it('saves the new password and redirects the administrator to the admin app', async () => {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: new URLSearchParams({
        userId: input.userId,
        password: temporaryPassword,
      }),
      redirect: 'manual',
    });
    expect(login.status).to.equal(302);
    expect(login.headers.get('location')).to.equal('/auth/change-password');
    const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
    expect(cookie).to.be.a('string');
    const token = cookie!.slice(cookie!.indexOf('=') + 1);
    const db = await cds.connect.to('db');
    const session = await db.run(
      SELECT.one.from(cds.entities('finfly').UserSessions).where({
        tokenHash: sessionTokenHash(token),
      }),
    );
    expect(session.crewMember_ID).to.equal(crewMemberID);

    const change = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: { cookie: cookie! },
      body: new URLSearchParams({
        password: replacementPassword,
        confirmation: replacementPassword,
      }),
      redirect: 'manual',
    });
    expect(change.status).to.equal(302);
    expect(change.headers.get('location')).to.equal('/finfly.admin/index.html');

    const entities = cds.entities('finfly');
    const credential = await db.run(
      SELECT.one.from(entities.UserCredentials).where({ crewMember_ID: crewMemberID }),
    );
    expect(credential.mustChangePassword).to.equal(false);
    expect(await verifyPassword(replacementPassword, credential.passwordHash)).to.equal(true);

    const sessionUser = await resolveSessionUser({
      headers: { cookie },
    } as unknown as Request);
    expect(sessionUser?.isAdmin).to.equal(true);
    expect(sessionUser?.mustChangePassword).to.equal(false);
  });
});
