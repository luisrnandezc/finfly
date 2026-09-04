import cds from '@sap/cds';
import { registerDraftHandlers } from './handlers/draft-handlers.ts';
import { registerExchangeRateHandlers } from './handlers/exchange-rate-handlers.ts';
import { registerExpenseWorkflowHandlers } from './handlers/expense-workflow-handlers.ts';
import { registerFlightReportHandlers } from './handlers/flight-report-handlers.ts';

export default class ExpenseService extends cds.ApplicationService {
  init() {
    registerDraftHandlers(this);
    registerFlightReportHandlers(this);
    registerExpenseWorkflowHandlers(this);
    registerExchangeRateHandlers(this);

    return super.init();
  }
}
