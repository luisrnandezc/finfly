import { expenseServiceTest } from '../support/expense-service-test';

const { GET, expect } = expenseServiceTest();

const baseUrl = '/expenses';

describe('ExpenseService filter value helps', () => {
  it('exposes flight-report statuses in business order', async () => {
    const response = await GET(
      `${baseUrl}/FlightReportStatuses?$select=code,name&$orderby=sortOrder`,
    );

    expect(response.status).to.equal(200);
    expect(response.data.value).to.deep.equal([
      { code: 'DRAFT', name: 'Draft' },
      { code: 'SUBMITTED', name: 'Submitted' },
    ]);
  });

  it('exposes report audit statuses in business order', async () => {
    const response = await GET(
      `${baseUrl}/ReportAuditStatuses?$select=code,name&$orderby=sortOrder`,
    );

    expect(response.status).to.equal(200);
    expect(response.data.value).to.deep.equal([
      { code: 'NOT_STARTED', name: 'Not Started' },
      { code: 'PENDING', name: 'Pending' },
      { code: 'ACTION_REQUIRED', name: 'Action Required' },
      { code: 'APPROVED', name: 'Approved' },
    ]);
  });
});
