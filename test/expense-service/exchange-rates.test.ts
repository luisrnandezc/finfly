import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest({ withMocks: true });

const { INSERT } = cds.ql;

const baseUrl = '/expenses';

describe('ExpenseService exchange rates', () => {
  it('converts USD and VES expenses using the mocked external service', async () => {
    const reportID = '92000000-0000-0000-0000-000000000001';

    const vesExpenseID = '92100000-0000-0000-0000-000000000001';

    const usdExpenseID = '92100000-0000-0000-0000-000000000002';

    const db = await cds.connect.to('db');

    const { FlightReports, Expenses } = cds.entities('finfly');

    // Arrange the internal data directly so this test remains
    // focused on the external-service integration.
    await db.run(
      INSERT.into(FlightReports).entries({
        ID: reportID,
        organization_ID: masterDataIDs.organization,
        reportNumber: 'FR-2026-EXCHANGE-RATES',
        aircraft_ID: masterDataIDs.aircraft,
        requesterName: 'Exchange-rate integration test',
        status: 'DRAFT',
      }),
    );

    await db.run(
      INSERT.into(Expenses).entries([
        {
          ID: vesExpenseID,
          report_ID: reportID,
          category_ID: masterDataIDs.fboCategory,
          expenseDate: '2026-08-12',
          description: 'Expense originally paid in VES',
          originalAmount: 180000,
          originalCurrency_code: 'VES',
        },
        {
          ID: usdExpenseID,
          report_ID: reportID,
          category_ID: masterDataIDs.fboCategory,
          expenseDate: '2026-08-14',
          description: 'Expense originally paid in USD',
          originalAmount: 1800,
          originalCurrency_code: 'USD',
        },
      ]),
    );

    const reportUrl =
      `${baseUrl}/FlightReports(` + `ID=${reportID},IsActiveEntity=true)`;

    let response = await POST(
      `${reportUrl}/ExpenseService.refreshExchangeRates`,
      {},
      {
        headers: {
          'If-Match': '*',
        },
        auth: {
          username: 'pilot',
          password: 'pilot',
        },
      },
    );

    expect(response.status).to.equal(200);

    response = await GET(`${reportUrl}?$expand=expenses`);

    expect(response.status).to.equal(200);
    expect(response.data.expenses).to.have.length(2);

    const vesExpense = response.data.expenses.find(
      (expense: { ID: string }) => expense.ID === vesExpenseID,
    );

    expect(vesExpense).to.exist;
    expect(Number(vesExpense.exchangeRate)).to.equal(145.5);
    expect(Number(vesExpense.amountVES)).to.equal(180000);
    expect(Number(vesExpense.amountUSD)).to.equal(1237.11);

    const usdExpense = response.data.expenses.find(
      (expense: { ID: string }) => expense.ID === usdExpenseID,
    );

    expect(usdExpense).to.exist;
    expect(Number(usdExpense.exchangeRate)).to.equal(145.5);
    expect(Number(usdExpense.amountUSD)).to.equal(1800);
    expect(Number(usdExpense.amountVES)).to.equal(261900);
  });
});
