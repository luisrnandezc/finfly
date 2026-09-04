import cds, { type Request } from '@sap/cds';

const { SELECT } = cds.ql;

/** Registers defaults and ownership rules applied while a pilot edits drafts. */
export function registerDraftHandlers(service: cds.ApplicationService): void {
  // CAP's generated typings do not currently expose draft shadow entities.
  const { FlightReports, FlightLegs, Expenses } = service.entities as any;
  const db = cds.entities('finfly');

  const organizationFor = (req: Request): string => {
    const organizationID = req.user.attr?.organization as string | undefined;

    if (!organizationID) {
      req.reject(403, 'No organization is assigned to the authenticated user');
    }

    return organizationID!;
  };

  const currentDate = (): string => new Date().toISOString().slice(0, 10);

  service.before('NEW', FlightReports.drafts, async (req: Request) => {
    const organizationID = organizationFor(req);
    const tx = cds.tx(req);
    const membership = await tx.run(
      SELECT.one.from(db.OrganizationMembers).columns('ID').where({
        organization_ID: organizationID,
        userId: req.user.id,
        active: true,
      }),
    );

    if (!membership) {
      return req.reject(
        403,
        'The authenticated user is not an active member of this organization',
      );
    }

    req.data.organization_ID = organizationID;
  });

  service.before('NEW', FlightLegs.drafts, async (req: Request) => {
    const reportID = req.data.report_ID as string | undefined;

    if (!reportID) {
      return req.reject(
        400,
        'The flight report ID is required to create a new flight leg',
      );
    }

    const lastLeg = (await SELECT.one
      .from(FlightLegs.drafts)
      .columns('sequence')
      .where({ report_ID: reportID })
      .orderBy('sequence desc')) as { sequence?: number } | undefined;

    req.data.sequence = Number(lastLeg?.sequence ?? 0) + 1;
    req.data.flightDate ??= currentDate();
  });

  service.before('NEW', Expenses.drafts, (req: Request) => {
    req.data.expenseDate ??= currentDate();
  });
}
