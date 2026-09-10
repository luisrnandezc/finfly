import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';
import { expenseServiceTest } from '../support/expense-service-test';

const { GET, POST, expect } = expenseServiceTest();
const { INSERT } = cds.ql;

const baseUrl = '/expenses';
const pilotConfiguration = {
  auth: { username: 'pilot', password: 'pilot' },
};

type SubmittedAuditStatus = 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED';

async function seedSubmittedReport(
  ID: string,
  reportNumber: string,
  auditStatus: SubmittedAuditStatus,
): Promise<void> {
  const db = await cds.connect.to('db');
  const { FlightReports } = cds.entities('finfly');

  await db.run(
    INSERT.into(FlightReports).entries({
      ID,
      organization_ID: masterDataIDs.organization,
      aircraft_ID: masterDataIDs.aircraft,
      reportNumber,
      requesterName: 'Pilot queue test',
      status: 'SUBMITTED',
      auditStatus,
      submittedAt: '2026-09-10T12:00:00Z',
    }),
  );
}

function IDs(response: { data: { value: Array<{ ID: string }> } }): string[] {
  return response.data.value.map(({ ID }) => ID);
}

describe('ExpenseService pilot report queues', () => {
  it('separates attention, pending, approved, and complete report views', async () => {
    const draftID = '98400000-0000-0000-0000-000000000001';
    const actionRequiredID = '98400000-0000-0000-0000-000000000002';
    const pendingID = '98400000-0000-0000-0000-000000000003';
    const approvedID = '98400000-0000-0000-0000-000000000004';

    // Create through the service so this row represents a real Fiori draft.
    await POST(
      `${baseUrl}/FlightReports`,
      {
        ID: draftID,
        aircraft_ID: masterDataIDs.aircraft,
        requesterName: 'Unfinished pilot report',
      },
      pilotConfiguration,
    );
    await seedSubmittedReport(
      actionRequiredID,
      'FR-2026-PILOT-ACTION',
      'ACTION_REQUIRED',
    );
    await seedSubmittedReport(pendingID, 'FR-2026-PILOT-PENDING', 'PENDING');
    await seedSubmittedReport(
      approvedID,
      'FR-2026-PILOT-APPROVED',
      'APPROVED',
    );

    // These requests intentionally mirror the SelectionPresentationVariants.
    const activeAttention = await GET(
      `${baseUrl}/FlightReports?$filter=requiresPilotAttention eq true&$select=ID,pilotAttentionPriority&$orderby=pilotAttentionPriority`,
      pilotConfiguration,
    );
    const draftAttention = await GET(
      `${baseUrl}/FlightReports?$filter=IsActiveEntity eq false and requiresPilotAttention eq true&$select=ID,pilotAttentionPriority`,
      pilotConfiguration,
    );
    const pending = await GET(
      `${baseUrl}/FlightReports?$filter=status eq 'SUBMITTED' and auditStatus eq 'PENDING'&$select=ID`,
      pilotConfiguration,
    );
    const approved = await GET(
      `${baseUrl}/FlightReports?$filter=status eq 'SUBMITTED' and auditStatus eq 'APPROVED'&$select=ID`,
      pilotConfiguration,
    );
    const allReports = await GET(
      `${baseUrl}/FlightReports?$select=ID`,
      pilotConfiguration,
    );
    const allDrafts = await GET(
      `${baseUrl}/FlightReports?$filter=IsActiveEntity eq false&$select=ID`,
      pilotConfiguration,
    );

    expect(IDs(activeAttention)).to.include(actionRequiredID);
    expect(IDs(activeAttention)).not.to.include.members([pendingID, approvedID]);
    expect(IDs(draftAttention)).to.include(draftID);
    expect(activeAttention.data.value[0].pilotAttentionPriority).to.equal(1);
    expect(draftAttention.data.value[0].pilotAttentionPriority).to.equal(2);

    expect(IDs(pending)).to.include(pendingID);
    expect(IDs(pending)).not.to.include.members([
      actionRequiredID,
      approvedID,
    ]);

    expect(IDs(approved)).to.include(approvedID);
    expect(IDs(approved)).not.to.include.members([
      actionRequiredID,
      pendingID,
    ]);

    expect(IDs(allReports)).to.include.members([
      actionRequiredID,
      pendingID,
      approvedID,
    ]);
    expect(IDs(allDrafts)).to.include(draftID);
  });
});
