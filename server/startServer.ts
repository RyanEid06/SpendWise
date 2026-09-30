import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createServerApp } from './app';
import { serverConfig } from './config';

export async function startServer() {
  const app = createServerApp();
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(require('express').default.static(distPath));
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

  app.listen(serverConfig.port, '0.0.0.0', () => {
    console.log('SpendWise server listening on http://0.0.0.0:' + serverConfig.port);
    console.log('Gemini model: ' + serverConfig.geminiModel);
  });
}
