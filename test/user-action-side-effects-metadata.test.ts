import cds from '@sap/cds';

describe('user activation action metadata', () => {
  it('refreshes the active state after Admin and Staff actions', async () => {
    const model = await cds.load(['srv', 'app']);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;

    for (const entityName of ['AdminService.Users', 'StaffService.Users']) {
      const actions = definitions?.[entityName]?.actions as
        | Record<string, Record<string, unknown>>
        | undefined;

      for (const actionName of ['deactivateUser', 'reactivateUser']) {
        expect(
          actions?.[actionName]?.['@Common.SideEffects.TargetProperties'],
        ).toEqual(['in/active']);
      }
    }
  });
});
