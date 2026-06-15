import 'dotenv/config';
import { emailWorker } from './email.worker.ts';

console.log('Email worker started...');

// Keep the worker running
process.on('SIGINT', async () => {
  console.log('Shutting down email worker...');
  await emailWorker.close();
  process.exit(0);
});
