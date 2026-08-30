import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';

const utcDate = (): string => new Date().toISOString().slice(0, 10);

describe('ExpenseService date defaults', () => {
  it('defaults new flight legs and expenses to the current date', async () => {
    const reportID = '47000000-0000-0000-0000-000000000001';
    const draftUrl =
      `${baseUrl}/FlightReports(` +
      `ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Date defaults test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    // Capture both sides of the request so the assertion remains stable at UTC midnight.
    const legDateBeforeRequest = utcDate();
    response = await POST(`${draftUrl}/legs`, {
      ID: '47100000-0000-0000-0000-000000000001',
      originAirportCode: 'SVMI',
      destinationAirportCode: 'SVVA',
      flightHours: 1.2,
    });
    const legDateAfterRequest = utcDate();

    expect(response.status).to.equal(201);
    expect([legDateBeforeRequest, legDateAfterRequest]).to.include(
      response.data.flightDate,
    );

    const expenseDateBeforeRequest = utcDate();
    response = await POST(`${draftUrl}/expenses`, {
      ID: '47200000-0000-0000-0000-000000000001',
      category_ID: masterDataIDs.fboCategory,
      description: 'Expense with a default date',
      originalAmount: 100,
      originalCurrency_code: 'USD',
    });
    const expenseDateAfterRequest = utcDate();

    expect(response.status).to.equal(201);
    expect([expenseDateBeforeRequest, expenseDateAfterRequest]).to.include(
      response.data.expenseDate,
    );
  });
});
