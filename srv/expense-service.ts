import cds, { type Request } from '@sap/cds';

const { SELECT, INSERT, UPDATE } = cds.ql;

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

type BoundReportKey = {
  ID: string;
  IsActiveEntity?: boolean;
};

type FlightReportWorkflowData = {
  ID: string;
  reportNumber: string;
  status: string;
};

export default class ExpenseService extends cds.ApplicationService {
  init() {
    // CAP's draft entity typings are currently incomplete.
    const { FlightReports, FlightLegs, CrewAssignments, Expenses } = this
      .entities as any;
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

    this.before('EDIT', FlightReports, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;
      const reportID = key?.ID ?? (req.data.ID as string | undefined);

      if (!reportID) {
        return req.reject(
          400,
          'The flight report ID is required to edit a report',
        );
      }

      const report = (await SELECT.one
        .from(db.FlightReports)
        .columns('ID', 'reportNumber', 'status')
        .where({ ID: reportID })) as FlightReportWorkflowData | undefined;

      if (!report) {
        return req.reject(404, `Flight report with ID ${reportID} not found`);
      }

      if (!['DRAFT', 'REJECTED'].includes(report.status)) {
        return req.reject(
          409,
          `Flight report ${report.reportNumber} cannot be edited because its status is ${report.status}`,
        );
      }
    });

    this.on('submit', FlightReports, async (req: Request) => {
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

      // All operations executed through this transaction either succeed
      // together or are rolled back together.
      const tx = cds.tx(req);

      const report = (await tx.run(
        SELECT.one
          .from(db.FlightReports)
          .columns('ID', 'reportNumber', 'status')
          .where({ ID: key.ID }),
      )) as FlightReportWorkflowData | undefined;

      if (!report) {
        return req.reject(404, `Flight report with ID ${key.ID} not found`);
      }

      if (!['DRAFT', 'REJECTED'].includes(report.status)) {
        return req.reject(
          409,
          `Flight report ${report.reportNumber} cannot be submitted because its status is ${report.status}`,
        );
      }

      const legs = await tx.run(
        SELECT.from(db.FlightLegs).columns('ID').where({ report_ID: key.ID }),
      );

      if (legs.length === 0) {
        return req.reject(
          400,
          `Flight report ${report.reportNumber} cannot be submitted because it has no flight legs`,
        );
      }

      const expenses = await tx.run(
        SELECT.from(db.Expenses).columns('ID').where({ report_ID: key.ID }),
      );

      if (expenses.length === 0) {
        return req.reject(
          400,
          `Flight report ${report.reportNumber} cannot be submitted because it has no expenses`,
        );
      }

      const captain = await tx.run(
        SELECT.one
          .from(db.CrewAssignments)
          .columns('crewMember_ID')
          .where({ report_ID: key.ID, role: 'CAPTAIN' }),
      );

      if (!captain) {
        return req.reject(
          400,
          `Flight report ${report.reportNumber} cannot be submitted because it has no assigned captain`,
        );
      }

      const submittedAt = new Date().toISOString();
      const submittedBy = req.user.id;

      await tx.run(
        UPDATE.entity(db.FlightReports)
          .set({
            status: 'SUBMITTED',
            submittedAt,
            submittedBy,
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: null,
          })
          .where({ ID: report.ID }),
      );

      await tx.run(
        INSERT.into(db.FlightReportHistory).entries({
          report_ID: report.ID,
          fromStatus: report.status,
          toStatus: 'SUBMITTED',
          comment: 'Flight report submitted for audit',
        }),
      );

      await this.emit('FlightReportSubmitted', {
        reportID: report.ID,
        reportNumber: report.reportNumber,
        submittedBy,
        submittedAt,
      });

      return tx.run(SELECT.one.from(db.FlightReports).where({ ID: report.ID }));
    });

    this.on('approve', FlightReports, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(
          400,
          'The flight report ID is required to approve a report',
        );
      }

      if (key.IsActiveEntity === false) {
        return req.reject(409, 'Save the flight report before approving it');
      }

      const tx = cds.tx(req);

      const report = (await tx.run(
        SELECT.one
          .from(db.FlightReports)
          .columns('ID', 'reportNumber', 'status')
          .where({ ID: key.ID }),
      )) as FlightReportWorkflowData | undefined;

      if (!report) {
        return req.reject(404, `Flight report with ID ${key.ID} not found`);
      }

      if (report.status !== 'SUBMITTED') {
        return req.reject(
          409,
          `Flight report ${report.reportNumber} cannot be approved because its status is ${report.status}`,
        );
      }

      const reviewedAt = new Date().toISOString();
      const reviewedBy = req.user.id;
      const comment = req.data.comment as string | undefined;

      await tx.run(
        UPDATE.entity(db.FlightReports)
          .set({
            status: 'APPROVED',
            reviewedAt,
            reviewedBy,
            rejectionReason: null,
          })
          .where({ ID: report.ID }),
      );

      await tx.run(
        INSERT.into(db.FlightReportHistory).entries({
          report_ID: report.ID,
          fromStatus: report.status,
          toStatus: 'APPROVED',
          comment: comment?.trim() || 'Flight report approved',
        }),
      );

      return tx.run(SELECT.one.from(db.FlightReports).where({ ID: report.ID }));
    });

    this.on('rejectReport', FlightReports, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(400, 'The flight report ID is required');
      }

      if (key.IsActiveEntity === false) {
        return req.reject(409, 'Save the flight report before rejecting it');
      }

      const reason = (req.data.reason as string | undefined)?.trim();

      const tx = cds.tx(req);

      const report = (await tx.run(
        SELECT.one
          .from(db.FlightReports)
          .columns('ID', 'reportNumber', 'status')
          .where({ ID: key.ID }),
      )) as FlightReportWorkflowData | undefined;

      if (!report) {
        return req.reject(404, 'Flight report not found');
      }

      if (report.status !== 'SUBMITTED') {
        return req.reject(
          409,
          `A report with status ${report.status} cannot be rejected`,
        );
      }

      const reviewedAt = new Date().toISOString();
      const reviewedBy = req.user.id;

      await tx.run(
        UPDATE.entity(db.FlightReports)
          .set({
            status: 'REJECTED',
            reviewedAt,
            reviewedBy,
            rejectionReason: reason,
          })
          .where({ ID: report.ID }),
      );

      await tx.run(
        INSERT.into(db.FlightReportHistory).entries({
          report_ID: report.ID,
          fromStatus: report.status,
          toStatus: 'REJECTED',
          comment: reason,
        }),
      );

      return tx.run(SELECT.one.from(db.FlightReports).where({ ID: report.ID }));
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
