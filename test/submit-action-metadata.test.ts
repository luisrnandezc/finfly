import cds from '@sap/cds';

describe('submit action metadata', () => {
  it('requires a saved draft-status report and asks for confirmation', async () => {
    const model = await cds.load([
      'srv/expense-service.cds',
      'app/flightreports',
    ]);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;
    const action = definitions?.['ExpenseService.FlightReports']?.actions as
      | Record<string, Record<string, unknown>>
      | undefined;
    const submit = action?.submit;
    const metadata = cds.compile.to.edmx(model);

    expect(submit?.['@Common.IsActionCritical']).toBe(true);
    expect(metadata).toContain('<Path>in/IsActiveEntity</Path>');
    expect(metadata).toContain('<Path>in/status</Path>');
    expect(metadata).toContain('<String>DRAFT</String>');
  });
});
