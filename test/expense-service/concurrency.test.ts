import cds from '@sap/cds';

import { masterDataIDs } from '../support/ids';

const { GET, PATCH, POST, expect } = cds.test('serve', 'all', '--in-memory');

const baseUrl = '/expenses';

describe('ExpenseService optimistic concurrency', () => {
  it('rejects an update that uses a stale ETag', async () => {
    const reportID = '91000000-0000-0000-0000-000000000001';

    let response = await POST(`${baseUrl}/FlightReports`, {
      ID: reportID,
      reportNumber: 'FR-2026-ETAG',
      aircraft_ID: masterDataIDs.aircraft,
      requesterName: 'Concurrency test',
      notes: 'Original notes',
    });

    expect(response.status).to.equal(201);

    const draftUrl =
      `${baseUrl}/FlightReports(` + `ID=${reportID},IsActiveEntity=false)`;

    // Read the current representation and preserve its version.
    response = await GET(draftUrl);

    expect(response.status).to.equal(200);

    const originalETag = response.headers.etag as string | undefined;

    expect(originalETag).to.exist;

    // The first client updates the same version successfully.
    response = await PATCH(
      draftUrl,
      {
        notes: 'Notes changed by the first client',
      },
      {
        headers: {
          'If-Match': originalETag,
        },
      },
    );

    expect([200, 204]).to.include(response.status);

    // Read the report again to confirm that it now has a new version.
    response = await GET(draftUrl);

    expect(response.status).to.equal(200);
    expect(response.data.notes).to.equal('Notes changed by the first client');

    const updatedETag = response.headers.etag as string | undefined;

    expect(updatedETag).to.exist;
    expect(updatedETag).not.to.equal(originalETag);

    // A second client still holds the original, now stale, ETag.
    response = await PATCH(
      draftUrl,
      {
        notes: 'Attempted overwrite from a stale client',
      },
      {
        headers: {
          'If-Match': originalETag,
        },
        validateStatus: (status: number) => status === 412,
      },
    );

    expect(response.status).to.equal(412);

    // Confirm that the stale update did not overwrite the valid one.
    response = await GET(draftUrl);

    expect(response.status).to.equal(200);
    expect(response.data.notes).to.equal('Notes changed by the first client');
  });
});
