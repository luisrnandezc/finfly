import path from 'node:path';
import type { Application } from 'express';
import express from 'express';

const applications = [
  ['flightreports', '/finfly.flightreports'],
  ['audit', '/finfly.audit'],
  ['admin', '/finfly.admin'],
  ['staff', '/finfly.staff'],
] as const;

/** Serves the optimized Fiori builds without development UI5 middleware. */
export function registerApplicationShell(app: Application): void {
  app.get('/finfly-shell.js', (_request, response) => {
    response.sendFile(path.resolve('app', 'common', 'finfly-shell.js'));
  });
}

/** Serves the optimized Fiori builds without development UI5 middleware. */
export function registerProductionUI(app: Application): void {
  for (const [folder, route] of applications) {
    const buildDirectory = path.resolve('app', folder, 'dist');
    app.use(
      route,
      express.static(buildDirectory, {
        index: 'index.html',
        setHeaders(response, filePath) {
          response.setHeader(
            'Cache-Control',
            filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
          );
        },
      }),
    );
  }
}
