import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';
const currentYear = new Date().getUTCFullYear();

const pilotActionConfiguration = {
  headers: { 'If-Match': '*' },
};

const otherPilotConfiguration = {
  headers: { 'If-Match': '*' },
  auth: { username: 'otherpilot', password: 'otherpilot' },
};

function draftReportUrl(ID: string): string {
  return `${baseUrl}/FlightReports(ID=${ID},IsActiveEntity=false)`;
}

async function createAndSubmitReport(
  reportID: string,
  childIDPrefix: string,
  aircraftID: string,
  configuration: Record<string, unknown> = pilotActionConfiguration,
) {
  let response = await POST(
    `${baseUrl}/FlightReports`,
    { ID: reportID, aircraft_ID: aircraftID },
    configuration,
  );

  expect(response.data.reportNumber).to.equal(null);

  const draftUrl = draftReportUrl(reportID);

  await POST(
    `${draftUrl}/legs`,
    {
      ID: `${childIDPrefix}0000-0000-0000-000000000001`,
      flightDate: '2026-08-20',
      originAirportCode: 'SVMI',
      destinationAirportCode: 'SVVA',
      flightHours: 1,
    },
    configuration,
  );

  await POST(
    `${draftUrl}/crew`,
    {
      ID: `${childIDPrefix}0000-0000-0000-000000000002`,
      crewMember_ID:
        aircraftID === masterDataIDs.otherAircraft
          ? masterDataIDs.otherCrewMember
          : masterDataIDs.captain,
      role: 'PIC',
    },
    configuration,
  );

  await POST(
    `${draftUrl}/expenses`,
    {
      ID: `${childIDPrefix}0000-0000-0000-000000000003`,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-20',
      originalAmount: 100,
      originalCurrency_code: 'USD',
    },
    configuration,
  );

  await POST(
    `${draftUrl}/ExpenseService.draftActivate`,
    {},
    configuration,
  );

  response = await POST(
    `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=true)/ExpenseService.submit`,
    {},
    configuration,
  );

  return response.data;
}

describe('ExpenseService organization isolation', () => {
  it('allocates sequential report numbers independently per organization', async () => {
    const firstReportID = 'a0000000-0000-0000-0000-000000000001';
    const secondReportID = 'a0000000-0000-0000-0000-000000000002';
    const otherReportID = 'a0000000-0000-0000-0000-000000000003';

    let report = await createAndSubmitReport(
      firstReportID,
      'a100',
      masterDataIDs.aircraft,
    );

    expect(report.organization_ID).to.equal(masterDataIDs.organization);
    expect(report.reportNumber).to.equal(`FR-${currentYear}-000001`);

    report = await createAndSubmitReport(
      secondReportID,
      'a200',
      masterDataIDs.aircraft,
    );

    expect(report.reportNumber).to.equal(`FR-${currentYear}-000002`);

    report = await createAndSubmitReport(
      otherReportID,
      'a300',
      masterDataIDs.otherAircraft,
      otherPilotConfiguration,
    );

    expect(report.organization_ID).to.equal(masterDataIDs.otherOrganization);
    expect(report.reportNumber).to.equal(`FR-${currentYear}-000001`);
  });

  it('returns only aircraft belonging to the authenticated organization', async () => {
    let response = await GET(`${baseUrl}/Aircraft`);

    expect(response.data.value).to.have.length(1);
    expect(response.data.value[0].ID).to.equal(masterDataIDs.aircraft);

    response = await GET(`${baseUrl}/Aircraft`, otherPilotConfiguration);

    expect(response.data.value).to.have.length(1);
    expect(response.data.value[0].ID).to.equal(masterDataIDs.otherAircraft);
  });

  it('prevents activating a report with another organization aircraft', async () => {
    const reportID = 'a0000000-0000-0000-0000-000000000004';

    await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      aircraft_ID: masterDataIDs.otherAircraft,
    });

    const response = await POST(
      `${draftReportUrl(reportID)}/ExpenseService.draftActivate`,
      {},
      {
        ...pilotActionConfiguration,
        validateStatus: (status: number) => status === 400,
      },
    );

    expect(response.data.error.message).to.equal(
      'The selected aircraft does not belong to this organization',
    );
  });

  it('does not expose another organization flight reports', async () => {
    const reportID = 'a0000000-0000-0000-0000-000000000005';

    await POST(
      `${baseUrl}/FlightReports`,
      {
        ID: reportID,
        aircraft_ID: masterDataIDs.otherAircraft,
      },
      otherPilotConfiguration,
    );

    await POST(
      `${draftReportUrl(reportID)}/ExpenseService.draftActivate`,
      {},
      otherPilotConfiguration,
    );

    const response = await GET(
      `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=true)`,
      { validateStatus: (status: number) => status === 404 },
    );

    expect(response.status).to.equal(404);
  });
});
