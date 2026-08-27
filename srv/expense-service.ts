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
  auditStatus: string;
};

type ExpenseWorkflowData = {
  ID: string;
  report_ID: string;
  auditStatus: string;
};

type ExpenseConversionData = {
  ID: string;
  expenseDate: string;
  originalAmount: number | string;
  originalCurrency_code: string;
};

type ExchangeRateData = {
  rateDate: string;
  rate: number | string;
};

export default class ExpenseService extends cds.ApplicationService {
  init() {
    // CAP's draft entity typings are currently incomplete.
    const { FlightReports, FlightLegs, CrewAssignments, Expenses } = this
      .entities as any;
    const db = cds.entities('finfly');
    const selfApprovalEnabled =
      (cds.env as any).finfly?.selfApprovalEnabled === true;

    const recalculateReportAuditStatus = async (
      tx: any,
      reportID: string,
    ): Promise<string> => {
      const expenses = (await tx.run(
        SELECT.from(db.Expenses)
          .columns('auditStatus')
          .where({ report_ID: reportID }),
      )) as Array<{ auditStatus: string }>;

      const auditStatus =
        expenses.length === 0
          ? 'NOT_STARTED'
          : expenses.some(
                (expense) => expense.auditStatus === 'NEEDS_CORRECTION',
              )
            ? 'ACTION_REQUIRED'
            : expenses.every(
                  (expense) => expense.auditStatus === 'APPROVED',
                )
              ? 'APPROVED'
              : 'PENDING';

      await tx.run(
        UPDATE.entity(db.FlightReports)
          .set({ auditStatus })
          .where({ ID: reportID }),
      );

      return auditStatus;
    };

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

      if (report.status !== 'DRAFT') {
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
          .columns('ID', 'reportNumber', 'status', 'auditStatus')
          .where({ ID: key.ID }),
      )) as FlightReportWorkflowData | undefined;

      if (!report) {
        return req.reject(404, `Flight report with ID ${key.ID} not found`);
      }

      if (report.status !== 'DRAFT') {
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

      const expenses = (await tx.run(
        SELECT.from(db.Expenses)
          .columns('ID', 'auditStatus')
          .where({ report_ID: key.ID }),
      )) as Array<{ ID: string; auditStatus: string }>;

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
      const autoApprove =
        selfApprovalEnabled && req.user.is('Auditor');
      const expenseTargetStatus = autoApprove ? 'APPROVED' : 'PENDING';

      await tx.run(
        UPDATE.entity(db.FlightReports)
          .set({
            status: 'SUBMITTED',
            auditStatus: autoApprove ? 'APPROVED' : 'PENDING',
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

      await this.emit('FlightReportSubmitted', {
        reportID: report.ID,
        reportNumber: report.reportNumber,
        submittedBy,
        submittedAt,
      });

      return tx.run(SELECT.one.from(db.FlightReports).where({ ID: report.ID }));
    });

    this.on('approveAllExpenses', FlightReports, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(
          400,
          'The flight report ID is required to approve its expenses',
        );
      }

      if (key.IsActiveEntity === false) {
        return req.reject(
          409,
          'Save the flight report before approving its expenses',
        );
      }

      const tx = cds.tx(req);

      const report = (await tx.run(
        SELECT.one
          .from(db.FlightReports)
          .columns('ID', 'reportNumber', 'status', 'auditStatus')
          .where({ ID: key.ID }),
      )) as FlightReportWorkflowData | undefined;

      if (!report) {
        return req.reject(404, `Flight report with ID ${key.ID} not found`);
      }

      if (report.status !== 'SUBMITTED') {
        return req.reject(
          409,
          `Expenses cannot be approved because flight report ${report.reportNumber} has status ${report.status}`,
        );
      }

      const pendingExpenses = (await tx.run(
        SELECT.from(db.Expenses)
          .columns('ID', 'auditStatus')
          .where({
            report_ID: report.ID,
            auditStatus: 'PENDING',
          }),
      )) as Array<{ ID: string; auditStatus: string }>;

      if (pendingExpenses.length === 0) {
        return req.reject(
          409,
          `Flight report ${report.reportNumber} has no pending expenses`,
        );
      }

      const auditedAt = new Date().toISOString();
      const auditedBy = req.user.id;

      for (const expense of pendingExpenses) {
        await tx.run(
          UPDATE.entity(db.Expenses)
            .set({
              auditStatus: 'APPROVED',
              auditedAt,
              auditedBy,
              correctionReason: null,
            })
            .where({ ID: expense.ID }),
        );

        await tx.run(
          INSERT.into(db.ExpenseAuditHistory).entries({
            expense_ID: expense.ID,
            fromStatus: expense.auditStatus,
            toStatus: 'APPROVED',
            comment: 'Expense approved through report bulk action',
          }),
        );
      }

      await recalculateReportAuditStatus(tx, report.ID);

      return tx.run(SELECT.one.from(db.FlightReports).where({ ID: report.ID }));
    });

    this.on('approveExpense', Expenses, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(400, 'The expense ID is required');
      }

      if (key.IsActiveEntity === false) {
        return req.reject(409, 'Save the expense before approving it');
      }

      const tx = cds.tx(req);

      const expense = (await tx.run(
        SELECT.one
          .from(db.Expenses)
          .columns('ID', 'report_ID', 'auditStatus')
          .where({ ID: key.ID }),
      )) as ExpenseWorkflowData | undefined;

      if (!expense) {
        return req.reject(404, `Expense with ID ${key.ID} not found`);
      }

      if (expense.auditStatus !== 'PENDING') {
        return req.reject(
          409,
          `Expense ${expense.ID} cannot be approved because its status is ${expense.auditStatus}`,
        );
      }

      const auditedAt = new Date().toISOString();
      const auditedBy = req.user.id;

      await tx.run(
        UPDATE.entity(db.Expenses)
          .set({
            auditStatus: 'APPROVED',
            auditedAt,
            auditedBy,
            correctionReason: null,
          })
          .where({ ID: expense.ID }),
      );

      await tx.run(
        INSERT.into(db.ExpenseAuditHistory).entries({
          expense_ID: expense.ID,
          fromStatus: expense.auditStatus,
          toStatus: 'APPROVED',
          comment: 'Expense approved',
        }),
      );

      await recalculateReportAuditStatus(tx, expense.report_ID);

      return tx.run(SELECT.one.from(db.Expenses).where({ ID: expense.ID }));
    });

    this.on('requestExpenseCorrection', Expenses, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(400, 'The expense ID is required');
      }

      if (key.IsActiveEntity === false) {
        return req.reject(
          409,
          'Save the expense before requesting a correction',
        );
      }

      const reason = (req.data.reason as string).trim();
      const tx = cds.tx(req);

      const expense = (await tx.run(
        SELECT.one
          .from(db.Expenses)
          .columns('ID', 'report_ID', 'auditStatus')
          .where({ ID: key.ID }),
      )) as ExpenseWorkflowData | undefined;

      if (!expense) {
        return req.reject(404, `Expense with ID ${key.ID} not found`);
      }

      if (expense.auditStatus !== 'PENDING') {
        return req.reject(
          409,
          `Expense ${expense.ID} cannot request correction because its status is ${expense.auditStatus}`,
        );
      }

      const auditedAt = new Date().toISOString();

      await tx.run(
        UPDATE.entity(db.Expenses)
          .set({
            auditStatus: 'NEEDS_CORRECTION',
            auditedAt,
            auditedBy: req.user.id,
            correctionReason: reason,
          })
          .where({ ID: expense.ID }),
      );

      await tx.run(
        INSERT.into(db.ExpenseAuditHistory).entries({
          expense_ID: expense.ID,
          fromStatus: expense.auditStatus,
          toStatus: 'NEEDS_CORRECTION',
          comment: reason,
        }),
      );

      await recalculateReportAuditStatus(tx, expense.report_ID);

      return tx.run(SELECT.one.from(db.Expenses).where({ ID: expense.ID }));
    });

    this.on('resubmitExpense', Expenses, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(400, 'The expense ID is required');
      }

      if (key.IsActiveEntity === false) {
        return req.reject(409, 'Save the expense before resubmitting it');
      }

      const tx = cds.tx(req);

      const expense = (await tx.run(
        SELECT.one
          .from(db.Expenses)
          .columns('ID', 'report_ID', 'auditStatus')
          .where({ ID: key.ID }),
      )) as ExpenseWorkflowData | undefined;

      if (!expense) {
        return req.reject(404, `Expense with ID ${key.ID} not found`);
      }

      if (expense.auditStatus !== 'NEEDS_CORRECTION') {
        return req.reject(
          409,
          `Expense ${expense.ID} cannot be resubmitted because its status is ${expense.auditStatus}`,
        );
      }

      const submittedForAuditAt = new Date().toISOString();

      await tx.run(
        UPDATE.entity(db.Expenses)
          .set({
            auditStatus: 'PENDING',
            submittedForAuditAt,
            auditedAt: null,
            auditedBy: null,
            correctionReason: null,
          })
          .where({ ID: expense.ID }),
      );

      await tx.run(
        INSERT.into(db.ExpenseAuditHistory).entries({
          expense_ID: expense.ID,
          fromStatus: expense.auditStatus,
          toStatus: 'PENDING',
          comment: 'Expense corrected and resubmitted for audit',
        }),
      );

      await recalculateReportAuditStatus(tx, expense.report_ID);

      return tx.run(SELECT.one.from(db.Expenses).where({ ID: expense.ID }));
    });

    this.on('refreshExchangeRates', FlightReports, async (req: Request) => {
      const key = req.params[0] as BoundReportKey | undefined;

      if (!key?.ID) {
        return req.reject(
          400,
          'The flight report ID is required to refresh exchange rates',
        );
      }

      if (key.IsActiveEntity === false) {
        return req.reject(
          409,
          'Save the flight report before refreshing exchange rates',
        );
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

      if (report.status !== 'DRAFT') {
        return req.reject(
          409,
          `Flight report ${report.reportNumber} cannot refresh exchange rates because its status is ${report.status}`,
        );
      }

      const expenses = (await tx.run(
        SELECT.from(db.Expenses)
          .columns(
            'ID',
            'expenseDate',
            'originalAmount',
            'originalCurrency_code',
          )
          .where({ report_ID: report.ID }),
      )) as ExpenseConversionData[];

      if (expenses.length === 0) {
        return req.reject(
          400,
          `Flight report ${report.reportNumber} has no expenses to convert`,
        );
      }

      const unsupportedExpense = expenses.find(
        (expense) => !['USD', 'VES'].includes(expense.originalCurrency_code),
      );

      if (unsupportedExpense) {
        return req.reject(
          400,
          `Currency ${unsupportedExpense.originalCurrency_code} is not supported`,
        );
      }

      const latestExpenseDate = expenses
        .map((expense) => expense.expenseDate)
        .sort()
        .at(-1);

      const exchangeRateService = await cds.connect.to('ExchangeRateService');

      const { Rates } = exchangeRateService.entities;

      const rates = (await exchangeRateService.run(
        SELECT.from(Rates)
          .columns('rateDate', 'rate')
          .where({
            baseCurrency: 'USD',
            quoteCurrency: 'VES',
            rateDate: { '<=': latestExpenseDate },
          })
          .orderBy('rateDate desc'),
      )) as ExchangeRateData[];

      for (const expense of expenses) {
        const applicableRate = rates.find(
          (rate) => rate.rateDate <= expense.expenseDate,
        );

        if (!applicableRate) {
          return req.reject(
            422,
            `No USD/VES exchange rate is available for ${expense.expenseDate}`,
          );
        }

        const originalAmount = Number(expense.originalAmount);
        const rate = Number(applicableRate.rate);

        const amountUSD =
          expense.originalCurrency_code === 'USD'
            ? originalAmount
            : originalAmount / rate;

        const amountVES =
          expense.originalCurrency_code === 'VES'
            ? originalAmount
            : originalAmount * rate;

        await tx.run(
          UPDATE.entity(db.Expenses)
            .set({
              exchangeRate: rate,
              amountUSD: roundCurrency(amountUSD),
              amountVES: roundCurrency(amountVES),
            })
            .where({ ID: expense.ID }),
        );
      }

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

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
