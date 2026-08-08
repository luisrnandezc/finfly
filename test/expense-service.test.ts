import cds from '@sap/cds';

const { GET, POST, expect } = cds.test('serve', 'all', '--in-memory');

const baseUrl = '/expenses';

const IDs = {
  report: '40000000-0000-0000-0000-000000000001',
  outboundLeg: '41000000-0000-0000-0000-000000000001',
  returnLeg: '41000000-0000-0000-0000-000000000002',
  captainAssignment: '42000000-0000-0000-0000-000000000001',
  firstOfficerAssignment: '42000000-0000-0000-0000-000000000002',
  vesExpense: '43000000-0000-0000-0000-000000000001',
  usdExpense: '43000000-0000-0000-0000-000000000002',
};

describe('ExpenseService', () => {
  it('exposes the seeded expense categories', async () => {
    const { data, status } = await GET(`${baseUrl}/ExpenseCategories`);

    expect(status).to.equal(200);
    expect(data.value).to.have.length(10);

    const fuelCategory = data.value.find(
      (category: { code: string }) => category.code === 'FUEL',
    );

    if (!fuelCategory) {
      throw new Error('FUEL expense category was not loaded');
    }

    expect(fuelCategory.ID).to.equal('10000000-0000-0000-0000-000000000001');
    expect(fuelCategory.name).to.equal('Combustible');
    expect(fuelCategory.description).to.equal('Combustible para la aeronave');
    expect(fuelCategory.active).to.equal(true);
  });

  it('creates and activates a complete flight report', async () => {
    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: IDs.report,
      reportNumber: 'FR-2026-0001',
      aircraft_ID: '20000000-0000-0000-0000-000000000001',
      requesterName: 'Julián Sierra (FIBEX)',
      status: 'DRAFT',
      notes: 'Automated test report',
    });

    expect(response.status).to.equal(201);
    expect(response.data.IsActiveEntity).to.equal(false);

    const draftUrl =
      `${baseUrl}/FlightReports(ID=${IDs.report},IsActiveEntity=false)`;

    response = await POST(`${draftUrl}/legs`, {
      ID: IDs.outboundLeg,
      sequence: 1,
      flightDate: '2026-08-12',
      originAirportCode: 'SVVA',
      destinationAirportCode: 'SKRG',
      flightHours: 2.3,
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/legs`, {
      ID: IDs.returnLeg,
      sequence: 2,
      flightDate: '2026-08-15',
      originAirportCode: 'SKRG',
      destinationAirportCode: 'SVVA',
      flightHours: 2.2,
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/crew`, {
      ID: IDs.captainAssignment,
      crewMember_ID: '30000000-0000-0000-0000-000000000001',
      role: 'CAPTAIN',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/crew`, {
      ID: IDs.firstOfficerAssignment,
      crewMember_ID: '30000000-0000-0000-0000-000000000002',
      role: 'FIRST_OFFICER',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: IDs.vesExpense,
      leg_ID: IDs.outboundLeg,
      category_ID: '10000000-0000-0000-0000-000000000003',
      expenseDate: '2026-08-12',
      description: 'FBO y/o DOSA',
      originalAmount: 180000,
      originalCurrency_code: 'VES',
    });

    expect(response.status).to.equal(201);

    response = await POST(`${draftUrl}/expenses`, {
      ID: IDs.usdExpense,
      category_ID: '10000000-0000-0000-0000-000000000003',
      expenseDate: '2026-08-14',
      description: 'FBO Colombia',
      originalAmount: 1800,
      originalCurrency_code: 'USD',
    });

    expect(response.status).to.equal(201);

    response = await POST(
      `${draftUrl}/ExpenseService.draftActivate`,
      {},
    );

    expect([200, 201]).to.include(response.status);
    expect(response.data.IsActiveEntity).to.equal(true);

    const activeUrl =
      `${baseUrl}/FlightReports(ID=${IDs.report},IsActiveEntity=true)`;

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
      (expense: { ID: string }) => expense.ID === IDs.vesExpense,
    );

    expect(vesExpense).to.exist;
    expect(vesExpense.leg_ID).to.equal(IDs.outboundLeg);
    expect(vesExpense.originalAmount).to.equal(180000);
    expect(vesExpense.originalCurrency_code).to.equal('VES');

    const usdExpense = response.data.expenses.find(
      (expense: { ID: string }) => expense.ID === IDs.usdExpense,
    );

    expect(usdExpense).to.exist;
    expect(usdExpense.leg_ID).to.equal(null);
    expect(usdExpense.originalAmount).to.equal(1800);
    expect(usdExpense.originalCurrency_code).to.equal('USD');
  });
});
