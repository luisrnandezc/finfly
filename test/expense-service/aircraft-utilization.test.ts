import cds from '@sap/cds';

import { expenseServiceTest } from '../support/expense-service-test';
import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = expenseServiceTest();
const { INSERT } = cds.ql;

const baseUrl = '/expenses';
const pilotConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'pilot', password: 'pilot' },
};

async function seedCompleteDraftReport(
  reportID: string,
  hours: number[],
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports, FlightLegs, CrewAssignments, Expenses } =
    cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID: reportID,
      organization_ID: masterDataIDs.organization,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Aircraft utilization test',
      totalFlightHours: hours.reduce((sum, value) => sum + value, 0),
      status: 'DRAFT',
      auditStatus: 'NOT_STARTED',
    }),
  );

  for (const [index, flightHours] of hours.entries()) {
    await db.run(
      INSERT.into(FlightLegs).entries({
        ID: cds.utils.uuid(),
        report_ID: reportID,
        sequence: index + 1,
        flightDate: '2026-09-10',
        originAirportCode: index === 0 ? 'SVMI' : 'TNCC',
        destinationAirportCode: index === 0 ? 'TNCC' : 'SVMI',
        flightHours,
      }),
    );
  }

  await db.run(
    INSERT.into(CrewAssignments).entries({
      ID: cds.utils.uuid(),
      report_ID: reportID,
      crewMember_ID: masterDataIDs.captain,
      role: 'PIC',
    }),
  );
  await db.run(
    INSERT.into(Expenses).entries({
      ID: cds.utils.uuid(),
      report_ID: reportID,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-09-10',
      originalAmount: 100,
      originalCurrency_code: 'USD',
      auditStatus: 'DRAFT',
    }),
  );
}

async function aircraftUtilization(): Promise<{
  currentFlightHours: number;
  totalCycles: number;
}> {
  const response = await GET(
    `${baseUrl}/Aircraft(${masterDataIDs.aircraft})`,
    pilotConfiguration,
  );
  return response.data;
}

function reportUrl(reportID: string): string {
  return `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=true)`;
}

describe('ExpenseService aircraft utilization', () => {
  it('posts flight hours and one cycle per leg when a report is submitted', async () => {
    const reportID = '95000000-0000-0000-0000-000000000001';
    const before = await aircraftUtilization();
    await seedCompleteDraftReport(reportID, [1.25, 2.5]);

    const response = await POST(
      `${reportUrl(reportID)}/ExpenseService.submit`,
      {},
      pilotConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.postedFlightHours).to.equal(3.75);
    expect(response.data.postedCycles).to.equal(2);
    expect(response.data.aircraftHoursAfterPosting).to.equal(
      Number(before.currentFlightHours) + 3.75,
    );
    expect(response.data.aircraftCyclesAfterPosting).to.equal(
      Number(before.totalCycles) + 2,
    );
    expect(response.data.utilizationPosted).to.equal(true);
    expect(response.data.utilizationPostedAt).to.exist;

    const after = await aircraftUtilization();
    expect(after.currentFlightHours).to.equal(
      Number(before.currentFlightHours) + 3.75,
    );
    expect(after.totalCycles).to.equal(Number(before.totalCycles) + 2);
  });

  it('accumulates contributions from multiple reports on one aircraft', async () => {
    const firstReportID = '95000000-0000-0000-0000-000000000002';
    const secondReportID = '95000000-0000-0000-0000-000000000003';
    const before = await aircraftUtilization();
    await seedCompleteDraftReport(firstReportID, [1.1]);
    await seedCompleteDraftReport(secondReportID, [2.2, 1.3]);

    const firstResponse = await POST(
      `${reportUrl(firstReportID)}/ExpenseService.submit`,
      {},
      pilotConfiguration,
    );
    const secondResponse = await POST(
      `${reportUrl(secondReportID)}/ExpenseService.submit`,
      {},
      pilotConfiguration,
    );

    const after = await aircraftUtilization();
    expect(after.currentFlightHours).to.equal(
      Number(before.currentFlightHours) + 4.6,
    );
    expect(after.totalCycles).to.equal(Number(before.totalCycles) + 3);
    expect(secondResponse.data.aircraftHoursAfterPosting).to.be.greaterThan(
      firstResponse.data.aircraftHoursAfterPosting,
    );
    expect(secondResponse.data.aircraftCyclesAfterPosting).to.be.greaterThan(
      firstResponse.data.aircraftCyclesAfterPosting,
    );
  });

  it('does not post utilization twice when submission is repeated', async () => {
    const reportID = '95000000-0000-0000-0000-000000000004';
    await seedCompleteDraftReport(reportID, [1.5]);
    await POST(
      `${reportUrl(reportID)}/ExpenseService.submit`,
      {},
      pilotConfiguration,
    );
    const afterFirstSubmission = await aircraftUtilization();

    const response = await POST(
      `${reportUrl(reportID)}/ExpenseService.submit`,
      {},
      {
        ...pilotConfiguration,
        validateStatus: (status: number) => status === 409,
      },
    );

    expect(response.status).to.equal(409);
    const afterRepeatedSubmission = await aircraftUtilization();
    expect(afterRepeatedSubmission).to.deep.equal(afterFirstSubmission);
  });
});
