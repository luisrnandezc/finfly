import cds from '@sap/cds';

describe('expense correction action metadata', () => {
  it('labels the correction reason consistently', async () => {
    const model = await cds.load(['srv', 'app']);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;

    for (const entityName of [
      'ExpenseService.Expenses',
      'AuditService.Expenses',
      'AdminService.Expenses',
    ]) {
      const actions = definitions?.[entityName]?.actions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const parameters = actions?.requestExpenseCorrection?.params as
        | Record<string, Record<string, unknown>>
        | undefined;

      expect(parameters?.reason?.['@title']).toEqual('Reason');
    }
  });
});
