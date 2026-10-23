import { randomUUID } from 'node:crypto';
import cds from '@sap/cds';
import { verifyPassword } from '../../srv/auth/passwords.ts';
import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = expenseServiceTest();
const { SELECT, DELETE } = cds.ql;
const baseUrl = '/staff';
const staffConfiguration = { auth: { username: 'staff', password: 'staff' } };

async function removeOrganization(code: string): Promise<void> {
  const db = await cds.connect.to('db');
  const entities = cds.entities('finfly');
  const organization = await db.run(
    SELECT.one.from(entities.Organizations).columns('ID').where({ code }),
  );
  if (!organization) return;
  const users = await db.run(
    SELECT.from(entities.CrewMembers).columns('ID').where({
      organization_ID: organization.ID,
    }),
  );
  for (const user of users) {
    await db.run(DELETE.from(entities.UserSessions).where({ crewMember_ID: user.ID }));
    await db.run(DELETE.from(entities.UserCredentials).where({ crewMember_ID: user.ID }));
  }
  await db.run(
    DELETE.from(entities.OrganizationMembers).where({ organization_ID: organization.ID }),
  );
  await db.run(DELETE.from(entities.CrewMembers).where({ organization_ID: organization.ID }));
  await db.run(DELETE.from(entities.Organizations).where({ ID: organization.ID }));
}

describe('StaffService customer access administration', () => {
  it('is staff-only and returns organization-level user counts', async () => {
    try {
      await GET(`${baseUrl}/Organizations`, {
        auth: { username: 'admin', password: 'admin' },
      });
      expect.fail('Expected the request to be rejected');
    } catch (error) {
      expect(String(error)).to.match(/403/);
    }

    const response = await GET(`${baseUrl}/Organizations`, staffConfiguration);
    expect(response.status).to.equal(200);
    const demo = response.data.value.find(
      (organization: { ID: string }) => organization.ID === masterDataIDs.organization,
    );
    expect(demo).to.include({
      activeUserCount: 6,
      activePilotCount: 4,
      activeAuditorCount: 2,
      activeAdministratorCount: 1,
    });

    const administrators = await GET(`${baseUrl}/Administrators`, staffConfiguration);
    expect(administrators.data.value[0].organizationName).to.equal('FinFly Demo Operator');
    expect(administrators.data.value[0]).not.to.have.property('nationalId');
    expect(administrators.data.value[0]).not.to.have.property('isPilot');
    expect(administrators.data.value[0]).not.to.have.property('isAuditor');
    expect(administrators.data.value[0]).not.to.have.property('totalFlightHours');
  });

  it('creates an organization and its first administrator together', async () => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const code = `STAFF-${suffix}`;
    const userId = `staff.created.${suffix.toLowerCase()}`;
    const password = 'Temporary staff-created password';
    try {
      const response = await POST(
        `${baseUrl}/createOrganization`,
        {
          code,
          name: 'Staff-created Test Operator',
          administratorUserId: userId,
          temporaryPassword: password,
          nationalId: `STAFF-ID-${suffix}`,
          firstName: 'Staff-created',
          lastName: 'Administrator',
        },
        staffConfiguration,
      );
      expect(response.status).to.equal(200);

      const db = await cds.connect.to('db');
      const entities = cds.entities('finfly');
      const organization = await db.run(
        SELECT.one.from(entities.Organizations).where({ code }),
      );
      const administrator = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ userId }),
      );
      const credential = await db.run(
        SELECT.one.from(entities.UserCredentials).where({
          crewMember_ID: administrator.ID,
        }),
      );
      expect(organization.active).to.equal(true);
      expect(administrator.organization_ID).to.equal(organization.ID);
      expect(administrator.isAdmin).to.equal(true);
      expect(administrator.isStaff).to.equal(false);
      expect(credential.mustChangePassword).to.equal(true);
      expect(await verifyPassword(password, credential.passwordHash)).to.equal(true);
    } finally {
      await removeOrganization(code);
    }
  });

  it('adds and deactivates an administrator and safely deactivates its organization', async () => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const code = `LIFE-${suffix}`;
    const firstUserId = `lifecycle.first.${suffix.toLowerCase()}`;
    const secondUserId = `lifecycle.second.${suffix.toLowerCase()}`;
    try {
      await POST(
        `${baseUrl}/createOrganization`,
        {
          code,
          name: 'Lifecycle Test Operator',
          administratorUserId: firstUserId,
          temporaryPassword: 'Temporary first password',
          nationalId: `FIRST-${suffix}`,
          firstName: 'First',
          lastName: 'Administrator',
        },
        staffConfiguration,
      );
      const db = await cds.connect.to('db');
      const entities = cds.entities('finfly');
      const organization = await db.run(
        SELECT.one.from(entities.Organizations).where({ code }),
      );

      const added = await POST(
        `${baseUrl}/Organizations(${organization.ID})/StaffService.addAdministrator`,
        {
          userId: secondUserId,
          temporaryPassword: 'Temporary second password',
          nationalId: `SECOND-${suffix}`,
          firstName: 'Second',
          lastName: 'Administrator',
        },
        staffConfiguration,
      );
      expect(added.status).to.equal(200);
      const secondAdministrator = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ userId: secondUserId }),
      );

      await POST(
        `${baseUrl}/Administrators(${secondAdministrator.ID})/StaffService.deactivateAdministrator`,
        {},
        staffConfiguration,
      );
      const inactiveAdministrator = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ ID: secondAdministrator.ID }),
      );
      expect(inactiveAdministrator.active).to.equal(false);

      await POST(
        `${baseUrl}/Organizations(${organization.ID})/StaffService.deactivateOrganization`,
        {},
        staffConfiguration,
      );
      const inactiveOrganization = await db.run(
        SELECT.one.from(entities.Organizations).where({ ID: organization.ID }),
      );
      expect(inactiveOrganization.active).to.equal(false);
    } finally {
      await removeOrganization(code);
    }
  });
});
