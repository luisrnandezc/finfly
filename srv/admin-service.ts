import cds from '@sap/cds';
import { registerAdminHandlers } from './handlers/admin-handlers.ts';
import { registerErrorSanitizer } from './handlers/error-sanitizer.ts';
import { registerExpenseWorkflowHandlers } from './handlers/expense-workflow-handlers.ts';

export default class AdminService extends cds.ApplicationService {
  init() {
    registerErrorSanitizer(this);
    registerAdminHandlers(this);
    registerExpenseWorkflowHandlers(this);

    return super.init();
  }
}
