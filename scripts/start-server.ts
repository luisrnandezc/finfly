import { createRequire } from 'node:module';
import cds from '@sap/cds';
import { registerDevelopmentLogin } from './dev-login.ts';
import { registerHealthCheck } from './health.ts';
import { registerApplicationShell, registerProductionUI } from './production-ui.ts';
import { registerAuthenticationRoutes } from '../srv/auth/routes.ts';

// CAP only discovers sibling .ts service implementations when this flag is
// present. Set it before loading the CAP server command.
process.env.CDS_TYPESCRIPT = 'true';

type ServeCommand = {
  exec: (...args: string[]) => Promise<unknown>;
};

const require = createRequire(import.meta.url);
const serve = require('@sap/cds/bin/serve.js') as ServeCommand;
const databaseAuthentication =
  process.env.NODE_ENV === 'production' || process.env.FINFLY_AUTH === 'database';

if (databaseAuthentication) {
  cds.env.requires.auth = {
    ...cds.env.requires.auth,
    impl: 'srv/auth/authentication.ts',
  };
}

cds.once('bootstrap', (app) => {
  registerApplicationShell(app);
  if (databaseAuthentication) {
    registerHealthCheck(app);
    registerAuthenticationRoutes(app);
    registerProductionUI(app);
  } else {
    registerDevelopmentLogin(app);
  }
});

await serve.exec(...process.argv.slice(2));
