import { flightReportIDs, masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest();

const baseUrl = '/expenses';

describe('ExpenseService flight report lifecycle', () => {
  it('creates, submits, and approves a complete flight report', async () => {
    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: flightReportIDs.report,
      reportNumber: 'FR-2026-0001',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Julián Sierra (FIBEX)',
      status: 'DRAFT',
      notes: 'Automated test report',
    });

    expect(response.status).to.equal(201);
    expect(response.data.IsActiveEntity).to.equal(false);

    const draftUrl =
      `${baseUrl}/FlightReports(` +
      `ID=${flightReportIDs.report},IsActiveEntity=false)`;

    response = await POST(`${draftUrl}/legs`, {
      ID: flightReportIDs.outboundLeg,
      sequence: 1,
      flightDate: '2026-08-12',
      originAirportCode: 'SVVA',
      destinationAirportCode: 'SKRG',
      flightHours: 2.3,
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/legs`, {
      ID: flightReportIDs.returnLeg,
      sequence: 2,
      flightDate: '2026-08-15',
      originAirportCode: 'SKRG',
      destinationAirportCode: 'SVVA',
      flightHours: 2.2,
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/crew`, {
      ID: flightReportIDs.captainAssignment,
      crewMember_ID: masterDataIDs.captain,
      role: 'CAPTAIN',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/crew`, {
      ID: flightReportIDs.firstOfficerAssignment,
      crewMember_ID: masterDataIDs.firstOfficer,
      role: 'FIRST_OFFICER',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: flightReportIDs.vesExpense,
      leg_ID: flightReportIDs.outboundLeg,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-12',
      description: 'FBO y/o DOSA',
      originalAmount: 180000,
      originalCurrency_code: 'VES',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: flightReportIDs.usdExpense,
      category_ID: masterDataIDs.fboCategory,
      expenseDate: '2026-08-14',
      description: 'FBO Colombia',
      originalAmount: 1800,
      originalCurrency_code: 'USD',
    });

    expect(response.status).to.equal(201);

    response = await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
      {
        headers: {
          'If-Match': '*',
        },
      },
    );

    expect([200, 201]).to.include(response.status);
    expect(response.data.IsActiveEntity).to.equal(true);

    const activeUrl =
      `${baseUrl}/FlightReports(` +
      `ID=${flightReportIDs.report},IsActiveEntity=true)`;

    response = await GET(`${activeUrl}?$expand=legs,crew,expenses`);

    expect(response.status).to.equal(200);
    expect(response.data.legs).to.have.length(2);
    expect(response.data.crew).to.have.length(2);
    expect(response.data.expenses).to.have.length(2);

    const totalFlightHours = response.data.legs.reduce(
      (total: number, leg: { flightHours: number }) =>
        total + Number(leg.flightHours),
      0,
    );

    expect(totalFlightHours).to.equal(4.5);

    const vesExpense = response.data.expenses.find(
      (expense: { ID: string }) => expense.ID === flightReportIDs.vesExpense,
    );

    expect(vesExpense).to.exist;
    expect(vesExpense.leg_ID).to.equal(flightReportIDs.outboundLeg);
    expect(vesExpense.originalAmount).to.equal(180000);
    expect(vesExpense.originalCurrency_code).to.equal('VES');

    const usdExpense = response.data.expenses.find(
      (expense: { ID: string }) => expense.ID === flightReportIDs.usdExpense,
    );

    expect(usdExpense).to.exist;
    expect(usdExpense.leg_ID).to.equal(null);
    expect(usdExpense.originalAmount).to.equal(1800);
    expect(usdExpense.originalCurrency_code).to.equal('USD');

    response = await POST(
      `${activeUrl}/ExpenseService.submit`,
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
    expect(response.data.status).to.equal('SUBMITTED');
    expect(response.data.submittedAt).to.exist;
    expect(response.data.submittedBy).to.equal('pilot');
    expect(response.data.rejectionReason).to.equal(null);

    response = await POST(
      `${activeUrl}/ExpenseService.approve`,
      {
        comment: 'Receipts and amounts verified',
      },
      {
        headers: {
          'If-Match': '*',
        },
        auth: {
          username: 'auditor',
          password: 'auditor',
        },
      },
    );

    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('APPROVED');
    expect(response.data.reviewedAt).to.exist;
    expect(response.data.reviewedBy).to.equal('auditor');
    expect(response.data.rejectionReason).to.equal(null);

    response = await GET(`${activeUrl}?$expand=statusHistory`);

    const submittedHistory = response.data.statusHistory.find(
      (entry: { toStatus: string }) => entry.toStatus === 'SUBMITTED',
    );

    expect(submittedHistory).to.exist;
    expect(submittedHistory.fromStatus).to.equal('DRAFT');
    expect(submittedHistory.comment).to.equal(
      'Flight report submitted for audit',
    );

    const approvedHistory = response.data.statusHistory.find(
      (entry: { toStatus: string }) => entry.toStatus === 'APPROVED',
    );

    expect(approvedHistory).to.exist;
    expect(approvedHistory.fromStatus).to.equal('SUBMITTED');
    expect(approvedHistory.comment).to.equal('Receipts and amounts verified');
  });
});
