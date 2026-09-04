import cds, { type Request } from '@sap/cds';

const { SELECT, INSERT, UPDATE } = cds.ql;

type BoundKey = { ID: string; IsActiveEntity?: boolean };
type ReportData = { ID: string; reportNumber?: string | null; status: string };
type ExpenseData = { ID: string; report_ID: string; auditStatus: string };

type ExpenseActionInput = {
  expenseDate?: string;
  categoryID?: string;
  originalAmount?: number | string;
  originalCurrencyCode?: string;
  legID?: string | null;
  description?: string | null;
  supplier?: string | null;
  receiptNumber?: string | null;
  fuelQuantityLiters?: number | string | null;
};

/** Registers late creation, approval, correction, and resubmission of expenses. */
export function registerExpenseWorkflowHandlers(
  service: cds.ApplicationService,
): void {
  const { FlightReports, Expenses } = service.entities as any;
  const db = cds.entities('finfly');
  const common = cds.entities('sap.common');

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
          : expenses.every((expense) => expense.auditStatus === 'APPROVED')
            ? 'APPROVED'
            : 'PENDING';

    await tx.run(
      UPDATE.entity(db.FlightReports)
        .set({ auditStatus })
        .where({ ID: reportID }),
    );

    return auditStatus;
  };

  const validateExpenseReferences = async (
    tx: any,
    reportID: string,
    input: ExpenseActionInput,
    req: Request,
  ): Promise<void> => {
    if (input.categoryID) {
      const category = await tx.run(
        SELECT.one
          .from(db.ExpenseCategories)
          .columns('ID')
          .where({ ID: input.categoryID, active: true }),
      );

      if (!category) req.reject(400, 'Select an active expense category');
    }

    if (input.originalCurrencyCode) {
      const currency = await tx.run(
        SELECT.one
          .from(common.Currencies)
          .columns('code')
          .where({ code: input.originalCurrencyCode }),
      );

      if (!currency) req.reject(400, 'Select a valid currency');
    }

    if (input.legID) {
      const leg = await tx.run(
        SELECT.one
          .from(db.FlightLegs)
          .columns('ID')
          .where({ ID: input.legID, report_ID: reportID }),
      );

      if (!leg) {
        req.reject(
          400,
          'The selected flight leg does not belong to this report',
        );
      }
    }
  };

  service.on('addExpense', FlightReports, async (req: Request) => {
    const key = req.params[0] as BoundKey | undefined;

    if (!key?.ID) return req.reject(400, 'The flight report ID is required');
    if (key.IsActiveEntity === false) {
      return req.reject(409, 'Save the flight report before adding an expense');
    }

    const tx = cds.tx(req);
    const report = (await tx.run(
      SELECT.one
        .from(db.FlightReports)
        .columns('ID', 'reportNumber', 'status')
        .where({ ID: key.ID }),
    )) as ReportData | undefined;

    if (!report) {
      return req.reject(404, `Flight report with ID ${key.ID} not found`);
    }
    if (report.status !== 'SUBMITTED') {
      return req.reject(
        409,
        `An expense can only be added after flight report ${report.reportNumber} has been submitted`,
      );
    }

    const input = req.data as ExpenseActionInput;
    const originalAmount = Number(input.originalAmount);
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return req.reject(400, 'Expense amount must be greater than zero');
    }

    await validateExpenseReferences(tx, report.ID, input, req);
    const expenseID = cds.utils.uuid();
    const submittedForAuditAt = new Date().toISOString();

    await tx.run(
      INSERT.into(db.Expenses).entries({
        ID: expenseID,
        report_ID: report.ID,
        leg_ID: input.legID ?? null,
        category_ID: input.categoryID,
        expenseDate: input.expenseDate,
        description: input.description ?? null,
        supplier: input.supplier ?? null,
        receiptNumber: input.receiptNumber ?? null,
        originalAmount,
        originalCurrency_code: input.originalCurrencyCode,
        fuelQuantityLiters: input.fuelQuantityLiters ?? null,
        auditStatus: 'PENDING',
        submittedForAuditAt,
        addedAfterReportSubmission: true,
      }),
    );
    await tx.run(
      INSERT.into(db.ExpenseAuditHistory).entries({
        expense_ID: expenseID,
        fromStatus: 'DRAFT',
        toStatus: 'PENDING',
        comment: 'Expense added after flight report submission',
      }),
    );
    await recalculateReportAuditStatus(tx, report.ID);

    return tx.run(SELECT.one.from(db.Expenses).where({ ID: expenseID }));
  });

  service.on('approveAllExpenses', FlightReports, async (req: Request) => {
    const key = req.params[0] as BoundKey | undefined;
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
    )) as ReportData | undefined;

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
      SELECT.from(db.Expenses).columns('ID', 'auditStatus').where({
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

  service.on('approveExpense', Expenses, async (req: Request) => {
    const key = req.params[0] as BoundKey | undefined;
    if (!key?.ID) return req.reject(400, 'The expense ID is required');
    if (key.IsActiveEntity === false) {
      return req.reject(409, 'Save the expense before approving it');
    }

    const tx = cds.tx(req);
    const expense = (await tx.run(
      SELECT.one
        .from(db.Expenses)
        .columns('ID', 'report_ID', 'auditStatus')
        .where({ ID: key.ID }),
    )) as ExpenseData | undefined;

    if (!expense) return req.reject(404, `Expense with ID ${key.ID} not found`);
    if (expense.auditStatus !== 'PENDING') {
      return req.reject(
        409,
        `Expense ${expense.ID} cannot be approved because its status is ${expense.auditStatus}`,
      );
    }

    const auditedAt = new Date().toISOString();
    await tx.run(
      UPDATE.entity(db.Expenses)
        .set({
          auditStatus: 'APPROVED',
          auditedAt,
          auditedBy: req.user.id,
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

  service.on('requestExpenseCorrection', Expenses, async (req: Request) => {
    const key = req.params[0] as BoundKey | undefined;
    if (!key?.ID) return req.reject(400, 'The expense ID is required');
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
    )) as ExpenseData | undefined;

    if (!expense) return req.reject(404, `Expense with ID ${key.ID} not found`);
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

  service.on('resubmitExpense', Expenses, async (req: Request) => {
    const key = req.params[0] as BoundKey | undefined;
    if (!key?.ID) return req.reject(400, 'The expense ID is required');
    if (key.IsActiveEntity === false) {
      return req.reject(409, 'Save the expense before resubmitting it');
    }

    const tx = cds.tx(req);
    const expense = (await tx.run(
      SELECT.one
        .from(db.Expenses)
        .columns('ID', 'report_ID', 'auditStatus')
        .where({ ID: key.ID }),
    )) as ExpenseData | undefined;

    if (!expense) return req.reject(404, `Expense with ID ${key.ID} not found`);
    if (expense.auditStatus !== 'NEEDS_CORRECTION') {
      return req.reject(
        409,
        `Expense ${expense.ID} cannot be resubmitted because its status is ${expense.auditStatus}`,
      );
    }

    const input = req.data as ExpenseActionInput;
    await validateExpenseReferences(tx, expense.report_ID, input, req);
    const corrections: Record<string, unknown> = {};
    const fieldMappings: Array<[keyof ExpenseActionInput, string]> = [
      ['expenseDate', 'expenseDate'],
      ['categoryID', 'category_ID'],
      ['originalAmount', 'originalAmount'],
      ['originalCurrencyCode', 'originalCurrency_code'],
      ['legID', 'leg_ID'],
      ['description', 'description'],
      ['supplier', 'supplier'],
      ['receiptNumber', 'receiptNumber'],
      ['fuelQuantityLiters', 'fuelQuantityLiters'],
    ];

    for (const [actionField, entityField] of fieldMappings) {
      if (Object.prototype.hasOwnProperty.call(input, actionField)) {
        corrections[entityField] = input[actionField];
      }
    }
    if (
      corrections.originalAmount !== undefined &&
      Number(corrections.originalAmount) <= 0
    ) {
      return req.reject(400, 'Expense amount must be greater than zero');
    }

    const submittedForAuditAt = new Date().toISOString();
    await tx.run(
      UPDATE.entity(db.Expenses)
        .set({
          ...corrections,
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
}
