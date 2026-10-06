import cds from '@sap/cds';

describe('admin create capabilities', () => {
  it('draft-enables personnel and aircraft', async () => {
    const model = await cds.load(['srv', 'app']);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;

    expect(definitions?.['AdminService.Users']?.['@odata.draft.enabled']).toBe(
      true,
    );
    expect(
      definitions?.['AdminService.Aircraft']?.['@odata.draft.enabled'],
    ).toBe(true);
  });

  it.each(['AdminService.Users', 'AdminService.Aircraft'])(
    'allows creation for %s',
    async (entityName) => {
      const model = await cds.load(['srv', 'app']);
      const definitions = model.definitions as
        | Record<string, Record<string, unknown>>
        | undefined;

      expect(
        definitions?.[entityName]?.[
          '@Capabilities.InsertRestrictions.Insertable'
        ],
      ).toBe(true);
    },
  );

  it.each(['AdminService.FlightReports', 'AdminService.Expenses'])(
    'keeps %s read-only',
    async (entityName) => {
      const model = await cds.load(['srv', 'app']);
      const definitions = model.definitions as
        | Record<string, Record<string, unknown>>
        | undefined;

      expect(definitions?.[entityName]?.['@readonly']).toBe(true);
    },
  );
});
