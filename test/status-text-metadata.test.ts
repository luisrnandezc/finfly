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
});
