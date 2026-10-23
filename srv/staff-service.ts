import cds from '@sap/cds';
import { registerErrorSanitizer } from './handlers/error-sanitizer.ts';
import { registerStaffHandlers } from './handlers/staff-handlers.ts';

export default class StaffService extends cds.ApplicationService {
  init() {
    registerErrorSanitizer(this);
    registerStaffHandlers(this);
    return super.init();
  }
}
