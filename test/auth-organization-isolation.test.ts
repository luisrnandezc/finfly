import cds from '@sap/cds';
import type { Request } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSessionUser } from '../srv/auth/authentication.ts';
import { newSessionToken, sessionTokenHash } from '../srv/auth/session.ts';
import { expenseServiceTest } from './support/expense-service-test';
import { masterDataIDs } from './support/ids';

expenseServiceTest();

const { DELETE, INSERT, UPDATE } = cds.ql;
const crewMemberID = '73000000-0000-0000-0000-000000000001';
const membershipID = '73000000-0000-0000-0000-000000000002';
const credentialID = '73000000-0000-0000-0000-000000000003';
const userId = 'inactive.organization.user';

describe('production authentication organization isolation', () => {
  afterEach(async () => {
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    await db.run(UPDATE.entity(entities.Organizations).set({ active: true }).where({
      ID: masterDataIDs.otherOrganization,
    }));
    await db.run(DELETE.from(entities.UserSessions).where({ crewMember_ID: crewMemberID }));
    await db.run(DELETE.from(entities.UserCredentials).where({ crewMember_ID: crewMemberID }));
    await db.run(DELETE.from(entities.OrganizationMembers).where({ ID: membershipID }));
    await db.run(DELETE.from(entities.CrewMembers).where({ ID: crewMemberID }));
  });

  it('stops resolving an existing session when its organization is inactive', async () => {
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    const token = newSessionToken();

    await db.run(
      INSERT.into(entities.CrewMembers).entries({
        ID: crewMemberID,
        organization_ID: masterDataIDs.otherOrganization,
        nationalId: 'AUTH-ORG-001',
        firstName: 'Session',
        lastName: 'Tester',
        userId,
        isPilot: true,
        isAuditor: false,
        isAdmin: false,
        licenseType: 'COMMERCIAL',
        totalFlightHours: 100,
        active: true,
      }),
    );
    await db.run(
      INSERT.into(entities.OrganizationMembers).entries({
        ID: membershipID,
        organization_ID: masterDataIDs.otherOrganization,
        userId,
        active: true,
      }),
    );
    await db.run(
      INSERT.into(entities.UserCredentials).entries({
        ID: credentialID,
        crewMember_ID: crewMemberID,
        passwordHash: 'not-used-by-session-resolution',
        mustChangePassword: false,
        failedLoginAttempts: 0,
      }),
    );
    await db.run(
      INSERT.into(entities.UserSessions).entries({
        tokenHash: sessionTokenHash(token),
        crewMember_ID: crewMemberID,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );

    const request = {
      headers: { cookie: `finfly_session=${token}` },
    } as unknown as Request;
    expect((await resolveSessionUser(request))?.organization_ID).to.equal(
      masterDataIDs.otherOrganization,
    );

    await db.run(UPDATE.entity(entities.Organizations).set({ active: false }).where({
      ID: masterDataIDs.otherOrganization,
    }));

    expect(await resolveSessionUser(request)).to.equal(undefined);
  });
});
