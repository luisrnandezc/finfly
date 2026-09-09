import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, expect } = expenseServiceTest();
const { INSERT } = cds.ql;

const baseUrl = '/audit';
const auditorConfiguration = {
  auth: { username: 'auditor', password: 'auditor' },
};

describe('AuditService shared status filter', () => {
  it('maps a correction expense to the shared Action Required status', async () => {
    const reportID = '98200000-0000-0000-0000-000000000001';
    const expenseID = '98300000-0000-0000-0000-000000000001';
    const db = await cds.connect.to('db');
    const { FlightReports, Expenses } = cds.entities('finfly');

    await db.run(
      INSERT.into(FlightReports).entries({
        ID: reportID,
        organization_ID: masterDataIDs.organization,
        aircraft_ID: masterDataIDs.aircraft,
        reportNumber: 'FR-2026-SHARED-STATUS',
        requesterName: 'Shared filter test',
        status: 'SUBMITTED',
        auditStatus: 'ACTION_REQUIRED',
      }),
    );

    await db.run(
      INSERT.into(Expenses).entries({
        ID: expenseID,
        report_ID: reportID,
        category_ID: masterDataIDs.fuelCategory,
        expenseDate: '2026-09-09',
        originalAmount: 100,
        originalCurrency_code: 'USD',
        auditStatus: 'NEEDS_CORRECTION',
      }),
    );

    // Both tabs receive the same filter value even though their persisted
    // workflow statuses intentionally use different domain terminology.
    const reports = await GET(
      `${baseUrl}/FlightReports?$filter=reviewStatus eq 'ACTION_REQUIRED'&$select=ID,reviewStatus`,
      auditorConfiguration,
    );
    const expenses = await GET(
      `${baseUrl}/Expenses?$filter=reviewStatus eq 'ACTION_REQUIRED'&$select=ID,reviewStatus,auditStatus`,
      auditorConfiguration,
    );

    const filteredReport = reports.data.value.find(
      (report: { ID: string }) => report.ID === reportID,
    );
    const filteredExpense = expenses.data.value.find(
      (expense: { ID: string }) => expense.ID === expenseID,
    );

    expect(filteredReport).to.include({
      ID: reportID,
      reviewStatus: 'ACTION_REQUIRED',
    });
    expect(filteredExpense).to.include({
      ID: expenseID,
      reviewStatus: 'ACTION_REQUIRED',
      auditStatus: 'NEEDS_CORRECTION',
    });
  });
});
