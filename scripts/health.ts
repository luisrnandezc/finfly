import cds from '@sap/cds';
import type { Application } from 'express';

const { SELECT } = cds.ql;
const log = cds.log('health');

/** Registers the readiness check used by the hosting platform. */
export function registerHealthCheck(app: Application): void {
  app.get('/health', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      const db = await cds.connect.to('db');
      await db.run(SELECT.one.from('finfly.Organizations').columns('ID'));
      response.status(200).json({ status: 'ok' });
    } catch (error) {
      log.error('Database readiness check failed', error);
      response.status(503).json({ status: 'unavailable' });
    }
  });
}
