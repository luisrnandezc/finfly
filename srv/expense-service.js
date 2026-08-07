const cds = require('@sap/cds');

module.exports = class ExpenseService extends cds.ApplicationService {
  init() {
    const { FlightReports, FlightLegs, Expenses } = this.entities;

    this.before('SAVE', FlightReports, async (req) => {
      const reportId = req.data.ID;

      const legs = await SELECT.from(FlightLegs.drafts)
        .columns('ID', 'leg_ID')
        .where({ report_ID: reportId });

      const expenses = await SELECT.from(Expenses.drafts)
        .columns('ID', 'leg_ID')
        .where({ report_ID: reportId });

      const validLegIds = new Set(legs.map((leg) => leg.ID));

      const invalidExpense = expenses.find(
        (expense) => expense.leg_ID && !validLegIds.has(expense.leg_ID),
      );

      if (invalidExpense) {
        req.reject(
          400,
          `Expense ${invalidExpense.ID} references a flight leg that does not belong to this report.`,
        );
      }
    });
  }
};
