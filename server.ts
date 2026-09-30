import { startServer } from './server/startServer';

startServer().catch((error) => {
  console.error('Failed to start SpendWise server:', error);
  process.exitCode = 1;
});
