import { createRequire } from 'node:module';

// CAP only discovers sibling .ts service implementations when this flag is
// present. Set it before loading the CAP server command.
process.env.CDS_TYPESCRIPT = 'true';

type ServeCommand = {
  exec: (...args: string[]) => Promise<unknown>;
};

const require = createRequire(import.meta.url);
const serve = require('@sap/cds/bin/serve.js') as ServeCommand;

await serve.exec(...process.argv.slice(2));
