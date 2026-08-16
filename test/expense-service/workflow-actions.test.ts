import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = cds.test('serve', 'all', '--in-memory');

const { INSERT } = cds.ql;

const baseUrl = '/expenses';

type WorkflowStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

async function seedActiveReport(
  ID: string,
  reportNumber: string,
  status: WorkflowStatus,
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      reportNumber,
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Workflow action test',
      status,
    }),
  );
}

function activeReportUrl(ID: string): string {
  return `${baseUrl}/FlightReports(` + `ID=${ID},IsActiveEntity=true)`;
}

const pilotActionConfiguration = {
  headers: {
    'If-Match': '*',
  },
  auth: {
    username: 'pilot',
    password: 'pilot',
  },
};

const auditorActionConfiguration = {
  headers: {
    'If-Match': '*',
  },
  auth: {
    username: 'auditor',
    password: 'auditor',
  },
};

describe('ExpenseService workflow actions', () => {
  it('rejects a submitted report and records the reason', async () => {
    const reportID = '90000000-0000-0000-0000-000000000001';

    await seedActiveReport(reportID, 'FR-2026-REJECTION', 'SUBMITTED');

    const reportUrl = activeReportUrl(reportID);
    const reason = 'The fuel receipt is unreadable';

    let response = await POST(
      `${reportUrl}/ExpenseService.rejectReport`,
      { reason },
      auditorActionConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('REJECTED');
    expect(response.data.rejectionReason).to.equal(reason);
    expect(response.data.reviewedAt).to.exist;
    expect(response.data.reviewedBy).to.exist;

    response = await GET(`${reportUrl}?$expand=statusHistory`);

    expect(response.status).to.equal(200);
    expect(response.data.statusHistory).to.have.length(1);

    const history = response.data.statusHistory[0];

    expect(history.fromStatus).to.equal('SUBMITTED');
    expect(history.toStatus).to.equal('REJECTED');
    expect(history.comment).to.equal(reason);
    expect(history.createdBy).to.exist;
  });

  it('rejects approval of a report that was not submitted', async () => {
    const reportID = '90000000-0000-0000-0000-000000000002';

    await seedActiveReport(reportID, 'FR-2026-INVALID-APPROVAL', 'DRAFT');

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.approve`,
      {
        comment: 'This must not be accepted',
      },
      {
        ...auditorActionConfiguration,
        validateStatus: (status: number) => status === 409,
      },
    );

    expect(response.status).to.equal(409);
    expect(response.data.error.message).to.equal(
      `Flight report FR-2026-INVALID-APPROVAL cannot be approved because its status is DRAFT`,
    );
  });

  it('requires a meaningful rejection reason', async () => {
    const reportID = '90000000-0000-0000-0000-000000000003';

    await seedActiveReport(reportID, 'FR-2026-MISSING-REASON', 'SUBMITTED');

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.rejectReport`,
      {
        reason: '   ',
      },
      {
        ...auditorActionConfiguration,
        validateStatus: (status: number) => status === 400,
      },
    );

    // The CDS `not null` constraint rejects blank action parameters
    // before the custom action handler is executed.
    expect(response.status).to.equal(400);
    expect(response.data.error.message).to.equal('Provide the missing value.');
  });

  it('prevents clients from setting the workflow status directly', async () => {
    const reportID = '90000000-0000-0000-0000-000000000004';

    const response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-DIRECT-STATUS',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Direct status test',

      // A malicious or incorrect client attempts to bypass
      // the submit and approve actions.
      status: 'APPROVED',
    });

    expect(response.status).to.equal(201);
    expect(response.data.IsActiveEntity).to.equal(false);

    // `status` is read-only in the service, so CAP ignores
    // APPROVED and applies the database default instead.
    expect(response.data.status).to.equal('DRAFT');
  });

  it('prevents editing a submitted report', async () => {
    const reportID = '90000000-0000-0000-0000-000000000005';

    await seedActiveReport(reportID, 'FR-2026-SUBMITTED-LOCKED', 'SUBMITTED');

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.draftEdit`,
      {
        PreserveChanges: false,
      },
      {
        ...pilotActionConfiguration,
        validateStatus: (status: number) => status === 409,
      },
    );

    expect(response.status).to.equal(409);
    expect(response.data.error.message).to.equal(
      'Flight report FR-2026-SUBMITTED-LOCKED cannot be edited because its status is SUBMITTED',
    );
  });

  it('allows a rejected report to enter edit mode', async () => {
    const reportID = '90000000-0000-0000-0000-000000000006';

    await seedActiveReport(reportID, 'FR-2026-REJECTED-EDITABLE', 'REJECTED');

    const response = await POST(
      `${activeReportUrl(reportID)}/ExpenseService.draftEdit`,
      {
        PreserveChanges: false,
      },
      pilotActionConfiguration,
    );

    expect(response.status).to.equal(201);
    expect(response.data.ID).to.equal(reportID);
    expect(response.data.IsActiveEntity).to.equal(false);
    expect(response.data.HasActiveEntity).to.equal(true);
    expect(response.data.status).to.equal('REJECTED');
  });
});
