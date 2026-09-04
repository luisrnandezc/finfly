import cds, { type Request } from '@sap/cds';

const { SELECT, UPDATE } = cds.ql;

type BoundReportKey = {
  ID: string;
  IsActiveEntity?: boolean;
};

type ReportData = {
  ID: string;
  reportNumber?: string | null;
  status: string;
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

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Registers the external-rate lookup and USD/VES conversion capability. */
export function registerExchangeRateHandlers(
  service: cds.ApplicationService,
): void {
  const { FlightReports } = service.entities as any;
  const db = cds.entities('finfly');

  service.on('refreshExchangeRates', FlightReports, async (req: Request) => {
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
    )) as ReportData | undefined;

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
        .columns('ID', 'expenseDate', 'originalAmount', 'originalCurrency_code')
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
}
