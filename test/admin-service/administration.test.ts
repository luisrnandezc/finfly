import cds from '@sap/cds';

import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { DELETE: HTTP_DELETE, GET, PATCH, POST, expect } = expenseServiceTest();
const { SELECT, UPDATE, DELETE } = cds.ql;

const baseUrl = '/admin';
const adminConfiguration = {
  auth: { username: 'admin', password: 'admin' },
};

function userDraftUrl(ID: string): string {
  return `${baseUrl}/Users(ID=${ID},IsActiveEntity=false)`;
}

async function createUserDraft(
  ID: string,
  data: Record<string, unknown>,
): Promise<string> {
  const created = await POST(`${baseUrl}/Users`, { ID }, adminConfiguration);
  expect(created.status).to.equal(201);
  expect(created.data.IsActiveEntity).to.equal(false);

  const draftUrl = userDraftUrl(ID);
  const updated = await PATCH(draftUrl, data, adminConfiguration);
  expect(updated.status).to.equal(200);
  return draftUrl;
}

async function activateUserDraft(draftUrl: string) {
  return POST(
    `${draftUrl}/AdminService.draftActivate`,
    {},
    {
      ...adminConfiguration,
      headers: { 'If-Match': '*' },
    },
  );
}

async function discardUserDraft(draftUrl: string): Promise<void> {
  await HTTP_DELETE(draftUrl, {
    ...adminConfiguration,
    headers: { 'If-Match': '*' },
  });
}

function aircraftDraftUrl(ID: string): string {
  return `${baseUrl}/Aircraft(ID=${ID},IsActiveEntity=false)`;
}

async function createAircraftDraft(
  ID: string,
  data: Record<string, unknown>,
): Promise<string> {
  const created = await POST(`${baseUrl}/Aircraft`, { ID }, adminConfiguration);
  expect(created.status).to.equal(201);
  expect(created.data.IsActiveEntity).to.equal(false);

  const draftUrl = aircraftDraftUrl(ID);
  const updated = await PATCH(draftUrl, data, adminConfiguration);
  expect(updated.status).to.equal(200);
  return draftUrl;
}

async function activateAircraftDraft(draftUrl: string) {
  return POST(
    `${draftUrl}/AdminService.draftActivate`,
    {},
    {
      ...adminConfiguration,
      headers: { 'If-Match': '*' },
    },
  );
}

async function expectRequestFailure(
  request: Promise<unknown>,
  messagePattern: RegExp,
): Promise<void> {
  try {
    await request;
    expect.fail('Expected the request to fail');
  } catch (error) {
    expect(String(error)).to.match(messagePattern);
  }
}

describe('AdminService organization administration', () => {
  it('allows only administrators to access the service', async () => {
    await expectRequestFailure(
      GET(`${baseUrl}/Users`, {
        auth: { username: 'auditor', password: 'auditor' },
      }),
      /403/,
    );

    const response = await GET(`${baseUrl}/Users`, adminConfiguration);
    expect(response.status).to.equal(200);
  });

  it('creates a user and its organization membership together', async () => {
    const userID = '72000000-0000-0000-0000-000000000001';
    const userId = 'new.demo.pilot';
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');

    try {
      const draftUrl = await createUserDraft(userID, {
        userId,
        firstName: 'Jamie',
        lastName: 'Synthetic',
        isPilot: true,
        isAuditor: false,
        isAdmin: false,
        licenseType: 'COMMERCIAL',
        totalFlightHours: 650,
      });
      const response = await activateUserDraft(draftUrl);

      expect([200, 201]).to.include(response.status);
      expect(response.data.IsActiveEntity).to.equal(true);
      expect(response.data.organization_ID).to.equal(masterDataIDs.organization);
      expect(response.data.active).to.equal(true);

      const membership = await db.run(
        SELECT.one.from(entities.OrganizationMembers).where({
          organization_ID: masterDataIDs.organization,
          userId,
          active: true,
        }),
      );
      expect(membership).to.exist;
    } finally {
      await db.run(
        DELETE.from(entities.OrganizationMembers).where({ userId }),
      );
      await db.run(DELETE.from(entities.CrewMembers).where({ ID: userID }));
    }
  });

  it('requires a role and pilot license for pilot users', async () => {
    const noRoleDraftUrl = await createUserDraft(
      '72000000-0000-0000-0000-000000000002',
      {
        userId: 'invalid.no.role',
        firstName: 'Invalid',
        lastName: 'User',
        isPilot: false,
        isAuditor: false,
        isAdmin: false,
      },
    );
    const noLicenseDraftUrl = await createUserDraft(
      '72000000-0000-0000-0000-000000000003',
      {
        userId: 'invalid.no.license',
        firstName: 'Invalid',
        lastName: 'Pilot',
        isPilot: true,
        isAuditor: false,
        isAdmin: false,
      },
    );

    try {
      await expectRequestFailure(
        activateUserDraft(noRoleDraftUrl),
        /Select at least one application role/,
      );
      await expectRequestFailure(
        activateUserDraft(noLicenseDraftUrl),
        /License type is required for pilots/,
      );
    } finally {
      await discardUserDraft(noRoleDraftUrl);
      await discardUserDraft(noLicenseDraftUrl);
    }
  });

  it('does not create a user or membership when its draft is discarded', async () => {
    const userID = '72000000-0000-0000-0000-000000000005';
    const userId = 'discarded.demo.pilot';
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    const draftUrl = await createUserDraft(userID, {
      userId,
      firstName: 'Discarded',
      lastName: 'Draft',
      isPilot: true,
      isAuditor: false,
      isAdmin: false,
      licenseType: 'COMMERCIAL',
      totalFlightHours: 100,
    });

    await discardUserDraft(draftUrl);

    const user = await db.run(
      SELECT.one.from(entities.CrewMembers).where({ ID: userID }),
    );
    const membership = await db.run(
      SELECT.one.from(entities.OrganizationMembers).where({ userId }),
    );
    expect(user).not.to.exist;
    expect(membership).not.to.exist;
  });

  it('deactivates a user and removes their default-aircraft assignments', async () => {
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    try {
      const response = await POST(
        `${baseUrl}/Users(ID=${masterDataIDs.captain},IsActiveEntity=true)/AdminService.deactivateUser`,
        {},
        adminConfiguration,
      );
      expect(response.status).to.equal(200);
      expect(response.data.active).to.equal(false);

      const aircraft = await db.run(
        SELECT.one.from(entities.Aircraft).columns('defaultPilot_ID').where({
          ID: masterDataIDs.aircraft,
        }),
      );
      expect(aircraft.defaultPilot_ID).to.equal(null);
    } finally {
      await db.run(
        UPDATE.entity(entities.CrewMembers)
          .set({ active: true })
          .where({ ID: masterDataIDs.captain }),
      );
      await db.run(
        UPDATE.entity(entities.OrganizationMembers)
          .set({ active: true })
          .where({
            organization_ID: masterDataIDs.organization,
            userId: 'pilot',
          }),
      );
      await db.run(
        UPDATE.entity(entities.Aircraft)
          .set({ defaultPilot_ID: masterDataIDs.captain })
          .where({ ID: masterDataIDs.aircraft }),
      );
    }
  });

  it('creates and softly deactivates an aircraft', async () => {
    const aircraftID = '72000000-0000-0000-0000-000000000004';
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');

    try {
      const draftUrl = await createAircraftDraft(aircraftID, {
        registration: 'N8080',
        description: 'Synthetic admin test aircraft',
        manufacturer: 'Cessna',
        model: '208B Grand Caravan',
        serialNumber: 'TEST-C208-8080',
        aircraftType: 'TURBOPROP_SINGLE',
        defaultPilot_ID: masterDataIDs.captain,
        currentFlightHours: 1200,
        totalCycles: 900,
      });
      const created = await activateAircraftDraft(draftUrl);
      expect([200, 201]).to.include(created.status);
      expect(created.data.IsActiveEntity).to.equal(true);
      expect(created.data.active).to.equal(true);

      const deactivated = await POST(
        `${baseUrl}/Aircraft(ID=${aircraftID},IsActiveEntity=true)/AdminService.deactivateAircraft`,
        {},
        adminConfiguration,
      );
      expect(deactivated.data.active).to.equal(false);

      const stored = await db.run(
        SELECT.one.from(entities.Aircraft).where({ ID: aircraftID }),
      );
      expect(stored).to.exist;
    } finally {
      await db.run(DELETE.from(entities.Aircraft).where({ ID: aircraftID }));
    }
  });
});
