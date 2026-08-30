import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';

async function activate(
  draftUrl: string,
  acceptedStatus: number,
): Promise<void> {
  const response = await POST(
    `${draftUrl}/ExpenseService.draftActivate`,
    {},
    {
      headers: {
        'If-Match': '*',
      },
      validateStatus: (status: number) => status === acceptedStatus,
    },
  );

  expect(response.status).to.equal(acceptedStatus);
}

describe('ExpenseService uniqueness validations', () => {
  it('does not allocate report numbers while reports are drafts', async () => {
    const firstID = '70000000-0000-0000-0000-000000000001';
    const secondID = '70000000-0000-0000-0000-000000000002';

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: firstID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'First report',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);
    expect(response.data.reportNumber).to.equal(null);

    const firstDraftUrl = `${baseUrl}/FlightReports(ID=${firstID},IsActiveEntity=false)`;
    await activate(firstDraftUrl, 201);

    response = await POST(`${baseUrl}/FlightReports`, {
      ID: secondID,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Duplicate report',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);
    expect(response.data.reportNumber).to.equal(null);

    const secondDraftUrl = `${baseUrl}/FlightReports(ID=${secondID},IsActiveEntity=false)`;
    await activate(secondDraftUrl, 201);
  });

  it('allocates consecutive leg sequences within one report', async () => {
    const reportID = '71000000-0000-0000-0000-000000000001';
    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-AUTOMATIC-LEG-SEQUENCE',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Automatic sequence test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    const legs = [
      {
        ID: '71100000-0000-0000-0000-000000000001',
        origin: 'SVVA',
        destination: 'SKRG',
        expectedSequence: 1,
      },
      {
        ID: '71100000-0000-0000-0000-000000000002',
        origin: 'SKRG',
        destination: 'SVVA',
        expectedSequence: 2,
      },
    ];

    for (const leg of legs) {
      // Clients omit sequence because the service owns creation-order numbering.
      response = await POST(`${draftUrl}/legs`, {
        ID: leg.ID,
        flightDate: '2026-08-20',
        originAirportCode: leg.origin,
        destinationAirportCode: leg.destination,
        flightHours: 2.3,
      });

      expect(response.status).to.equal(201);
      expect(response.data.sequence).to.equal(leg.expectedSequence);
    }

    await activate(draftUrl, 201);
  });

  it('rejects assigning the same crew member twice to one report', async () => {
    const reportID = '72000000-0000-0000-0000-000000000001';
    const draftUrl = `${baseUrl}/FlightReports(ID=${reportID},IsActiveEntity=false)`;

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-DUPLICATE-CREW',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Duplicate crew test',
      status: 'DRAFT',
    });

    expect(response.status).to.equal(201);

    for (const assignment of [
      {
        ID: '72100000-0000-0000-0000-000000000001',
        role: 'CAPTAIN',
      },
      {
        ID: '72100000-0000-0000-0000-000000000002',
        role: 'FIRST_OFFICER',
      },
    ]) {
      response = await POST(`${draftUrl}/crew`, {
        ID: assignment.ID,
        crewMember_ID: masterDataIDs.captain,
        role: assignment.role,
      });

      expect(response.status).to.equal(201);
    }

    await activate(draftUrl, 409);
  });
});
