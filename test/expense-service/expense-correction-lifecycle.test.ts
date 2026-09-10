import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest();
const { INSERT } = cds.ql;

const baseUrl = '/expenses';
const pilotConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'pilot', password: 'pilot' },
};
const auditorConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'auditor', password: 'auditor' },
};

async function seedSubmittedReport(
  ID: string,
  reportNumber: string,
  auditStatus: 'PENDING' | 'ACTION_REQUIRED',
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      organization_ID: masterDataIDs.organization,
      reportNumber,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Correction lifecycle test',
      status: 'SUBMITTED',
      auditStatus,
    }),
  );
}

async function seedExpense(
  ID: string,
  reportID: string,
  auditStatus: 'PENDING' | 'NEEDS_CORRECTION',
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

function reportUrl(ID: string): string {
  return `${baseUrl}/FlightReports(ID=${ID},IsActiveEntity=true)`;
}

function expenseUrl(ID: string): string {
  return `${baseUrl}/Expenses(ID=${ID},IsActiveEntity=true)`;
}

describe('ExpenseService expense correction lifecycle', () => {
  it('requests, partially corrects, resubmits, and approves an expense', async () => {
    const reportID = '90000000-0000-0000-0000-000000000001';
    const expenseID = '90100000-0000-0000-0000-000000000001';
    const reason = 'Add the missing supplier';

    await seedSubmittedReport(
      reportID,
      'FR-2026-EXPENSE-CORRECTION',
      'PENDING',
    );
    await seedExpense(expenseID, reportID, 'PENDING');

    let response = await POST(
      `${expenseUrl(expenseID)}/ExpenseService.requestExpenseCorrection`,
      { reason },
      auditorConfiguration,
    );

    expect(response.data.auditStatus).to.equal('NEEDS_CORRECTION');
    expect(response.data.correctionReason).to.equal(reason);
    expect(response.data.auditedBy).to.equal('auditor');

    response = await GET(reportUrl(reportID));
    expect(response.data.auditStatus).to.equal('ACTION_REQUIRED');

    // The pilot changes only the requested field. Every omitted field must
    // retain the value that was prefilled in the Fiori action dialog.
    response = await POST(
      `${expenseUrl(expenseID)}/ExpenseService.resubmitExpense`,
      { supplier: 'Corrected Aviation Services' },
      pilotConfiguration,
    );

    expect(response.data.auditStatus).to.equal('PENDING');
    expect(response.data.correctionReason).to.equal(null);
    expect(response.data.auditedBy).to.equal(null);
    expect(response.data.supplier).to.equal('Corrected Aviation Services');
    expect(response.data.expenseDate).to.equal('2026-08-20');
    expect(response.data.category_ID).to.equal(masterDataIDs.fboCategory);
    expect(Number(response.data.originalAmount)).to.equal(100);
    expect(response.data.originalCurrency_code).to.equal('USD');

    response = await POST(
      `${expenseUrl(expenseID)}/ExpenseService.approveExpense`,
      {},
      auditorConfiguration,
    );
    expect(response.data.auditStatus).to.equal('APPROVED');

    response = await GET(`${expenseUrl(expenseID)}?$expand=auditHistory`);
    expect(
      response.data.auditHistory.map(
        (entry: { toStatus: string }) => entry.toStatus,
      ),
    ).to.deep.equal(['NEEDS_CORRECTION', 'PENDING', 'APPROVED']);

    response = await GET(reportUrl(reportID));
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.auditStatus).to.equal('APPROVED');
    expect(response.data.pendingExpenseCount).to.equal(0);
  });

  it('rejects resubmission unless correction was requested', async () => {
    const reportID = '90000000-0000-0000-0000-000000000012';
    const expenseID = '90100000-0000-0000-0000-000000000012';

    await seedSubmittedReport(reportID, 'FR-2026-NOT-CORRECTABLE', 'PENDING');
    await seedExpense(expenseID, reportID, 'PENDING');

    const response = await POST(
      `${expenseUrl(expenseID)}/ExpenseService.resubmitExpense`,
      { supplier: 'Unauthorized correction' },
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 409,
      },
    );

    expect(response.status).to.equal(409);
    expect(response.data.error.message).to.equal(
      `Expense ${expenseID} cannot be resubmitted because its status is PENDING`,
    );
  });

  it('keeps the report actionable until every corrected expense is resubmitted', async () => {
    const reportID = '90000000-0000-0000-0000-000000000013';
    const firstExpenseID = '90100000-0000-0000-0000-000000000013';
    const secondExpenseID = '90100000-0000-0000-0000-000000000014';

    await seedSubmittedReport(
      reportID,
      'FR-2026-MULTIPLE-CORRECTIONS',
      'ACTION_REQUIRED',
    );
    await seedExpense(firstExpenseID, reportID, 'NEEDS_CORRECTION');
    await seedExpense(secondExpenseID, reportID, 'NEEDS_CORRECTION');

    await POST(
      `${expenseUrl(firstExpenseID)}/ExpenseService.resubmitExpense`,
      { supplier: 'First corrected supplier' },
      pilotConfiguration,
    );

    let response = await GET(reportUrl(reportID));
    expect(response.data.auditStatus).to.equal('ACTION_REQUIRED');
    expect(response.data.pendingExpenseCount).to.equal(1);

    await POST(
      `${expenseUrl(secondExpenseID)}/ExpenseService.resubmitExpense`,
      { supplier: 'Second corrected supplier' },
      pilotConfiguration,
    );

    response = await GET(reportUrl(reportID));
    expect(response.data.auditStatus).to.equal('PENDING');
    expect(response.data.pendingExpenseCount).to.equal(2);
  });
});
