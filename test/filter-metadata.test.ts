import cds from '@sap/cds';

type FilterExpressionRestriction = {
  Property?: { '='?: string };
  AllowedExpressions?: string;
};

describe('report filter metadata', () => {
  it.each(['ExpenseService.FlightReports', 'AuditService.FlightReports'])(
    'uses partial text matching for %s',
    async (entityName) => {
      const model = await cds.load(['srv', 'app']);
      const definitions = model.definitions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const entity = definitions?.[entityName];
      const restrictions = entity?.[
        '@Capabilities.FilterRestrictions.FilterExpressionRestrictions'
      ] as FilterExpressionRestriction[] | undefined;

      expect(restrictions).toEqual([
        {
          Property: { '=': 'reportNumber' },
          AllowedExpressions: 'SearchExpression',
        },
        {
          Property: { '=': 'requesterName' },
          AllowedExpressions: 'SearchExpression',
        },
      ]);
    },
  );

  it.each(['ExpenseService', 'AuditService'])(
    'enables case-insensitive filtering for %s',
    async (serviceName) => {
      const model = await cds.load(['srv', 'app']);
      const definitions = model.definitions as
        | Record<string, Record<string, unknown>>
        | undefined;

      expect(definitions?.[serviceName]?.['@Capabilities.FilterFunctions']).toEqual(
        ['tolower'],
      );
    },
  );

  it('keeps the auditor report-number filter as a free text field', async () => {
    const model = await cds.load(['srv', 'app']);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;
    const flightReports = definitions?.['AuditService.FlightReports'];
    const elements = flightReports?.elements as
      | Record<string, Record<string, unknown>>
      | undefined;

    expect(
      elements?.reportNumber?.['@Common.ValueList.CollectionPath'],
    ).toBeUndefined();
  });
});
