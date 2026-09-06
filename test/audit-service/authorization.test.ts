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

async function seedReport(
  ID: string,
  reportNumber: string,
  organizationID: string = masterDataIDs.organization,
  aircraftID: string = masterDataIDs.aircraft,
  status: 'DRAFT' | 'SUBMITTED' = 'SUBMITTED',
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      organization_ID: organizationID,
      reportNumber,
      aircraft_ID: aircraftID,
      requesterName: 'Audit service test',
      status,
      auditStatus: status === 'SUBMITTED' ? 'PENDING' : 'NOT_STARTED',
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
      category_ID: masterDataIDs.fuelCategory,
      expenseDate: '2026-09-06',
      supplier: 'Audit Test Supplier',
      receiptNumber: 'AUDIT-001',
      originalAmount: 250,
      originalCurrency_code: 'USD',
      auditStatus: 'PENDING',
    }),
  );
}

describe('AuditService authorization', () => {
  it('rejects users without the Auditor or Admin role', async () => {
    const response = await GET(`${baseUrl}/Expenses`, {
      auth: { username: 'pilot', password: 'pilot' },
      validateStatus: (status: number) => status === 403,
    });

    expect(response.status).to.equal(403);
  });

  it('exposes only submitted reports from the auditor organization', async () => {
    const ownSubmittedID = '97000000-0000-0000-0000-000000000001';
    const ownDraftID = '97000000-0000-0000-0000-000000000002';
    const otherSubmittedID = '97000000-0000-0000-0000-000000000003';

    await seedReport(ownSubmittedID, 'FR-2026-AUDIT-OWN');
    await seedReport(
      ownDraftID,
      'FR-2026-AUDIT-DRAFT',
      masterDataIDs.organization,
      masterDataIDs.aircraft,
      'DRAFT',
    );
    await seedReport(
      otherSubmittedID,
      'FR-2026-AUDIT-OTHER',
      masterDataIDs.otherOrganization,
      masterDataIDs.otherAircraft,
    );

    const response = await GET(
      `${baseUrl}/FlightReports?$select=ID`,
      auditorConfiguration,
    );
    const IDs = response.data.value.map(({ ID }: { ID: string }) => ID);

    expect(response.status).to.equal(200);
    expect(IDs).to.include(ownSubmittedID);
    expect(IDs).not.to.include(ownDraftID);
    expect(IDs).not.to.include(otherSubmittedID);
  });

  it('allows an auditor to approve an individual expense', async () => {
    const reportID = '97000000-0000-0000-0000-000000000004';
    const expenseID = '97100000-0000-0000-0000-000000000001';

    await seedReport(reportID, 'FR-2026-AUDIT-INDIVIDUAL');
    await seedExpense(expenseID, reportID);

    const response = await POST(
      `${baseUrl}/Expenses(ID=${expenseID})/AuditService.approveExpense`,
      {},
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('APPROVED');
    expect(response.data.auditedBy).to.equal('auditor');
  });

  it('allows an auditor to approve all pending report expenses', async () => {
    const reportID = '97000000-0000-0000-0000-000000000005';
    const firstExpenseID = '97100000-0000-0000-0000-000000000002';
    const secondExpenseID = '97100000-0000-0000-0000-000000000003';

    await seedReport(reportID, 'FR-2026-AUDIT-BULK');
    await seedExpense(firstExpenseID, reportID);
    await seedExpense(secondExpenseID, reportID);

    const response = await POST(
      `${baseUrl}/FlightReports(ID=${reportID})/AuditService.approveAllExpenses`,
      {},
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('APPROVED');

    const expenses = await GET(
      `${baseUrl}/Expenses?$filter=report_ID eq ${reportID}`,
      auditorConfiguration,
    );
    expect(
      expenses.data.value.every(
        ({ auditStatus }: { auditStatus: string }) =>
          auditStatus === 'APPROVED',
      ),
    ).to.equal(true);
  });
});
