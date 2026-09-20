import cds from '@sap/cds';
import { registerErrorSanitizer } from './handlers/error-sanitizer.ts';
import { registerExpenseWorkflowHandlers } from './handlers/expense-workflow-handlers.ts';

export default class AuditService extends cds.ApplicationService {
  init() {
    registerErrorSanitizer(this);
    registerExpenseWorkflowHandlers(this);

    return super.init();
  }
}
