import cds from '@sap/cds';

import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = expenseServiceTest();
const { SELECT, UPDATE, DELETE } = cds.ql;

const baseUrl = '/admin';
const adminConfiguration = {
  auth: { username: 'admin', password: 'admin' },
};

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
      const response = await POST(
        `${baseUrl}/Users`,
        {
          ID: userID,
          userId,
          firstName: 'Jamie',
          lastName: 'Synthetic',
          isPilot: true,
          isAuditor: false,
          isAdmin: false,
          licenseType: 'COMMERCIAL',
          totalFlightHours: 650,
        },
        adminConfiguration,
      );

      expect(response.status).to.equal(201);
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
    await expectRequestFailure(
      POST(
        `${baseUrl}/Users`,
        {
          ID: '72000000-0000-0000-0000-000000000002',
          userId: 'invalid.no.role',
          firstName: 'Invalid',
          lastName: 'User',
          isPilot: false,
          isAuditor: false,
          isAdmin: false,
        },
        adminConfiguration,
      ),
      /Select at least one application role/,
    );

    await expectRequestFailure(
      POST(
        `${baseUrl}/Users`,
        {
          ID: '72000000-0000-0000-0000-000000000003',
          userId: 'invalid.no.license',
          firstName: 'Invalid',
          lastName: 'Pilot',
          isPilot: true,
          isAuditor: false,
          isAdmin: false,
        },
        adminConfiguration,
      ),
      /License type is required for pilots/,
    );
  });

  it('deactivates a user and removes their default-aircraft assignments', async () => {
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');
    try {
      const response = await POST(
        `${baseUrl}/Users(ID=${masterDataIDs.captain})/AdminService.deactivateUser`,
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
      const created = await POST(
        `${baseUrl}/Aircraft`,
        {
          ID: aircraftID,
          registration: 'N8080',
          description: 'Synthetic admin test aircraft',
          manufacturer: 'Cessna',
          model: '208B Grand Caravan',
          serialNumber: 'TEST-C208-8080',
          aircraftType: 'TURBOPROP_SINGLE',
          defaultPilot_ID: masterDataIDs.captain,
          currentFlightHours: 1200,
          totalCycles: 900,
        },
        adminConfiguration,
      );
      expect(created.status).to.equal(201);
      expect(created.data.active).to.equal(true);

      const deactivated = await POST(
        `${baseUrl}/Aircraft(ID=${aircraftID})/AdminService.deactivateAircraft`,
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
