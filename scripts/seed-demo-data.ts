/**
 * Creates reusable UI demo scenarios through FinFly's OData services.
 * Run `cds watch` first, then execute `npm run seed:demo` in another terminal.
 */
const baseUrl = (process.env.FINFLY_URL ?? 'http://localhost:4004').replace(
  /\/$/,
  '',
);

const pilotAuthorization = basicAuthorization('pilot', 'pilot');
const auditorAuthorization = basicAuthorization('auditor', 'auditor');

const masterData = {
  organization: '50000000-0000-0000-0000-000000000001',
  aircraft: '20000000-0000-0000-0000-000000000001',
  captain: '30000000-0000-0000-0000-000000000001',
  firstOfficer: '30000000-0000-0000-0000-000000000002',
  fuel: '10000000-0000-0000-0000-000000000001',
  hotel: '10000000-0000-0000-0000-000000000002',
  fbo: '10000000-0000-0000-0000-000000000003',
  transport: '10000000-0000-0000-0000-000000000005',
} as const;

type FinalState = 'DRAFT' | 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED';

interface DemoScenario {
  name: string;
  reportID: string;
  legIDs: [string, string];
  crewIDs: [string, string];
  expenseIDs: [string, string, string];
  requesterName: string;
  notes: string;
  outboundDate: string;
  returnDate: string;
  origin: string;
  destination: string;
  finalState: FinalState;
}

const scenarios: DemoScenario[] = [
  scenario('1', 'Draft report for pilot editing', 'DRAFT'),
  scenario('2', 'New report awaiting audit', 'PENDING'),
  scenario('3', 'Report requiring a pilot correction', 'ACTION_REQUIRED'),
  scenario('4', 'Fully approved report', 'APPROVED'),
];

async function main(): Promise<void> {
  await verifyServer();

  console.log(`Seeding FinFly demo data at ${baseUrl}\n`);

  for (const demo of scenarios) {
    if (await reportExists(demo.reportID)) {
      console.log(`SKIP   ${demo.name} (already exists)`);
      continue;
    }

    await createScenario(demo);
    console.log(`CREATE ${demo.name}`);
  }

  console.log('\nDemo data is ready.');
  console.log('Pilot UI:  /finfly.flightreports/index.html');
  console.log('Audit UI:  /finfly.audit/index.html');
}

async function createScenario(demo: DemoScenario): Promise<void> {
  await request('/expenses/FlightReports', pilotAuthorization, {
    method: 'POST',
    body: {
      ID: demo.reportID,
      // Explicit for API-driven draft creation; the value is the pilot's organization.
      organization_ID: masterData.organization,
      aircraft_ID: masterData.aircraft,
      requesterName: demo.requesterName,
      notes: demo.notes,
    },
  });

  const draftUrl =
    `/expenses/FlightReports(ID=${demo.reportID},IsActiveEntity=false)`;

  await request(`${draftUrl}/legs`, pilotAuthorization, {
    method: 'POST',
    body: {
      ID: demo.legIDs[0],
      sequence: 1,
      flightDate: demo.outboundDate,
      originAirportCode: demo.origin,
      destinationAirportCode: demo.destination,
      flightHours: 2.25,
    },
  });

  await request(`${draftUrl}/legs`, pilotAuthorization, {
    method: 'POST',
    body: {
      ID: demo.legIDs[1],
      sequence: 2,
      flightDate: demo.returnDate,
      originAirportCode: demo.destination,
      destinationAirportCode: demo.origin,
      flightHours: 2.15,
    },
  });

  await request(`${draftUrl}/crew`, pilotAuthorization, {
    method: 'POST',
    body: {
      ID: demo.crewIDs[0],
      crewMember_ID: masterData.captain,
      role: 'PIC',
    },
  });

  await request(`${draftUrl}/crew`, pilotAuthorization, {
    method: 'POST',
    body: {
      ID: demo.crewIDs[1],
      crewMember_ID: masterData.firstOfficer,
      role: 'SIC',
    },
  });

  const expenses = [
    {
      ID: demo.expenseIDs[0],
      leg_ID: demo.legIDs[0],
      category_ID: masterData.fuel,
      expenseDate: demo.outboundDate,
      description: 'Jet A-1 fuel uplift',
      supplier: 'Caracas Aviation Fuel',
      receiptNumber: `DEMO-${demo.reportID.slice(7, 8)}-FUEL`,
      originalAmount: 1250,
      originalCurrency_code: 'USD',
    },
    {
      ID: demo.expenseIDs[1],
      leg_ID: demo.legIDs[0],
      category_ID: masterData.fbo,
      expenseDate: demo.outboundDate,
      description: 'FBO and ground handling services',
      supplier: 'Destination Ground Services',
      receiptNumber: `DEMO-${demo.reportID.slice(7, 8)}-FBO`,
      originalAmount: 420,
      originalCurrency_code: 'USD',
    },
    {
      ID: demo.expenseIDs[2],
      category_ID:
        demo.finalState === 'ACTION_REQUIRED'
          ? masterData.transport
          : masterData.hotel,
      expenseDate: demo.returnDate,
      description: 'Report-level crew expense',
      supplier: 'Crew Services Provider',
      receiptNumber: `DEMO-${demo.reportID.slice(7, 8)}-CREW`,
      originalAmount: 185,
      originalCurrency_code: 'USD',
    },
  ];

  for (const expense of expenses) {
    await request(`${draftUrl}/expenses`, pilotAuthorization, {
      method: 'POST',
      body: expense,
    });
  }

  // Keep one complete report as a draft for testing the pilot edit flow.
  if (demo.finalState === 'DRAFT') return;

  await request(
    `${draftUrl}/ExpenseService.draftActivate`,
    pilotAuthorization,
    { method: 'POST', body: {}, ifMatch: true },
  );

  const activeUrl =
    `/expenses/FlightReports(ID=${demo.reportID},IsActiveEntity=true)`;

  await request(`${activeUrl}/ExpenseService.submit`, pilotAuthorization, {
    method: 'POST',
    body: {},
    ifMatch: true,
  });

  if (demo.finalState === 'ACTION_REQUIRED') {
    await request(
      `/audit/Expenses(ID=${demo.expenseIDs[2]})/AuditService.requestExpenseCorrection`,
      auditorAuthorization,
      {
        method: 'POST',
        body: { reason: 'Please confirm the supplier and attach the receipt.' },
        ifMatch: true,
      },
    );
  }

  if (demo.finalState === 'APPROVED') {
    await request(
      `/audit/FlightReports(ID=${demo.reportID})/AuditService.approveAllExpenses`,
      auditorAuthorization,
      { method: 'POST', body: {}, ifMatch: true },
    );
  }
}

async function reportExists(reportID: string): Promise<boolean> {
  const active = await request(
    `/expenses/FlightReports(ID=${reportID},IsActiveEntity=true)?$select=ID`,
    pilotAuthorization,
    { allowNotFound: true },
  );

  if (active !== undefined) return true;

  const draft = await request(
    `/expenses/FlightReports(ID=${reportID},IsActiveEntity=false)?$select=ID&$expand=legs($select=sequence)`,
    pilotAuthorization,
    { allowNotFound: true },
  );

  if (draft === undefined) return false;

  const draftData = draft as { legs?: Array<{ sequence?: number | null }> };
  const hasIncompleteLeg = draftData.legs?.some(
    ({ sequence }) => sequence == null,
  );

  // A prior interrupted run may have left one of our fixed-ID drafts incomplete.
  if (hasIncompleteLeg) {
    await request(
      `/expenses/FlightReports(ID=${reportID},IsActiveEntity=false)`,
      pilotAuthorization,
      { method: 'DELETE', ifMatch: true },
    );
    return false;
  }

  return true;
}

async function verifyServer(): Promise<void> {
  try {
    await request('/expenses/', pilotAuthorization);
  } catch (error) {
    throw new Error(
      `FinFly is not available at ${baseUrl}. Start "cds watch" first.\n${errorMessage(error)}`,
    );
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  ifMatch?: boolean;
  allowNotFound?: boolean;
}

async function request(
  path: string,
  authorization: string,
  options: RequestOptions = {},
): Promise<unknown | undefined> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(options.ifMatch ? { 'If-Match': '*' } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (options.allowNotFound && response.status === 404) return undefined;

  const responseText = await response.text();
  const responseBody = responseText ? safeJson(responseText) : undefined;

  if (!response.ok) {
    const serviceMessage = extractServiceMessage(responseBody);
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed with ${response.status}` +
        (serviceMessage ? `: ${serviceMessage}` : ''),
    );
  }

  return responseBody;
}

function scenario(
  number: string,
  name: string,
  finalState: FinalState,
): DemoScenario {
  return {
    name,
    reportID: `7100000${number}-0000-0000-0000-000000000001`,
    legIDs: [
      `7110000${number}-0000-0000-0000-000000000001`,
      `7110000${number}-0000-0000-0000-000000000002`,
    ],
    crewIDs: [
      `7120000${number}-0000-0000-0000-000000000001`,
      `7120000${number}-0000-0000-0000-000000000002`,
    ],
    expenseIDs: [
      `7130000${number}-0000-0000-0000-000000000001`,
      `7130000${number}-0000-0000-0000-000000000002`,
      `7130000${number}-0000-0000-0000-000000000003`,
    ],
    requesterName: 'FinFly Demo Operations',
    notes: `${name}. Generated by npm run seed:demo.`,
    outboundDate: `2026-09-${10 + Number(number)}`,
    returnDate: `2026-09-${11 + Number(number)}`,
    origin: 'SVMI',
    destination: number === '2' ? 'TNCC' : 'SKBO',
    finalState,
  };
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractServiceMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(`\nDemo data creation failed:\n${errorMessage(error)}`);
  process.exitCode = 1;
});
