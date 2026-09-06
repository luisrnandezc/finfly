import cds from '@sap/cds';
import { registerExpenseWorkflowHandlers } from './handlers/expense-workflow-handlers.ts';

export default class AuditService extends cds.ApplicationService {
  init() {
    registerExpenseWorkflowHandlers(this);

    return super.init();
  }
}
