import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = cds.test('serve', 'all', '--in-memory');

const { INSERT } = cds.ql;

const baseUrl = '/expenses';

const pilotConfiguration = {
  headers: {
    'If-Match': '*',
  },
  auth: {
    username: 'pilot',
    password: 'pilot',
  },
};

const auditorConfiguration = {
  headers: {
    'If-Match': '*',
  },
  auth: {
    username: 'auditor',
    password: 'auditor',
  },
};

async function seedActiveReport(
  ID: string,
  reportNumber: string,
  status: 'DRAFT' | 'SUBMITTED',
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      reportNumber,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Authorization test',
      status,
    }),
  );
}

function activeReportUrl(ID: string): string {
  return `${baseUrl}/FlightReports(` + `ID=${ID},IsActiveEntity=true)`;
}

describe('ExpenseService authorization', () => {
  it('prevents a pilot from approving a submitted report', async () => {
    const reportID = '93000000-0000-0000-0000-000000000001';

    await seedActiveReport(
      reportID,
      'FR-2026-PILOT-CANNOT-APPROVE',
      'SUBMITTED',
    );

    const reportUrl = activeReportUrl(reportID);

    let response = await POST(
      `${reportUrl}/ExpenseService.approve`,
      {
        comment: 'A pilot must not approve this report',
      },
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 403,
      },
    );

    expect(response.status).to.equal(403);

    // Confirm that authorization rejected the request before
    // the action handler changed the report.
    response = await GET(reportUrl);

    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.reviewedAt).to.equal(null);
    expect(response.data.reviewedBy).to.equal(null);
  });

  it('prevents an auditor from refreshing exchange rates', async () => {
    const reportID = '93000000-0000-0000-0000-000000000002';

    await seedActiveReport(reportID, 'FR-2026-AUDITOR-CANNOT-REFRESH', 'DRAFT');

    const reportUrl = activeReportUrl(reportID);

    const response = await POST(
      `${reportUrl}/ExpenseService.refreshExchangeRates`,
      {},
      {
        ...auditorConfiguration,
        validateStatus: (status: number) => status === 403,
      },
    );

    expect(response.status).to.equal(403);
  });

  it('prevents an auditor from submitting a report', async () => {
    const reportID = '93000000-0000-0000-0000-000000000003';

    await seedActiveReport(reportID, 'FR-2026-AUDITOR-CANNOT-SUBMIT', 'DRAFT');

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.submit`,
      {},
      {
        ...auditorConfiguration,
        validateStatus: (status: number) => status === 403,
      },
    );

    expect(response.status).to.equal(403);
  });
});
