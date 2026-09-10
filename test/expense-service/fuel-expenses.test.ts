import cds from '@sap/cds';

import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { POST, expect } = expenseServiceTest();
const { INSERT } = cds.ql;

const pilotConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'pilot', password: 'pilot' },
};

async function seedSubmittedReport(ID: string): Promise<string> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      organization_ID: masterDataIDs.organization,
      reportNumber: `FR-2026-FUEL-${ID.at(-1)}`,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Fuel behavior test',
      status: 'SUBMITTED',
      auditStatus: 'APPROVED',
    }),
  );

  return `/expenses/FlightReports(ID=${ID},IsActiveEntity=true)`;
}

describe('ExpenseService fuel expenses', () => {
  it('preserves US gallons and stores a normalized liter quantity', async () => {
    const reportUrl = await seedSubmittedReport(
      '94000000-0000-0000-0000-000000000001',
    );

    const response = await POST(
      `${reportUrl}/ExpenseService.addExpense`,
      {
        categoryID: masterDataIDs.fuelCategory,
        expenseDate: '2026-09-10',
        originalAmount: 500,
        originalCurrencyCode: 'USD',
        fuelQuantity: 100,
        fuelUnit: 'US_GAL',
      },
      pilotConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.fuelQuantity).to.equal(100);
    expect(response.data.fuelUnit).to.equal('US_GAL');
    expect(response.data.fuelQuantityLiters).to.equal(378.54);
  });

  it('rejects incomplete fuel quantity information', async () => {
    const reportUrl = await seedSubmittedReport(
      '94000000-0000-0000-0000-000000000002',
    );

    const response = await POST(
      `${reportUrl}/ExpenseService.addExpense`,
      {
        categoryID: masterDataIDs.fuelCategory,
        expenseDate: '2026-09-10',
        originalAmount: 500,
        originalCurrencyCode: 'USD',
        fuelQuantity: 100,
      },
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 400,
      },
    );

    expect(response.data.error.message).to.equal(
      'Fuel quantity and unit must be provided together',
    );
  });

  it('rejects fuel quantity information for another category', async () => {
    const reportUrl = await seedSubmittedReport(
      '94000000-0000-0000-0000-000000000003',
    );

    const response = await POST(
      `${reportUrl}/ExpenseService.addExpense`,
      {
        categoryID: masterDataIDs.fboCategory,
        expenseDate: '2026-09-10',
        originalAmount: 500,
        originalCurrencyCode: 'USD',
        fuelQuantity: 100,
        fuelUnit: 'L',
      },
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 400,
      },
    );

    expect(response.data.error.message).to.equal(
      'Fuel quantity can only be recorded for fuel expenses',
    );
  });

  it('normalizes fuel quantity when a corrected expense is resubmitted', async () => {
    const reportID = '94000000-0000-0000-0000-000000000004';
    await seedSubmittedReport(reportID);

    const expenseID = '94100000-0000-0000-0000-000000000004';
    const db = await cds.connect.to('db');
    const { Expenses } = cds.entities('finfly');
    await db.run(
      INSERT.into(Expenses).entries({
        ID: expenseID,
        report_ID: reportID,
        category_ID: masterDataIDs.fuelCategory,
        expenseDate: '2026-09-10',
        originalAmount: 500,
        originalCurrency_code: 'USD',
        auditStatus: 'NEEDS_CORRECTION',
      }),
    );

    const response = await POST(
      `/expenses/Expenses(ID=${expenseID},IsActiveEntity=true)/ExpenseService.resubmitExpense`,
      { fuelQuantity: 50, fuelUnit: 'US_GAL' },
      pilotConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.auditStatus).to.equal('PENDING');
    expect(response.data.fuelQuantityLiters).to.equal(189.27);
  });

  it('clears fuel data when a correction changes the category', async () => {
    const reportID = '94000000-0000-0000-0000-000000000005';
    await seedSubmittedReport(reportID);

    const expenseID = '94100000-0000-0000-0000-000000000005';
    const db = await cds.connect.to('db');
    const { Expenses } = cds.entities('finfly');
    await db.run(
      INSERT.into(Expenses).entries({
        ID: expenseID,
        report_ID: reportID,
        category_ID: masterDataIDs.fuelCategory,
        expenseDate: '2026-09-10',
        originalAmount: 500,
        originalCurrency_code: 'USD',
        fuelQuantity: 100,
        fuelUnit: 'L',
        fuelQuantityLiters: 100,
        auditStatus: 'NEEDS_CORRECTION',
      }),
    );

    const response = await POST(
      `/expenses/Expenses(ID=${expenseID},IsActiveEntity=true)/ExpenseService.resubmitExpense`,
      { categoryCode: 'FBO' },
      pilotConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.category_ID).to.equal(masterDataIDs.fboCategory);
    expect(response.data.fuelQuantity).to.equal(null);
    expect(response.data.fuelUnit).to.equal(null);
    expect(response.data.fuelQuantityLiters).to.equal(null);
  });
});
