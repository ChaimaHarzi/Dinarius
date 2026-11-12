import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { googleEnabled } from './config/passport.js';
import { scheduleJobs } from './jobs/campaignLifecycle.js';
import { paymentsMode } from './services/payments.js';

await connectDB();
scheduleJobs();

const server = app.listen(env.port, () => {
  console.info(`Dinarius API listening on ${env.apiUrl}`);
  console.info(`  payments: ${paymentsMode}${paymentsMode === 'demo' ? ' (set STRIPE_SECRET_KEY for real payments)' : ''}`);
  console.info(`  emails:   ${env.smtp.host ? `smtp (${env.smtp.host})` : 'logged to console'}`);
  console.info(`  google:   ${googleEnabled ? 'enabled' : 'disabled'}`);
});

async function shutdown(signal) {
  console.info(`${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
