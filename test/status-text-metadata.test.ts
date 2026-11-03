import cds from '@sap/cds';

describe('report audit-status display metadata', () => {
  it.each(['ExpenseService.FlightReports', 'AuditService.FlightReports'])(
    'displays the status lookup text for %s',
    async (entityName) => {
      const model = await cds.load(['srv', 'app']);
      const definitions = model.definitions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const elements = definitions?.[entityName]?.elements as
        | Record<string, Record<string, unknown>>
        | undefined;
      const auditStatus = elements?.auditStatus;

      expect(auditStatus?.['@Common.Text']).toEqual({
        '=': 'auditStatusDetails.name',
      });
      expect(auditStatus?.['@Common.TextArrangement']).toEqual({
        '#': 'TextOnly',
      });
    },
  );

  it.each([
    ['ExpenseService.FlightReports', 'status', 'statusDetails.name'],
    ['AuditService.FlightReports', 'status', 'statusDetails.name'],
    ['AdminService.FlightReports', 'status', 'statusDetails.name'],
    ['ExpenseService.Expenses', 'auditStatus', 'auditStatusDetails.name'],
    ['AuditService.Expenses', 'auditStatus', 'auditStatusDetails.name'],
    ['AdminService.Expenses', 'auditStatus', 'auditStatusDetails.name'],
    [
      'ExpenseService.ExpenseAuditHistory',
      'toStatus',
      'toStatusDetails.name',
    ],
    ['AuditService.ExpenseAuditHistory', 'toStatus', 'toStatusDetails.name'],
    ['AdminService.ExpenseAuditHistory', 'toStatus', 'toStatusDetails.name'],
  ])(
    'displays readable text for %s.%s',
    async (entityName, elementName, textPath) => {
      const model = await cds.load(['srv', 'app']);
      const definitions = model.definitions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const elements = definitions?.[entityName]?.elements as
        | Record<string, Record<string, unknown>>
        | undefined;
      const element = elements?.[elementName];

      expect(element?.['@Common.Text']).toEqual({ '=': textPath });
      expect(element?.['@Common.TextArrangement']).toEqual({ '#': 'TextOnly' });
    },
  );
});
