import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';

const IDs = {
  report: '50000000-0000-0000-0000-000000000001',
  validLeg: '51000000-0000-0000-0000-000000000001',
  nonexistentLeg: '59999999-0000-0000-0000-000000000001',
  expense: '53000000-0000-0000-0000-000000000001',
} as const;

describe('ExpenseService relationship validations', () => {
  it('rejects using the same pilot as PIC and SIC on one leg', async () => {
    const reportID = '50000000-0000-0000-0000-000000000002';
    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Leg crew validation test',
    });
    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/legs`, {
      ID: '51000000-0000-0000-0000-000000000002',
      flightDate: '2026-08-20',
      originAirportCode: 'SVMI',
      destinationAirportCode: 'SVVA',
      flightHours: 1,
      pic_ID: masterDataIDs.captain,
      sic_ID: masterDataIDs.captain,
    });
    expect(response.status).to.equal(201);

    response = await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
      {
        headers: { 'If-Match': '*' },
        validateStatus: (status: number) => status === 400,
      },
    );

    expect(response.status).to.equal(400);
    expect(response.data.error.message).to.include(
      'PIC and SIC must be different pilots',
    );
  });

  it('rejects activation when an expense references an invalid leg', async () => {
    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: IDs.report,
      reportNumber: 'FR-2026-INVALID-LEG',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Relationship validation test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    const draftUrl = `${baseUrl}/FlightReports(ID=${IDs.report},IsActiveEntity=false)`;

    response = await POST(`${draftUrl}/legs`, {
      ID: IDs.validLeg,
      flightDate: '2026-08-20',
      originAirportCode: 'SVVA',
      destinationAirportCode: 'SKRG',
      flightHours: 2.3,
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: IDs.expense,
      leg_ID: IDs.nonexistentLeg,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-20',
      description: 'Expense with invalid leg reference',
      originalAmount: 100,
      originalCurrency_code: 'USD',
    });

    // Drafts preserve intermediate input; validation occurs on activation.
    expect(response.status).to.equal(201);

    response = await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
      {
        headers: {
          'If-Match': '*',
        },
        validateStatus: (status: number) => status === 400,
      },
    );

    expect(response.status).to.equal(400);
    expect(response.data.error.message).to.include(
      'references a flight leg that does not belong to this report',
    );
  });
});
