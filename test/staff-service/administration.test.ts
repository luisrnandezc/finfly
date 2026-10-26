import { randomUUID } from 'node:crypto';
import cds from '@sap/cds';
import { verifyPassword } from '../../srv/auth/passwords.ts';
import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { DELETE: HTTP_DELETE, GET, POST, PATCH, expect } = expenseServiceTest();
const { SELECT, DELETE } = cds.ql;
const baseUrl = '/staff';
const staffConfiguration = { auth: { username: 'staff', password: 'staff' } };

function staffDraftUrl(entity: 'Organizations' | 'Users', ID: string): string {
  return `${baseUrl}/${entity}(ID=${ID},IsActiveEntity=false)`;
}

async function editStaffDraft(
  entity: 'Organizations' | 'Users',
  ID: string,
  data: Record<string, unknown>,
): Promise<string> {
  const activeUrl = `${baseUrl}/${entity}(ID=${ID},IsActiveEntity=true)`;
  const edited = await POST(
    `${activeUrl}/StaffService.draftEdit`,
    { PreserveChanges: true },
    staffConfiguration,
  );
  expect(edited.status).to.equal(201);
  const draftUrl = staffDraftUrl(entity, ID);
  await PATCH(draftUrl, data, {
    ...staffConfiguration,
    headers: { 'If-Match': '*' },
  });
  return draftUrl;
}

async function activateStaffDraft(draftUrl: string) {
  return POST(
    `${draftUrl}/StaffService.draftActivate`,
    {},
    {
      ...staffConfiguration,
      headers: { 'If-Match': '*' },
    },
  );
}

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
  it('is staff-only and returns organization-level user counts and customer users', async () => {
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

    const users = await GET(`${baseUrl}/Users`, staffConfiguration);
    expect(users.data.value).to.have.length(7);
    const pilot = users.data.value.find(
      (user: { ID: string }) => user.ID === masterDataIDs.captain,
    );
    expect(pilot).to.include({
      organizationName: 'FinFly Demo Operator',
      fullName: 'Alex Demo',
      userId: 'pilot',
      isPilot: true,
      isAuditor: false,
      isAdmin: false,
    });
    const otherOrganizationPilot = users.data.value.find(
      (user: { ID: string }) => user.ID === masterDataIDs.otherCrewMember,
    );
    expect(otherOrganizationPilot.organizationName).to.equal('Other Test Operator');
    expect(pilot).not.to.have.property('passwordHash');
  });

  it('creates an organization and its first administrator together', async () => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const code = `STAFF-${suffix}`;
    const duplicateCode = `DUP-${suffix}`;
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

      try {
        await POST(
          `${baseUrl}/createOrganization`,
          {
            code: duplicateCode,
            name: 'Duplicate National ID Operator',
            administratorUserId: `duplicate.${suffix.toLowerCase()}`,
            temporaryPassword: 'Temporary duplicate password',
            nationalId: `STAFF-ID-${suffix}`,
            firstName: 'Duplicate',
            lastName: 'Administrator',
          },
          staffConfiguration,
        );
        expect.fail('Expected the duplicate National ID to be rejected');
      } catch (error) {
        expect(String(error)).to.match(/409/);
      }
      const partialOrganization = await db.run(
        SELECT.one.from(entities.Organizations).where({ code: duplicateCode }),
      );
      expect(partialOrganization).not.to.exist;
    } finally {
      await removeOrganization(duplicateCode);
      await removeOrganization(code);
    }
  });

  it('updates organization and user details while preserving login membership', async () => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const code = `EDIT-${suffix}`;
    const updatedCode = `UPDATED-${suffix}`;
    const originalUserId = `edit.original.${suffix.toLowerCase()}`;
    const updatedUserId = `edit.updated.${suffix.toLowerCase()}`;
    try {
      await POST(
        `${baseUrl}/createOrganization`,
        {
          code,
          name: 'Original Organization Name',
          administratorUserId: originalUserId,
          temporaryPassword: 'Temporary edit password',
          nationalId: `EDIT-ID-${suffix}`,
          firstName: 'Original',
          lastName: 'Administrator',
        },
        staffConfiguration,
      );

      const db = await cds.connect.to('db');
      const entities = cds.entities('finfly');
      const organization = await db.run(
        SELECT.one.from(entities.Organizations).where({ code }),
      );
      const user = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ userId: originalUserId }),
      );

      const organizationDraft = await editStaffDraft(
        'Organizations',
        organization.ID,
        {
          name: 'Updated Organization Name',
          code: updatedCode.toLowerCase(),
        },
      );
      await activateStaffDraft(organizationDraft);
      const userDraft = await editStaffDraft('Users', user.ID, {
          firstName: 'Updated',
          userId: updatedUserId,
          positionTitle: 'Customer Administrator',
      });
      await activateStaffDraft(userDraft);

      const updatedOrganization = await db.run(
        SELECT.one.from(entities.Organizations).where({ ID: organization.ID }),
      );
      const updatedUser = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ ID: user.ID }),
      );
      const updatedMembership = await db.run(
        SELECT.one.from(entities.OrganizationMembers).where({
          organization_ID: organization.ID,
          userId: updatedUserId,
        }),
      );
      expect(updatedOrganization.name).to.equal('Updated Organization Name');
      expect(updatedOrganization.code).to.equal(updatedCode);
      expect(updatedUser).to.include({
        firstName: 'Updated',
        userId: updatedUserId,
        positionTitle: 'Customer Administrator',
        isAdmin: true,
      });
      expect(updatedMembership).to.exist;

      const duplicateOrganizationDraft = await editStaffDraft(
        'Organizations',
        organization.ID,
        { code: 'DEMO' },
      );
      try {
        await activateStaffDraft(duplicateOrganizationDraft);
        expect.fail('Expected the duplicate organization code to be rejected');
      } catch (error) {
        expect(String(error)).to.match(/409/);
      } finally {
        await HTTP_DELETE(duplicateOrganizationDraft, {
          ...staffConfiguration,
          headers: { 'If-Match': '*' },
        });
      }

      const duplicateDraft = await editStaffDraft('Users', user.ID, {
        nationalId: 'DEMO-ID-001',
      });
      try {
        await activateStaffDraft(duplicateDraft);
        expect.fail('Expected the duplicate National ID to be rejected');
      } catch (error) {
        expect(String(error)).to.match(/409/);
      } finally {
        await HTTP_DELETE(duplicateDraft, {
          ...staffConfiguration,
          headers: { 'If-Match': '*' },
        });
      }
    } finally {
      await removeOrganization(updatedCode);
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
        `${baseUrl}/Organizations(ID=${organization.ID},IsActiveEntity=true)/StaffService.addAdministrator`,
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
        `${baseUrl}/Users(ID=${secondAdministrator.ID},IsActiveEntity=true)/StaffService.deactivateUser`,
        {},
        staffConfiguration,
      );
      const inactiveAdministrator = await db.run(
        SELECT.one.from(entities.CrewMembers).where({ ID: secondAdministrator.ID }),
      );
      expect(inactiveAdministrator.active).to.equal(false);

      await POST(
        `${baseUrl}/Organizations(ID=${organization.ID},IsActiveEntity=true)/StaffService.deactivateOrganization`,
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
