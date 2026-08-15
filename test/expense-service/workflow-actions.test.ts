import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';

const { GET, POST, expect } = cds.test('serve', 'all', '--in-memory');

const { INSERT } = cds.ql;

const baseUrl = '/expenses';

type WorkflowStatus = 'DRAFT' | 'SUBMITTED';

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

const actionConfiguration = {
  headers: {
    'If-Match': '*',
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
      actionConfiguration,
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
        ...actionConfiguration,
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
        ...actionConfiguration,
        validateStatus: (status: number) => status === 400,
      },
    );

    // The CDS `not null` constraint rejects blank action parameters
    // before the custom action handler is executed.
    expect(response.status).to.equal(400);
    expect(response.data.error.message).to.equal('Provide the missing value.');
  });
});
