import cds from '@sap/cds';
import { bootstrapOrganizationAdministrator } from '../srv/auth/bootstrap-admin.ts';
import { verifyPassword } from '../srv/auth/passwords.ts';
import { expenseServiceTest } from './support/expense-service-test';

expenseServiceTest();

const { SELECT, DELETE } = cds.ql;

describe('Organization administrator bootstrap', () => {
  it('creates the first administrator and safely refreshes it when rerun', async () => {
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    const input = {
      organizationCode: 'BOOTSTRAP-TEST',
      organizationName: 'Bootstrap Test Organization',
      userId: 'bootstrap.admin',
      password: 'Temporary bootstrap password 42!',
      nationalId: 'BOOTSTRAP-ID-001',
      firstName: 'Bootstrap',
      lastName: 'Administrator',
    };

    try {
      const created = await bootstrapOrganizationAdministrator(db, input);
      const refreshed = await bootstrapOrganizationAdministrator(db, {
        ...input,
        password: 'Replacement bootstrap password 84!',
      });

      expect(created.createdOrganization).to.equal(true);
      expect(created.createdAdministrator).to.equal(true);
      expect(refreshed.createdOrganization).to.equal(false);
      expect(refreshed.createdAdministrator).to.equal(false);
      expect(refreshed.organizationID).to.equal(created.organizationID);
      expect(refreshed.crewMemberID).to.equal(created.crewMemberID);

      const administrator = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ ID: created.crewMemberID }),
      );
      const credential = await db.run(
        SELECT.one.from(entities.UserCredentials).where({
          crewMember_ID: created.crewMemberID,
        }),
      );
      expect(administrator.isAdmin).to.equal(true);
      expect(administrator.active).to.equal(true);
      expect(credential.mustChangePassword).to.equal(true);
      expect(
        await verifyPassword('Replacement bootstrap password 84!', credential.passwordHash),
      ).to.equal(true);
    } finally {
      const organization = await db.run(
        SELECT.one.from(entities.Organizations).columns('ID').where({ code: input.organizationCode }),
      );
      if (organization) {
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
          DELETE.from(entities.OrganizationMembers).where({
            organization_ID: organization.ID,
          }),
        );
        await db.run(
          DELETE.from(entities.CrewMembers).where({ organization_ID: organization.ID }),
        );
        await db.run(DELETE.from(entities.Organizations).where({ ID: organization.ID }));
      }
    }
  });
});
