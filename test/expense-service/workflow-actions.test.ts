import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { DELETE, GET, POST, expect } = expenseServiceTest();
const { INSERT, SELECT } = cds.ql;

const baseUrl = '/expenses';

const pilotConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'pilot', password: 'pilot' },
};

const auditorConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'auditor', password: 'auditor' },
};

const pilotAuditorConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'admin', password: 'admin' },
};

async function seedReport(
  ID: string,
  reportNumber: string,
  status: 'DRAFT' | 'SUBMITTED',
  auditStatus: 'NOT_STARTED' | 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED',
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      organization_ID: masterDataIDs.organization,
      reportNumber,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Workflow action test',
      status,
      auditStatus,
    }),
  );
}

async function seedExpense(
  ID: string,
  reportID: string,
  auditStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'NEEDS_CORRECTION',
): Promise<void> {
  const db = await cds.connect.to('db');
  const { Expenses } = cds.entities('finfly');

  await db.run(
    INSERT.into(Expenses).entries({
      ID,
      report_ID: reportID,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-20',
      description: 'Workflow expense',
      originalAmount: 100,
      originalCurrency_code: 'USD',
      auditStatus,
    }),
  );
}

function activeReportUrl(ID: string): string {
  return `${baseUrl}/FlightReports(ID=${ID},IsActiveEntity=true)`;
}

function activeExpenseUrl(ID: string): string {
  return `${baseUrl}/Expenses(ID=${ID},IsActiveEntity=true)`;
}

describe('ExpenseService workflow actions', () => {
  it('moves an expense through correction, resubmission, and approval', async () => {
    const reportID = '90000000-0000-0000-0000-000000000001';
    const expenseID = '90100000-0000-0000-0000-000000000001';
    const reason = 'The fuel receipt is unreadable';

    await seedReport(
      reportID,
      'FR-2026-EXPENSE-CORRECTION',
      'SUBMITTED',
      'PENDING',
    );
    await seedExpense(expenseID, reportID, 'PENDING');

    let response = await POST(
      `${activeExpenseUrl(expenseID)}/ExpenseService.requestExpenseCorrection`,
      { reason },
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('NEEDS_CORRECTION');
    expect(response.data.correctionReason).to.equal(reason);
    expect(response.data.auditedBy).to.equal('auditor');

    response = await GET(activeReportUrl(reportID));
    expect(response.data.auditStatus).to.equal('ACTION_REQUIRED');

    response = await POST(
      `${activeExpenseUrl(expenseID)}/ExpenseService.resubmitExpense`,
      { description: 'Corrected receipt information' },
      pilotConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('PENDING');
    expect(response.data.correctionReason).to.equal(null);
    expect(response.data.auditedBy).to.equal(null);
    expect(response.data.description).to.equal('Corrected receipt information');

    response = await POST(
      `${activeExpenseUrl(expenseID)}/ExpenseService.approveExpense`,
      {},
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('APPROVED');
    expect(response.data.auditedBy).to.equal('auditor');

    response = await GET(
      `${activeExpenseUrl(expenseID)}?$expand=auditHistory`,
    );

    expect(response.data.auditHistory).to.have.length(3);
    expect(
      response.data.auditHistory.map(
        (entry: { toStatus: string }) => entry.toStatus,
      ),
    ).to.deep.equal(['NEEDS_CORRECTION', 'PENDING', 'APPROVED']);

    response = await GET(activeReportUrl(reportID));
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.auditStatus).to.equal('APPROVED');
  });

  it('approves all pending expenses without changing report status', async () => {
    const reportID = '90000000-0000-0000-0000-000000000002';
    const firstExpenseID = '90200000-0000-0000-0000-000000000001';
    const secondExpenseID = '90200000-0000-0000-0000-000000000002';

    await seedReport(reportID, 'FR-2026-APPROVE-ALL', 'SUBMITTED', 'PENDING');
    await seedExpense(firstExpenseID, reportID, 'PENDING');
    await seedExpense(secondExpenseID, reportID, 'PENDING');

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.approveAllExpenses`,
      {},
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.auditStatus).to.equal('APPROVED');

    const db = await cds.connect.to('db');
    const { Expenses } = cds.entities('finfly');
    const expenses = await db.run(
      SELECT.from(Expenses)
        .columns('auditStatus')
        .where({ report_ID: reportID }),
    );

    expect(expenses).to.have.length(2);
    expect(
      expenses.every(
        (expense: { auditStatus: string }) =>
          expense.auditStatus === 'APPROVED',
      ),
    ).to.equal(true);
  });

  it('requires a correction reason', async () => {
    const reportID = '90000000-0000-0000-0000-000000000003';
    const expenseID = '90300000-0000-0000-0000-000000000001';

    await seedReport(reportID, 'FR-2026-MISSING-REASON', 'SUBMITTED', 'PENDING');
    await seedExpense(expenseID, reportID, 'PENDING');

    const response = await POST(
      `${activeExpenseUrl(expenseID)}/ExpenseService.requestExpenseCorrection`,
      { reason: '   ' },
      {
        ...auditorConfiguration,
        validateStatus: (status: number) => status === 400,
      },
    );

    expect(response.status).to.equal(400);
    expect(response.data.error.message).to.equal('Provide the missing value.');
  });

  it('prevents clients from setting workflow status directly', async () => {
    const reportID = '90000000-0000-0000-0000-000000000004';

    const response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-DIRECT-STATUS',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Direct status test',
      status: 'SUBMITTED',
      auditStatus: 'APPROVED',
    });

    expect(response.status).to.equal(201);
    expect(response.data.status).to.equal('DRAFT');
    expect(response.data.auditStatus).to.equal('NOT_STARTED');
  });

  it('prevents editing a submitted report', async () => {
    const reportID = '90000000-0000-0000-0000-000000000005';

    await seedReport(
      reportID,
      'FR-2026-SUBMITTED-LOCKED',
      'SUBMITTED',
      'PENDING',
    );

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.draftEdit`,
      { PreserveChanges: false },
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 409,
      },
    );

    expect(response.status).to.equal(409);
    expect(response.data.error.message).to.equal(
      'Flight report FR-2026-SUBMITTED-LOCKED cannot be edited because its status is SUBMITTED',
    );
  });

  it('allows deleting a draft report', async () => {
    const reportID = '90000000-0000-0000-0000-000000000010';

    const response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Discarded draft test',
    });

    expect(response.status).to.equal(201);

    const deleteResponse = await DELETE(
      `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`,
      pilotConfiguration,
    );

    expect(deleteResponse.status).to.equal(204);
  });

  it('prevents deleting a submitted report', async () => {
    const reportID = '90000000-0000-0000-0000-000000000011';

    await seedReport(
      reportID,
      'FR-2026-SUBMITTED-NOT-DELETABLE',
      'SUBMITTED',
      'PENDING',
    );

    const response = await DELETE(activeReportUrl(reportID), {
      ...pilotConfiguration,
      validateStatus: (status: number) => status === 409,
    });

    expect(response.status).to.equal(409);
    expect(response.data.error.message).to.equal(
      'Flight report FR-2026-SUBMITTED-NOT-DELETABLE cannot be deleted because its status is SUBMITTED',
    );

    const persistedReport = await GET(activeReportUrl(reportID));
    expect(persistedReport.status).to.equal(200);
  });

  it('automatically approves expenses when the submitter is also an auditor', async () => {
    const reportID = '90000000-0000-0000-0000-000000000006';
    const legID = '90600000-0000-0000-0000-000000000001';
    const crewAssignmentID = '90600000-0000-0000-0000-000000000002';
    const expenseID = '90600000-0000-0000-0000-000000000003';

    let response = await POST(
      `${baseUrl}/FlightReports`,
      {
        ID: reportID,
        reportNumber: 'FR-2026-SELF-APPROVAL',
        aircraft_ID: masterDataIDs.aircraft,
        requesterName: 'Small operator test',
      },
      pilotAuditorConfiguration,
    );

    const draftUrl = activeReportUrl(reportID).replace('true', 'false');

    await POST(
      `${draftUrl}/legs`,
      {
        ID: legID,
        flightDate: '2026-08-20',
        originAirportCode: 'SVMI',
        destinationAirportCode: 'SVVA',
        flightHours: 1.2,
      },
      pilotAuditorConfiguration,
    );

    await POST(
      `${draftUrl}/crew`,
      {
        ID: crewAssignmentID,
        crewMember_ID: masterDataIDs.captain,
        role: 'PIC',
      },
      pilotAuditorConfiguration,
    );

    await POST(
      `${draftUrl}/expenses`,
      {
        ID: expenseID,
        category_ID: masterDataIDs.fboCategory,
        expenseDate: '2026-08-20',
        description: 'Expense approved on submission',
        originalAmount: 100,
        originalCurrency_code: 'USD',
      },
      pilotAuditorConfiguration,
    );

    await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
      pilotAuditorConfiguration,
    );

    response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.submit`,
      {},
      pilotAuditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.auditStatus).to.equal('APPROVED');

    response = await GET(activeExpenseUrl(expenseID), pilotAuditorConfiguration);
    expect(response.data.auditStatus).to.equal('APPROVED');
    expect(response.data.auditedBy).to.equal('admin');
  });

  it('queues an expense added after report submission for audit', async () => {
    const reportID = '90000000-0000-0000-0000-000000000007';

    await seedReport(
      reportID,
      'FR-2026-LATE-EXPENSE',
      'SUBMITTED',
      'APPROVED',
    );

    let response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.addExpense`,
      {
        categoryID: masterDataIDs.fboCategory,
        expenseDate: '2026-08-21',
        description: 'Receipt received after report submission',
        originalAmount: 75,
        originalCurrencyCode: 'USD',
      },
      pilotConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('PENDING');
    expect(response.data.addedAfterReportSubmission).to.equal(true);
    expect(response.data.submittedForAuditAt).to.exist;

    const expenseID = response.data.ID as string;

    response = await GET(`${activeExpenseUrl(expenseID)}?$expand=auditHistory`);
    expect(response.data.auditHistory).to.have.length(1);
    expect(response.data.auditHistory[0].fromStatus).to.equal('DRAFT');
    expect(response.data.auditHistory[0].toStatus).to.equal('PENDING');

    response = await GET(activeReportUrl(reportID));
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.auditStatus).to.equal('PENDING');

    response = await GET(
      `${baseUrl}/Expenses?$filter=addedAfterReportSubmission eq true and auditStatus eq 'PENDING'`,
      auditorConfiguration,
    );
    expect(
      response.data.value.some(
        (expense: { ID: string }) => expense.ID === expenseID,
      ),
    ).to.equal(true);
  });
});
