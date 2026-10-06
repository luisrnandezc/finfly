import cds from '@sap/cds';

import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { DELETE, POST, expect } = expenseServiceTest();
const { INSERT, UPDATE, DELETE: DELETE_QUERY } = cds.ql;

const baseUrl = '/expenses';

function draftUrl(reportID: string): string {
  return `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;
}

function deleteConfiguration(
  auth?: { username: string; password: string },
): Record<string, unknown> {
  return {
    ...(auth ? { auth } : {}),
    headers: { 'If-Match': '*' },
  };
}

describe('ExpenseService default aircraft selection', () => {
  it('selects the authenticated pilot’s only default aircraft', async () => {
    const reportID = '71400000-0000-0000-0000-000000000001';

    try {
      const response = await POST(`${baseUrl}/FlightReports`, {
        ID: reportID,
        requesterName: 'Automatic aircraft test',
      });

      expect(response.status).to.equal(201);
      expect(response.data.aircraft_ID).to.equal(masterDataIDs.aircraft);
    } finally {
      await DELETE(draftUrl(reportID), deleteConfiguration());
    }
  });

  it('preserves an aircraft explicitly selected by the pilot', async () => {
    const reportID = '71400000-0000-0000-0000-000000000004';

    try {
      const response = await POST(`${baseUrl}/FlightReports`, {
        ID: reportID,
        aircraft_ID: masterDataIDs.alternateAircraft,
        requesterName: 'Explicit aircraft test',
      });

      expect(response.status).to.equal(201);
      expect(response.data.aircraft_ID).to.equal(
        masterDataIDs.alternateAircraft,
      );
    } finally {
      await DELETE(draftUrl(reportID), deleteConfiguration());
    }
  });

  it('selects an aircraft when the authenticated pilot is its default SIC', async () => {
    const reportID = '71400000-0000-0000-0000-000000000005';
    const db = await cds.connect.to('db');
    const { Aircraft } = cds.entities('finfly');

    await db.run(
      UPDATE.entity(Aircraft)
        .set({
          defaultPIC_ID: null,
          defaultSIC_ID: masterDataIDs.captain,
        })
        .where({ ID: masterDataIDs.aircraft }),
    );

    try {
      const response = await POST(`${baseUrl}/FlightReports`, {
        ID: reportID,
        requesterName: 'Default SIC aircraft test',
      });

      expect(response.status).to.equal(201);
      expect(response.data.aircraft_ID).to.equal(masterDataIDs.aircraft);
    } finally {
      await DELETE(draftUrl(reportID), deleteConfiguration());
      await db.run(
        UPDATE.entity(Aircraft)
          .set({
            defaultPIC_ID: masterDataIDs.captain,
            defaultSIC_ID: masterDataIDs.firstOfficer,
          })
          .where({ ID: masterDataIDs.aircraft }),
      );
    }
  });

  it('leaves aircraft empty when the pilot has multiple defaults', async () => {
    const reportID = '71400000-0000-0000-0000-000000000002';
    const aircraftID = '21400000-0000-0000-0000-000000000001';
    const db = await cds.connect.to('db');
    const { Aircraft } = cds.entities('finfly');

    await db.run(
      INSERT.into(Aircraft).entries({
        ID: aircraftID,
        organization_ID: masterDataIDs.organization,
        registration: 'N9012',
        description: 'Multiple-default test aircraft',
        manufacturer: 'Cessna',
        model: '172S',
        serialNumber: 'TEST-9012',
        aircraftType: 'PISTON_SINGLE',
        defaultSIC_ID: masterDataIDs.captain,
      }),
    );

    try {
      const response = await POST(`${baseUrl}/FlightReports`, {
        ID: reportID,
        requesterName: 'Ambiguous aircraft test',
      });

      expect(response.status).to.equal(201);
      expect(response.data.aircraft_ID).to.equal(null);

      await DELETE(draftUrl(reportID), deleteConfiguration());
    } finally {
      await db.run(DELETE_QUERY.from(Aircraft).where({ ID: aircraftID }));
    }
  });

  it('leaves aircraft empty when the user has no default assignment', async () => {
    const reportID = '71400000-0000-0000-0000-000000000003';
    const adminConfiguration = {
      auth: { username: 'admin', password: 'admin' },
    };

    try {
      const response = await POST(
        `${baseUrl}/FlightReports`,
        {
          ID: reportID,
          requesterName: 'Manual aircraft test',
        },
        adminConfiguration,
      );

      expect(response.status).to.equal(201);
      expect(response.data.aircraft_ID).to.equal(null);
    } finally {
      await DELETE(
        draftUrl(reportID),
        deleteConfiguration(adminConfiguration.auth),
      );
    }
  });
});
