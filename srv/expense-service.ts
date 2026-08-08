import cds, { type Request } from '@sap/cds';

const { SELECT } = cds.ql;

type LegReference = {
  ID: string;
};

type ExpenseReference = {
  ID: string;
  leg_ID?: string | null;
};

type FlightReportReference = {
  reportNumber: string;
};

type LegSequenceReference = {
  sequence: number;
};

type CrewMemberReference = {
  crewMember_ID: string;
};

export default class ExpenseService extends cds.ApplicationService {
  init() {
    // CAP's draft entity typings are currently incomplete.
    const { FlightReports, FlightLegs, CrewAssignments, Expenses } =
      this.entities as any;
    const db = cds.entities('finfly');

    this.before('SAVE', FlightReports, async (req: Request) => {
      const reportId = req.data.ID as string;

      const draftReport = (await SELECT.one
        .from(FlightReports.drafts)
        .columns('reportNumber')
        .where({ ID: reportId })) as FlightReportReference | undefined;

      if (draftReport) {
        const duplicateReport = await SELECT.one
          .from(db.FlightReports)
          .columns('ID')
          .where({
            reportNumber: draftReport.reportNumber,
            ID: { '!=': reportId },
          });

        if (duplicateReport) {
          req.reject(
            409,
            `Flight report number ${draftReport.reportNumber} already exists`,
          );
        }
      }

      const legs = (await SELECT.from(FlightLegs.drafts)
        .columns('ID')
        .where({ report_ID: reportId })) as LegReference[];

      const expenses = (await SELECT.from(Expenses.drafts)
        .columns('ID', 'leg_ID')
        .where({ report_ID: reportId })) as ExpenseReference[];

      const legSequences = (await SELECT.from(FlightLegs.drafts)
        .columns('sequence')
        .where({ report_ID: reportId })) as LegSequenceReference[];

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
        .where({ report_ID: reportId })) as CrewMemberReference[];

      const duplicateCrewMember = findDuplicate(
        crewAssignments.map((assignment) => assignment.crewMember_ID),
      );

      if (duplicateCrewMember !== undefined) {
        req.reject(
          409,
          `Crew member ${duplicateCrewMember} is assigned more than once`,
        );
      }

      const validLegIds = new Set(legs.map((leg) => leg.ID));

      const invalidExpense = expenses.find(
        (expense) => expense.leg_ID && !validLegIds.has(expense.leg_ID),
      );

      if (invalidExpense) {
        req.reject(
          400,
          `Expense ${invalidExpense.ID} references a flight leg that does not belong to this report`,
        );
      }
    });

    return super.init();
  }
}

function findDuplicate<T>(values: T[]): T | undefined {
  const seen = new Set<T>();

  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }

  return undefined;
}
