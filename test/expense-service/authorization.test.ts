import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest();

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

async function seedExpense(ID: string, reportID: string): Promise<void> {
  const db = await cds.connect.to('db');
  const { Expenses } = cds.entities('finfly');

  await db.run(
    INSERT.into(Expenses).entries({
      ID,
      report_ID: reportID,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-20',
      originalAmount: 100,
      originalCurrency_code: 'USD',
      auditStatus: 'PENDING',
    }),
  );
}

function activeReportUrl(ID: string): string {
  return `${baseUrl}/FlightReports(` + `ID=${ID},IsActiveEntity=true)`;
}

function activeExpenseUrl(ID: string): string {
  return `${baseUrl}/Expenses(ID=${ID},IsActiveEntity=true)`;
}

describe('ExpenseService authorization', () => {
  it('prevents a pilot from approving an expense', async () => {
    const reportID = '93000000-0000-0000-0000-000000000001';
    const expenseID = '93100000-0000-0000-0000-000000000002';

    await seedActiveReport(
      reportID,
      'FR-2026-PILOT-CANNOT-APPROVE',
      'SUBMITTED',
    );
    await seedExpense(expenseID, reportID);

    const expenseUrl = activeExpenseUrl(expenseID);

    let response = await POST(
      `${expenseUrl}/ExpenseService.approveExpense`,
      {},
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 403,
      },
    );

    expect(response.status).to.equal(403);

    // Authorization must reject the request before the action handler
    // changes the expense.
    response = await GET(expenseUrl);

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('PENDING');
    expect(response.data.auditedAt).to.equal(null);
    expect(response.data.auditedBy).to.equal(null);
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

  it('allows an auditor to read a report', async () => {
    const reportID = '93000000-0000-0000-0000-000000000004';

    await seedActiveReport(reportID, 'FR-2026-AUDITOR-CAN-READ', 'SUBMITTED');

    const response = await GET(activeReportUrl(reportID), auditorConfiguration);

    expect(response.status).to.equal(200);
    expect(response.data.ID).to.equal(reportID);
    expect(response.data.status).to.equal('SUBMITTED');
  });

  it('prevents an auditor from creating a report', async () => {
    const response = await POST(
      `${baseUrl}/FlightReports`,
      {
        ID: '93000000-0000-0000-0000-000000000005',
        reportNumber: 'FR-2026-AUDITOR-CANNOT-CREATE',
        aircraft_ID: masterDataIDs.aircraft,
        requesterName: 'Unauthorized report creation',
      },
      {
        ...auditorConfiguration,
        validateStatus: (status: number) => status === 403,
      },
    );

    expect(response.status).to.equal(403);
  });

  it('prevents an auditor from directly creating an expense', async () => {
    const reportID = '93000000-0000-0000-0000-000000000006';

    await seedActiveReport(
      reportID,
      'FR-2026-AUDITOR-CANNOT-CREATE-EXPENSE',
      'DRAFT',
    );

    const response = await POST(
      `${baseUrl}/Expenses`,
      {
        ID: '93100000-0000-0000-0000-000000000001',
        report_ID: reportID,
        category_ID: masterDataIDs.fboCategory,
        expenseDate: '2026-08-16',
        description: 'Unauthorized expense',
        originalAmount: 100,
        originalCurrency_code: 'USD',
      },
      {
        ...auditorConfiguration,
        validateStatus: (status: number) => status === 403,
      },
    );

    expect(response.status).to.equal(403);
  });
});
