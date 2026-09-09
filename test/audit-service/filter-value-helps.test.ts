import { expenseServiceTest } from '../support/expense-service-test';

const { GET, expect } = expenseServiceTest();

const baseUrl = '/audit';
const auditorConfiguration = {
  auth: { username: 'auditor', password: 'auditor' },
};

describe('AuditService filter value helps', () => {
  it('exposes the report audit statuses relevant to auditors', async () => {
    const response = await GET(
      `${baseUrl}/ReportAuditStatuses?$select=code,name&$orderby=sortOrder`,
      auditorConfiguration,
    );

    expect(response.status).to.equal(200);
    expect(response.data.value).to.deep.equal([
      { code: 'PENDING', name: 'Pending' },
      { code: 'ACTION_REQUIRED', name: 'Action Required' },
      { code: 'APPROVED', name: 'Approved' },
    ]);
  });
});
