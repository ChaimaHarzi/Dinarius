import cron from 'node-cron';
import { Campaign } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';

/** Closes active campaigns whose end date has passed and cancels their unanswered offers. */
export async function closeEndedCampaigns(now = new Date()) {
  const ended = await Campaign.find({ status: 'active', endDate: { $lte: now } }).select('_id');
  if (ended.length === 0) return 0;

  const ids = ended.map((c) => c._id);
  await Campaign.updateMany({ _id: { $in: ids } }, { status: 'completed' });
  await Investment.updateMany({ campaign: { $in: ids }, status: { $in: ['requested', 'accepted'] } }, { status: 'cancelled' });
  return ids.length;
}

export function scheduleJobs() {
  // Every 15 minutes.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const closed = await closeEndedCampaigns();
      if (closed) console.info(`[cron] closed ${closed} ended campaign(s)`);
    } catch (err) {
      console.error('[cron] campaign lifecycle failed', err);
    }
  });
}
