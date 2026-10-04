import cds from '@sap/cds';

import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = expenseServiceTest();
const { INSERT, DELETE } = cds.ql;

const baseUrl = '/admin';
const adminConfiguration = {
  auth: { username: 'admin', password: 'admin' },
  headers: { 'If-Match': '*' },
};

describe('AdminService audit workflow', () => {
  it('shows organization reports and approves a pending expense', async () => {
    const reportID = '72100000-0000-0000-0000-000000000001';
    const expenseID = '72100000-0000-0000-0000-000000000002';
    const db = await cds.connect.to('db');
    const entities = cds.entities('finfly');

    await db.run(
      INSERT.into(entities.FlightReports).entries({
        ID: reportID,
        organization_ID: masterDataIDs.organization,
        reportNumber: 'FR-2026-ADMIN-AUDIT',
        aircraft_ID: masterDataIDs.aircraft,
        requesterName: 'Admin audit test',
        status: 'SUBMITTED',
        auditStatus: 'PENDING',
        pendingExpenseCount: 1,
      }),
    );
    await db.run(
      INSERT.into(entities.Expenses).entries({
        ID: expenseID,
        report_ID: reportID,
        category_ID: masterDataIDs.fboCategory,
        expenseDate: '2026-09-23',
        originalAmount: 125,
        originalCurrency_code: 'USD',
        auditStatus: 'PENDING',
      }),
    );

    try {
      const reports = await GET(
        `${baseUrl}/FlightReports?$filter=ID eq ${reportID}`,
        adminConfiguration,
      );
      expect(reports.data.value).to.have.length(1);

      const response = await POST(
        `${baseUrl}/Expenses(ID=${expenseID})/AdminService.approveExpense`,
        {},
        adminConfiguration,
      );
      expect(response.status).to.equal(200);
      expect(response.data.auditStatus).to.equal('APPROVED');
      expect(response.data.auditedBy).to.equal('admin');
    } finally {
      await db.run(
        DELETE.from(entities.ExpenseAuditHistory).where({
          expense_ID: expenseID,
        }),
      );
      await db.run(DELETE.from(entities.Expenses).where({ ID: expenseID }));
      await db.run(DELETE.from(entities.FlightReports).where({ ID: reportID }));
    }
  });

  it('does not expose another organization’s users or aircraft', async () => {
    const users = await GET(`${baseUrl}/Users`, adminConfiguration);
    expect(
      users.data.value.every(
        (user: { organization_ID: string }) =>
          user.organization_ID === masterDataIDs.organization,
      ),
    ).to.equal(true);

    const aircraft = await GET(`${baseUrl}/Aircraft`, adminConfiguration);
    expect(
      aircraft.data.value.every(
        (item: { organization_ID: string }) =>
          item.organization_ID === masterDataIDs.organization,
      ),
    ).to.equal(true);
  });
});
