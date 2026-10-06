import cds from '@sap/cds';

describe('admin business-text metadata', () => {
  it.each([
    ['AdminService.Aircraft', 'aircraftType', 'aircraftTypeDetails.name'],
    ['AdminService.Aircraft', 'defaultPIC', 'defaultPIC.fullName'],
    ['AdminService.Aircraft', 'defaultSIC', 'defaultSIC.fullName'],
    ['AdminService.FlightReports', 'aircraft', 'aircraft.registration'],
    ['AdminService.Expenses', 'report', 'report.displayTitle'],
    ['AdminService.Expenses', 'leg', 'leg.sequenceText'],
    ['AdminService.Expenses', 'category', 'category.name'],
    ['AdminService.CrewAssignments', 'crewMember', 'crewMember.fullName'],
  ])('uses business text for %s.%s', async (entityName, elementName, textPath) => {
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
  });

  it('labels pilot value-help columns and hides the technical key', async () => {
    const model = await cds.load(['srv', 'app']);
    const definitions = model.definitions as
      | Record<string, Record<string, unknown>>
      | undefined;
    const elements = definitions?.['AdminService.Pilots']?.elements as
      | Record<string, Record<string, unknown>>
      | undefined;

    expect(elements?.ID?.['@UI.Hidden']).toBe(true);
    expect(elements?.nationalId?.['@title']).toBe('National ID');
    expect(elements?.fullName?.['@title']).toBe('Full Name');
  });
});
