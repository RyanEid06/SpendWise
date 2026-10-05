import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServerApp } from './app';
import { serverConfig } from './config';
import { operationalAggregates, startAggregateReporting } from './observability/aggregates';

export async function startServer() {
  const app = createServerApp();
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: serverConfig.port },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log('SpendWise server listening on port ' + serverConfig.port);
  });
  const stopReporting = startAggregateReporting(operationalAggregates);
  server.once('close', stopReporting);
  return server;
}
