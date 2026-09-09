import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest();
const { INSERT } = cds.ql;

const baseUrl = '/audit';
const auditorConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'auditor', password: 'auditor' },
};

type ReportAuditStatus = 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED';

async function seedSubmittedReport(
  ID: string,
  reportNumber: string,
  auditStatus: ReportAuditStatus,
  pendingExpenseCount = 0,
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      organization_ID: masterDataIDs.organization,
      aircraft_ID: masterDataIDs.aircraft,
      reportNumber,
      requesterName: 'Audit queue test',
      status: 'SUBMITTED',
      auditStatus,
      pendingExpenseCount,
      submittedAt: '2026-09-09T12:00:00Z',
    }),
  );
}

async function seedPendingExpense(ID: string, reportID: string): Promise<void> {
  const db = await cds.connect.to('db');
  const { Expenses } = cds.entities('finfly');

  await db.run(
    INSERT.into(Expenses).entries({
      ID,
      report_ID: reportID,
      category_ID: masterDataIDs.fuelCategory,
      expenseDate: '2026-09-09',
      originalAmount: 250,
      originalCurrency_code: 'USD',
      auditStatus: 'PENDING',
    }),
  );
}

function reportIDs(response: { data: { value: Array<{ ID: string }> } }) {
  return response.data.value.map(({ ID }) => ID);
}

describe('AuditService report queues', () => {
  it('separates reports requiring attention from approved history', async () => {
    const pendingID = '98000000-0000-0000-0000-000000000001';
    const actionRequiredID = '98000000-0000-0000-0000-000000000002';
    const approvedID = '98000000-0000-0000-0000-000000000003';

    await seedSubmittedReport(pendingID, 'FR-2026-QUEUE-PENDING', 'PENDING', 1);
    await seedSubmittedReport(
      actionRequiredID,
      'FR-2026-QUEUE-ACTION',
      'ACTION_REQUIRED',
    );
    await seedSubmittedReport(
      approvedID,
      'FR-2026-QUEUE-APPROVED',
      'APPROVED',
    );

    // Mirrors the filters used by the two SelectionPresentationVariants.
    const requiringAttention = await GET(
      `${baseUrl}/FlightReports?$filter=auditStatus ne 'APPROVED'&$select=ID`,
      auditorConfiguration,
    );
    const approvedHistory = await GET(
      `${baseUrl}/FlightReports?$filter=auditStatus eq 'APPROVED'&$select=ID`,
      auditorConfiguration,
    );

    expect(requiringAttention.status).to.equal(200);
    expect(reportIDs(requiringAttention)).to.include.members([
      pendingID,
      actionRequiredID,
    ]);
    expect(reportIDs(requiringAttention)).not.to.include(approvedID);

    expect(approvedHistory.status).to.equal(200);
    expect(reportIDs(approvedHistory)).to.include(approvedID);
    expect(reportIDs(approvedHistory)).not.to.include.members([
      pendingID,
      actionRequiredID,
    ]);

    const approvedReport = await GET(
      `${baseUrl}/FlightReports(ID=${approvedID})`,
      auditorConfiguration,
    );
    expect(approvedReport.status).to.equal(200);
    expect(approvedReport.data.auditStatus).to.equal('APPROVED');
  });

  it('moves a fully audited report into the approved-history query', async () => {
    const reportID = '98000000-0000-0000-0000-000000000004';
    const firstExpenseID = '98100000-0000-0000-0000-000000000001';
    const secondExpenseID = '98100000-0000-0000-0000-000000000002';

    await seedSubmittedReport(
      reportID,
      'FR-2026-QUEUE-TRANSITION',
      'PENDING',
      2,
    );
    await seedPendingExpense(firstExpenseID, reportID);
    await seedPendingExpense(secondExpenseID, reportID);

    const response = await POST(
      `${baseUrl}/FlightReports(ID=${reportID})/AuditService.approveAllExpenses`,
      {},
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('APPROVED');
    expect(response.data.pendingExpenseCount).to.equal(0);

    const requiringAttention = await GET(
      `${baseUrl}/FlightReports?$filter=auditStatus ne 'APPROVED'&$select=ID`,
      auditorConfiguration,
    );
    const approvedHistory = await GET(
      `${baseUrl}/FlightReports?$filter=auditStatus eq 'APPROVED'&$select=ID`,
      auditorConfiguration,
    );

    expect(reportIDs(requiringAttention)).not.to.include(reportID);
    expect(reportIDs(approvedHistory)).to.include(reportID);
  });
});
