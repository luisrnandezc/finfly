import cds, { type Request } from '@sap/cds';

const { SELECT } = cds.ql;

type LegReference = {
  ID: string;
};

type ExpenseReference = {
  ID: string;
  leg_ID?: string | null;
};

export default class ExpenseService extends cds.ApplicationService {
  init() {
    // CAP's draft entity typings are currently incomplete.
    const { FlightReports, FlightLegs, Expenses } = this.entities as any;

    this.before('SAVE', FlightReports, async (req: Request) => {
      const reportId = req.data.ID as string;

      const legs = (await SELECT.from(FlightLegs.drafts)
        .columns('ID')
        .where({ report_ID: reportId })) as LegReference[];

      const expenses = (await SELECT.from(Expenses.drafts)
        .columns('ID', 'leg_ID')
        .where({ report_ID: reportId })) as ExpenseReference[];

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
