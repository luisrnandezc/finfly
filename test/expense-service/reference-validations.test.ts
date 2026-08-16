import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';
const nonexistentID = '99999999-0000-0000-0000-000000000001';

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

describe('ExpenseService reference validations', () => {
  it('rejects a report with a nonexistent aircraft', async () => {
    const reportID = '80000000-0000-0000-0000-000000000001';
    const response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-INVALID-AIRCRAFT',
      aircraft_ID: nonexistentID,
      requesterName: 'Reference validation test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;
    await expectActivationRejected(draftUrl);
  });

  it('rejects a report with a nonexistent crew member', async () => {
    const reportID = '80000000-0000-0000-0000-000000000002';
    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-INVALID-CREW',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Reference validation test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/crew`, {
      ID: '82000000-0000-0000-0000-000000000001',
      crewMember_ID: nonexistentID,
      role: 'CAPTAIN',
    });

    expect(response.status).to.equal(201);
    await expectActivationRejected(draftUrl);
  });

  it('rejects an expense with a nonexistent category', async () => {
    const reportID = '80000000-0000-0000-0000-000000000003';
    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-INVALID-CATEGORY',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Reference validation test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: '83000000-0000-0000-0000-000000000001',
      category_ID: nonexistentID,
      expenseDate: '2026-08-20',
      description: 'Invalid category test',
      originalAmount: 100,
      originalCurrency_code: 'USD',
    });

    expect(response.status).to.equal(201);
    await expectActivationRejected(draftUrl);
  });

  it('rejects an expense with a nonexistent currency', async () => {
    const reportID = '80000000-0000-0000-0000-000000000004';
    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-INVALID-CURRENCY',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Reference validation test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: '83000000-0000-0000-0000-000000000002',
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-20',
      description: 'Invalid currency test',
      originalAmount: 100,
      originalCurrency_code: 'ZZZ',
    });

    expect(response.status).to.equal(201);
    await expectActivationRejected(draftUrl);
  });
});
