import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { DELETE, GET, PATCH, POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';

describe('ExpenseService flight report summary', () => {
  it('persists, recalculates, and protects the summary through submission', async () => {
    const reportID = '48000000-0000-0000-0000-000000000001';
    const firstLegID = '48100000-0000-0000-0000-000000000001';
    const secondLegID = '48100000-0000-0000-0000-000000000002';
    const draftUrl =
      `${baseUrl}/FlightReports(` + `ID=${reportID},IsActiveEntity=false)`;
    const activeUrl =
      `${baseUrl}/FlightReports(` + `ID=${reportID},IsActiveEntity=true)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Summary integration test',
      // These values must never override the server calculation.
      firstFlightDate: '2099-01-01',
      lastFlightDate: '2099-12-31',
      totalFlightHours: 999,
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/legs`, {
      ID: firstLegID,
      flightDate: '2026-08-15',
      originAirportCode: 'SKRG',
      destinationAirportCode: 'SVMI',
      flightHours: 2.2,
    });
    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/legs`, {
      ID: secondLegID,
      flightDate: '2026-08-12',
      originAirportCode: 'SVMI',
      destinationAirportCode: 'SKRG',
      flightHours: 1.15,
    });
    expect(response.status).to.equal(201);

    await POST(`${draftUrl}/crew`, {
      ID: '48200000-0000-0000-0000-000000000001',
      crewMember_ID: masterDataIDs.captain,
      role: 'PIC',
    });
    await POST(`${draftUrl}/expenses`, {
      ID: '48300000-0000-0000-0000-000000000001',
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-12',
      originalAmount: 100,
      originalCurrency_code: 'USD',
    });

    response = await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
      { headers: { 'If-Match': '*' } },
    );

    expect([200, 201]).to.include(response.status);
    expect(response.data.firstFlightDate).to.equal('2026-08-12');
    expect(response.data.lastFlightDate).to.equal('2026-08-15');
    expect(response.data.totalFlightHours).to.equal(3.35);

    response = await POST(
      `${activeUrl}/ExpenseService.draftEdit`,
      { PreserveChanges: false },
      { headers: { 'If-Match': '*' } },
    );
    expect(response.status).to.equal(201);

    response = await PATCH(
      `${baseUrl}/FlightLegs(ID=${firstLegID},IsActiveEntity=false)`,
      { flightDate: '2026-08-10', flightHours: 3.4 },
      { headers: { 'If-Match': '*' } },
    );
    expect([200, 204]).to.include(response.status);

    response = await DELETE(
      `${baseUrl}/FlightLegs(ID=${secondLegID},IsActiveEntity=false)`,
      { headers: { 'If-Match': '*' } },
    );
    expect(response.status).to.equal(204);

    response = await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
      { headers: { 'If-Match': '*' } },
    );

    expect([200, 201]).to.include(response.status);
    expect(response.data.firstFlightDate).to.equal('2026-08-10');
    expect(response.data.lastFlightDate).to.equal('2026-08-10');
    expect(response.data.totalFlightHours).to.equal(3.4);

    response = await POST(
      `${activeUrl}/ExpenseService.submit`,
      {},
      { headers: { 'If-Match': '*' } },
    );

    expect(response.status).to.equal(200);
    expect(response.data.firstFlightDate).to.equal('2026-08-10');
    expect(response.data.lastFlightDate).to.equal('2026-08-10');
    expect(response.data.totalFlightHours).to.equal(3.4);

    response = await GET(activeUrl);
    expect(response.data.firstFlightDate).to.equal('2026-08-10');
    expect(response.data.lastFlightDate).to.equal('2026-08-10');
    expect(response.data.totalFlightHours).to.equal(3.4);
  });
});
