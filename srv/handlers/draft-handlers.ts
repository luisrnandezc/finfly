import cds, { type Request } from '@sap/cds';
import {
  calculateFlightHours,
  type FlightTimeInput,
  type FlightTimeMethod,
} from '../domain/flight-time.ts';

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

  const normalizeAirportCode = (
    value: unknown,
    label: string,
    req: Request,
  ): string => {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!/^[A-Z]{4}$/.test(normalized)) {
      req.reject(400, `${label} must be a four-letter ICAO code`);
    }
    return normalized;
  };

  // Fiori draft creation emits NEW, while direct OData clients can emit CREATE.
  service.before(['NEW', 'CREATE'], FlightReports.drafts, async (req: Request) => {
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

    if (!req.data.aircraft_ID) {
      const crewMember = (await tx.run(
        SELECT.one.from(db.CrewMembers).columns('ID').where({
          organization_ID: organizationID,
          userId: req.user.id,
          isPilot: true,
          active: true,
        }),
      )) as { ID: string } | undefined;

      if (crewMember) {
        const defaultAircraft = (await tx.run(
          SELECT.from(db.Aircraft)
            .columns('ID')
            .where`organization_ID = ${organizationID} and active = true and (defaultPIC_ID = ${crewMember.ID} or defaultSIC_ID = ${crewMember.ID})`
            .limit(2),
        )) as Array<{ ID: string }>;

        if (defaultAircraft.length === 1) {
          req.data.aircraft_ID = defaultAircraft[0].ID;
        }
      }
    }
  });

  service.before(['NEW', 'CREATE'], FlightLegs.drafts, async (req: Request) => {
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

  service.before(['NEW', 'CREATE', 'UPDATE'], FlightLegs.drafts, async (req: Request) => {
    if (Object.hasOwn(req.data, 'originAirportCode')) {
      req.data.originAirportCode = normalizeAirportCode(
        req.data.originAirportCode,
        'Origin',
        req,
      );
    }
    if (Object.hasOwn(req.data, 'destinationAirportCode')) {
      req.data.destinationAirportCode = normalizeAirportCode(
        req.data.destinationAirportCode,
        'Destination',
        req,
      );
    }

    if (req.event === 'NEW') return;

    const timeInputChanged = [
      'takeoffTime',
      'landingTime',
      'hourMeterStart',
      'hourMeterEnd',
    ].some((property) => Object.hasOwn(req.data, property));
    if (!timeInputChanged) return;

    const tx = cds.tx(req);
    const existing = req.data.ID
      ? ((await tx.run(
          SELECT.one
            .from(FlightLegs.drafts)
            .columns(
              'report_ID',
              'takeoffTime',
              'landingTime',
              'hourMeterStart',
              'hourMeterEnd',
            )
            .where({ ID: req.data.ID }),
        )) as (FlightTimeInput & { report_ID?: string }) | undefined)
      : undefined;

    const reportID = (req.data.report_ID ?? existing?.report_ID) as
      | string
      | undefined;
    if (!reportID) return;

    const report = (await tx.run(
      SELECT.one
        .from(FlightReports.drafts)
        .columns('aircraft_ID')
        .where({ ID: reportID }),
    )) as { aircraft_ID?: string } | undefined;
    if (!report?.aircraft_ID) return;

    const aircraft = (await tx.run(
      SELECT.one
        .from(db.Aircraft)
        .columns('flightTimeMethod')
        .where({ ID: report.aircraft_ID }),
    )) as { flightTimeMethod: FlightTimeMethod } | undefined;
    if (!aircraft) return;

    try {
      req.data.flightHours = calculateFlightHours(aircraft.flightTimeMethod, {
        ...existing,
        ...req.data,
      });
    } catch (error) {
      req.reject(400, (error as Error).message);
    }
  });

  service.before(['NEW', 'CREATE'], Expenses.drafts, (req: Request) => {
    req.data.expenseDate ??= currentDate();
  });
}
