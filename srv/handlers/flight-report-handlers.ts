import cds, { type Request } from '@sap/cds';
import { calculateAircraftUtilizationUpdate } from '../domain/aircraft-utilization.ts';
import { calculateFlightReportSummary } from '../domain/flight-report-summary.ts';
import { normalizeFuelQuantity } from '../domain/fuel-quantity.ts';

const { SELECT, INSERT, UPDATE } = cds.ql;

type LegReference = {
  ID: string;
  flightDate?: string | null;
  flightHours?: number | string | null;
};
type ExpenseReference = {
  ID: string;
  leg_ID?: string | null;
  category_ID: string;
  fuelQuantity?: number | string | null;
  fuelUnit?: string | null;
};
type LegSequenceReference = { sequence: number };
type CrewMemberReference = { crewMember_ID: string };
type BoundReportKey = { ID: string; IsActiveEntity?: boolean };

type DraftReportData = {
  reportNumber?: string | null;
  organization_ID: string;
  aircraft_ID: string;
};

type ReportWorkflowData = {
  ID: string;
  organization_ID: string;
  aircraft_ID: string;
  reportNumber?: string | null;
  status: string;
  auditStatus: string;
  totalFlightHours: number | string;
  postedFlightHours: number | string;
  postedCycles: number;
  utilizationPosted: boolean;
};

const findDuplicate = <T>(values: T[]): T | undefined => {
  const seen = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
};

/** Registers activation validation, edit restrictions, and report submission. */
export function registerFlightReportHandlers(
  service: cds.ApplicationService,
): void {
  const { FlightReports, FlightLegs, CrewAssignments, Expenses } = service
    .entities as any;
  const db = cds.entities('finfly');
  const selfApprovalEnabled =
    (cds.env as any).finfly?.selfApprovalEnabled === true;

  const nextReportNumber = async (
    tx: any,
    organizationID: string,
  ): Promise<string> => {
    const year = new Date().getUTCFullYear();
    const organization = await tx.run(
      SELECT.one
        .from(db.Organizations)
        .columns('ID', 'active')
        .where({ ID: organizationID })
        .forUpdate(),
    );

    if (!organization?.active) {
      throw Object.assign(new Error('The assigned organization is inactive'), {
        status: 403,
      });
    }

    const range = await tx.run(
      SELECT.one
        .from(db.ReportNumberRanges)
        .columns('nextNumber')
        .where({ organization_ID: organizationID, year }),
    );
    const allocatedNumber = Number(range?.nextNumber ?? 1);

    if (range) {
      await tx.run(
        UPDATE.entity(db.ReportNumberRanges)
          .set({ nextNumber: allocatedNumber + 1 })
          .where({ organization_ID: organizationID, year }),
      );
    } else {
      await tx.run(
        INSERT.into(db.ReportNumberRanges).entries({
          organization_ID: organizationID,
          year,
          nextNumber: allocatedNumber + 1,
        }),
      );
    }

    return `FR-${year}-${String(allocatedNumber).padStart(6, '0')}`;
  };

  service.before('SAVE', FlightReports, async (req: Request) => {
    const reportID = req.data.ID as string;
    const draftReport = (await SELECT.one
      .from(FlightReports.drafts)
      .columns('reportNumber', 'organization_ID', 'aircraft_ID')
      .where({ ID: reportID })) as DraftReportData | undefined;

    if (draftReport) {
      if (draftReport.reportNumber) {
        const duplicateReport = await SELECT.one
          .from(db.FlightReports)
          .columns('ID')
          .where({
            organization_ID: draftReport.organization_ID,
            reportNumber: draftReport.reportNumber,
            ID: { '!=': reportID },
          });

        if (duplicateReport) {
          req.reject(
            409,
            `Flight report number ${draftReport.reportNumber} already exists`,
          );
        }
      }

      const aircraft = await SELECT.one
        .from(db.Aircraft)
        .columns('ID')
        .where({
          ID: draftReport.aircraft_ID,
          organization_ID: draftReport.organization_ID,
        });
      if (!aircraft) {
        req.reject(
          400,
          'The selected aircraft does not belong to this organization',
        );
      }
    }

    const legs = (await SELECT.from(FlightLegs.drafts)
      .columns('ID', 'flightDate', 'flightHours')
      .where({ report_ID: reportID })) as LegReference[];
    const expenses = (await SELECT.from(Expenses.drafts)
      .columns('ID', 'leg_ID', 'category_ID', 'fuelQuantity', 'fuelUnit')
      .where({ report_ID: reportID })) as ExpenseReference[];
    const legSequences = (await SELECT.from(FlightLegs.drafts)
      .columns('sequence')
      .where({ report_ID: reportID })) as LegSequenceReference[];

    const duplicateSequence = findDuplicate(
      legSequences.map((leg) => leg.sequence),
    );
    if (duplicateSequence !== undefined) {
      req.reject(
        409,
        `Flight leg sequence ${duplicateSequence} is assigned more than once`,
      );
    }

    const crewAssignments = (await SELECT.from(CrewAssignments.drafts)
      .columns('crewMember_ID')
      .where({ report_ID: reportID })) as CrewMemberReference[];
    const duplicateCrewMember = findDuplicate(
      crewAssignments.map((assignment) => assignment.crewMember_ID),
    );
    if (duplicateCrewMember !== undefined) {
      req.reject(
        409,
        `Crew member ${duplicateCrewMember} is assigned more than once`,
      );
    }

    if (draftReport) {
      for (const assignment of crewAssignments) {
        const crewMember = await SELECT.one
          .from(db.CrewMembers)
          .columns('ID')
          .where({
            ID: assignment.crewMember_ID,
            organization_ID: draftReport.organization_ID,
          });
        if (!crewMember) {
          req.reject(
            400,
            `Crew member ${assignment.crewMember_ID} does not belong to this organization`,
          );
        }
      }
    }

    const validLegIDs = new Set(legs.map((leg) => leg.ID));
    const invalidExpense = expenses.find(
      (expense) => expense.leg_ID && !validLegIDs.has(expense.leg_ID),
    );
    if (invalidExpense) {
      req.reject(
        400,
        `Expense ${invalidExpense.ID} references a flight leg that does not belong to this report`,
      );
    }

    for (const expense of expenses) {
      const category = await SELECT.one
        .from(db.ExpenseCategories)
        .columns('code')
        .where({ ID: expense.category_ID, active: true });
      if (!category) {
        req.reject(400, 'Select an active expense category');
      }

      try {
        const fuelQuantityLiters = normalizeFuelQuantity(
          category.code,
          expense.fuelQuantity,
          expense.fuelUnit,
        );
        await UPDATE.entity(Expenses.drafts)
          .set({ fuelQuantityLiters })
          .where({ ID: expense.ID });
      } catch (error) {
        req.reject(400, (error as Error).message);
      }
    }

    // The service owns these persisted values; clients only maintain flight legs.
    Object.assign(req.data, calculateFlightReportSummary(legs));
  });

  service.before('EDIT', FlightReports, async (req: Request) => {
    const key = req.params[0] as BoundReportKey | undefined;
    const reportID = key?.ID ?? (req.data.ID as string | undefined);
    if (!reportID) {
      return req.reject(400, 'The flight report ID is required to edit a report');
    }

    const report = (await SELECT.one
      .from(db.FlightReports)
      .columns('ID', 'reportNumber', 'status')
      .where({ ID: reportID })) as ReportWorkflowData | undefined;
    if (!report) {
      return req.reject(404, `Flight report with ID ${reportID} not found`);
    }
    if (report.status !== 'DRAFT') {
      return req.reject(
        409,
        `Flight report ${report.reportNumber} cannot be edited because its status is ${report.status}`,
      );
    }
  });

  service.before('DELETE', FlightReports, async (req: Request) => {
    const key = req.params[0] as BoundReportKey | undefined;

    // Deleting a draft is how Fiori discards an unfinished creation or edit.
    if (key?.IsActiveEntity === false || req.data.IsActiveEntity === false) {
      return;
    }

    const reportID = key?.ID ?? (req.data.ID as string | undefined);
    if (!reportID) {
      return req.reject(
        400,
        'The flight report ID is required to delete a report',
      );
    }

    const report = (await SELECT.one
      .from(db.FlightReports)
      .columns('ID', 'reportNumber', 'status')
      .where({ ID: reportID })) as ReportWorkflowData | undefined;
    if (!report) {
      return req.reject(404, `Flight report with ID ${reportID} not found`);
    }
    if (report.status !== 'DRAFT') {
      return req.reject(
        409,
        `Flight report ${report.reportNumber} cannot be deleted because its status is ${report.status}`,
      );
    }
  });

  service.on('submit', FlightReports, async (req: Request) => {
    const key = req.params[0] as BoundReportKey | undefined;
    if (!key?.ID) {
      return req.reject(
        400,
        'The flight report ID is required to submit a report',
      );
    }
    if (key.IsActiveEntity === false) {
      return req.reject(409, 'Save the flight report before submitting it');
    }

    const tx = cds.tx(req);
    const report = (await tx.run(
      SELECT.one
        .from(db.FlightReports)
        .columns(
          'ID',
          'organization_ID',
          'aircraft_ID',
          'reportNumber',
          'status',
          'auditStatus',
          'totalFlightHours',
          'postedFlightHours',
          'postedCycles',
          'utilizationPosted',
        )
        .where({ ID: key.ID }),
    )) as ReportWorkflowData | undefined;
    if (!report) {
      return req.reject(404, `Flight report with ID ${key.ID} not found`);
    }

    const reportLabel = report.reportNumber ?? 'Draft flight report';
    if (report.status !== 'DRAFT') {
      return req.reject(
        409,
        `${reportLabel} cannot be submitted because its status is ${report.status}`,
      );
    }

    const legs = await tx.run(
      SELECT.from(db.FlightLegs).columns('ID').where({ report_ID: key.ID }),
    );
    if (legs.length === 0) {
      return req.reject(
        400,
        `${reportLabel} cannot be submitted because it has no flight legs`,
      );
    }

    const expenses = (await tx.run(
      SELECT.from(db.Expenses)
        .columns('ID', 'auditStatus')
        .where({ report_ID: key.ID }),
    )) as Array<{ ID: string; auditStatus: string }>;
    if (expenses.length === 0) {
      return req.reject(
        400,
        `${reportLabel} cannot be submitted because it has no expenses`,
      );
    }

    const pilotInCommand = await tx.run(
      SELECT.one
        .from(db.CrewAssignments)
        .columns('crewMember_ID')
        .where({ report_ID: key.ID, role: 'PIC' }),
    );
    if (!pilotInCommand) {
      return req.reject(
        400,
        `${reportLabel} cannot be submitted because it has no assigned pilot in command`,
      );
    }

    const reportNumber =
      report.reportNumber ??
      (await nextReportNumber(tx, report.organization_ID));
    const submittedAt = new Date().toISOString();
    const submittedBy = req.user.id;
    const autoApprove = selfApprovalEnabled && req.user.is('Auditor');
    const expenseTargetStatus = autoApprove ? 'APPROVED' : 'PENDING';

    // Serialize updates for reports submitted concurrently for one aircraft.
    const aircraft = await tx.run(
      SELECT.one
        .from(db.Aircraft)
        .columns('ID', 'currentFlightHours', 'totalCycles')
        .where({
          ID: report.aircraft_ID,
          organization_ID: report.organization_ID,
        })
        .forUpdate(),
    );
    if (!aircraft) {
      return req.reject(400, 'The assigned aircraft is unavailable');
    }

    const utilization = calculateAircraftUtilizationUpdate({
      aircraftFlightHours: aircraft.currentFlightHours,
      aircraftCycles: aircraft.totalCycles,
      reportFlightHours: report.totalFlightHours,
      reportCycles: legs.length,
      postedFlightHours: report.postedFlightHours,
      postedCycles: report.postedCycles,
      utilizationPosted: report.utilizationPosted,
    });

    await tx.run(
      UPDATE.entity(db.Aircraft)
        .set({
          currentFlightHours: utilization.currentFlightHours,
          totalCycles: utilization.totalCycles,
        })
        .where({ ID: aircraft.ID }),
    );

    await tx.run(
      UPDATE.entity(db.FlightReports)
        .set({
          reportNumber,
          status: 'SUBMITTED',
          auditStatus: autoApprove ? 'APPROVED' : 'PENDING',
          pendingExpenseCount: autoApprove ? 0 : expenses.length,
          postedFlightHours: utilization.postedFlightHours,
          postedCycles: utilization.postedCycles,
          aircraftHoursAfterPosting: utilization.currentFlightHours,
          aircraftCyclesAfterPosting: utilization.totalCycles,
          utilizationPosted: true,
          utilizationPostedAt: submittedAt,
          submittedAt,
          submittedBy,
        })
        .where({ ID: report.ID }),
    );

    for (const expense of expenses) {
      await tx.run(
        UPDATE.entity(db.Expenses)
          .set({
            auditStatus: expenseTargetStatus,
            submittedForAuditAt: submittedAt,
            auditedAt: autoApprove ? submittedAt : null,
            auditedBy: autoApprove ? submittedBy : null,
            correctionReason: null,
          })
          .where({ ID: expense.ID }),
      );
      await tx.run(
        INSERT.into(db.ExpenseAuditHistory).entries({
          expense_ID: expense.ID,
          fromStatus: expense.auditStatus,
          toStatus: expenseTargetStatus,
          comment: autoApprove
            ? 'Expense automatically approved on report submission'
            : 'Expense submitted for audit',
        }),
      );
    }

    await tx.run(
      INSERT.into(db.FlightReportHistory).entries({
        report_ID: report.ID,
        fromStatus: report.status,
        toStatus: 'SUBMITTED',
        comment: 'Flight report submitted for audit',
      }),
    );
    await service.emit('FlightReportSubmitted', {
      reportID: report.ID,
      reportNumber,
      submittedBy,
      submittedAt,
    });

    req.notify(`Flight report ${reportNumber} submitted successfully`);

    return tx.run(SELECT.one.from(db.FlightReports).where({ ID: report.ID }));
  });
}
