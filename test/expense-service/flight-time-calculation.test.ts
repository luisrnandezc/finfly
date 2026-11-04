import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { POST, expect } = expenseServiceTest();

describe('ExpenseService flight-time calculation', () => {
  it('calculates flight hours from takeoff and landing times', async () => {
    const reportID = '69000000-0000-0000-0000-000000000001';
    const report = await POST('/expenses/FlightReports', {
      ID: reportID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Flight-time calculation test',
    });
    expect(report.status).to.equal(201);

    const leg = await POST(
      `/expenses/FlightReports(ID=${reportID},IsActiveEntity=false)/legs`,
      {
        ID: '69100000-0000-0000-0000-000000000001',
        flightDate: '2026-11-04',
        originAirportCode: 'SVMI',
        destinationAirportCode: 'TNCC',
        takeoffTime: '10:10:00',
        landingTime: '11:45:00',
      },
    );

    expect(leg.status).to.equal(201);
    expect(leg.data.flightHours).to.equal(1.6);
  });
});
