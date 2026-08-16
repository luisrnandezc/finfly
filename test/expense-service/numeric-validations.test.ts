import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';

async function createDraft(
  reportID: string,
  reportNumber: string,
): Promise<string> {
  const response = await POST(`${baseUrl}/FlightReports`, {
    ID: reportID,
    reportNumber,
    aircraft_ID: masterDataIDs.aircraft,
    requesterName: 'Numeric validation test',
    status: 'DRAFT',
  });

  expect(response.status).to.equal(201);

  return `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;
}

async function expectActivationRejected(draftUrl: string): Promise<void> {
  const response = await POST(
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
}

describe('ExpenseService numeric validations', () => {
  it('rejects activation for zero and negative expense amounts', async () => {
    const cases = [
      {
        reportID: '60000000-0000-0000-0000-000000000001',
        expenseID: '63000000-0000-0000-0000-000000000001',
        reportNumber: 'FR-2026-ZERO-AMOUNT',
        amount: 0,
      },
      {
        reportID: '60000000-0000-0000-0000-000000000002',
        expenseID: '63000000-0000-0000-0000-000000000002',
        reportNumber: 'FR-2026-NEGATIVE-AMOUNT',
        amount: -1,
      },
    ];

    for (const testCase of cases) {
      const draftUrl = await createDraft(
        testCase.reportID,
        testCase.reportNumber,
      );

      const response = await POST(`${draftUrl}/expenses`, {
        ID: testCase.expenseID,
        category_ID: masterDataIDs.fboCategory,
        expenseDate: '2026-08-20',
        description: 'Invalid amount test',
        originalAmount: testCase.amount,
        originalCurrency_code: 'USD',
      });

      expect(response.status).to.equal(201);
      await expectActivationRejected(draftUrl);
    }
  });

  it('rejects activation for invalid leg sequence or flight hours', async () => {
    const cases = [
      {
        suffix: '01',
        reportNumber: 'FR-2026-ZERO-SEQUENCE',
        sequence: 0,
        flightHours: 2.3,
      },
      {
        suffix: '02',
        reportNumber: 'FR-2026-ZERO-HOURS',
        sequence: 1,
        flightHours: 0,
      },
      {
        suffix: '03',
        reportNumber: 'FR-2026-NEGATIVE-HOURS',
        sequence: 1,
        flightHours: -1,
      },
    ];

    for (const testCase of cases) {
      const reportID = `61000000-0000-0000-0000-0000000000${testCase.suffix}`;
      const legID = `61100000-0000-0000-0000-0000000000${testCase.suffix}`;
      const draftUrl = await createDraft(reportID, testCase.reportNumber);

      const response = await POST(`${draftUrl}/legs`, {
        ID: legID,
        sequence: testCase.sequence,
        flightDate: '2026-08-20',
        originAirportCode: 'SVVA',
        destinationAirportCode: 'SKRG',
        flightHours: testCase.flightHours,
      });

      expect(response.status).to.equal(201);
      await expectActivationRejected(draftUrl);
    }
  });

  it('rejects activation for non-positive hour-meter values', async () => {
    const cases = [
      {
        suffix: '01',
        reportNumber: 'FR-2026-ZERO-HOURMETER',
        hourMeterStart: 0,
        hourMeterEnd: 100,
      },
      {
        suffix: '02',
        reportNumber: 'FR-2026-NEGATIVE-HOURMETER',
        hourMeterStart: 100,
        hourMeterEnd: -1,
      },
    ];

    for (const testCase of cases) {
      const reportID = `62000000-0000-0000-0000-0000000000${testCase.suffix}`;
      const legID = `62100000-0000-0000-0000-0000000000${testCase.suffix}`;
      const draftUrl = await createDraft(reportID, testCase.reportNumber);

      const response = await POST(`${draftUrl}/legs`, {
        ID: legID,
        sequence: 1,
        flightDate: '2026-08-20',
        originAirportCode: 'SVVA',
        destinationAirportCode: 'SKRG',
        flightHours: 2.3,
        hourMeterStart: testCase.hourMeterStart,
        hourMeterEnd: testCase.hourMeterEnd,
      });

      expect(response.status).to.equal(201);
      await expectActivationRejected(draftUrl);
    }
  });

  it('rejects activation for non-positive fuel quantities', async () => {
    const cases = [
      {
        suffix: '01',
        reportNumber: 'FR-2026-ZERO-FUEL',
        fuelQuantityLiters: 0,
      },
      {
        suffix: '02',
        reportNumber: 'FR-2026-NEGATIVE-FUEL',
        fuelQuantityLiters: -1,
      },
    ];

    for (const testCase of cases) {
      const reportID = `64000000-0000-0000-0000-0000000000${testCase.suffix}`;
      const expenseID = `64100000-0000-0000-0000-0000000000${testCase.suffix}`;
      const draftUrl = await createDraft(reportID, testCase.reportNumber);

      const response = await POST(`${draftUrl}/expenses`, {
        ID: expenseID,
        category_ID: masterDataIDs.fuelCategory,
        expenseDate: '2026-08-20',
        description: 'Invalid fuel quantity test',
        originalAmount: 100,
        originalCurrency_code: 'USD',
        fuelQuantityLiters: testCase.fuelQuantityLiters,
      });

      expect(response.status).to.equal(201);
      await expectActivationRejected(draftUrl);
    }
  });
});
