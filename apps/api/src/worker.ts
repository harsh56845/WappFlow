import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB } from './config/db';
import { processCampaignJob } from './workers/campaignWorker';
import { CampaignJobData } from './queues/campaignQueue';

async function startWorker() {
  await connectDB();

  logger.info('Initializing BullMQ Campaign Worker...');

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  const worker = new Worker<CampaignJobData>(
    'whatsapp-campaigns',
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing campaign job from BullMQ');
      await processCampaignJob(job.data);
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 80, // Meta tier 1 rate limit: max 80 messages per second safe envelope
        duration: 1000
      }
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
  });

  const shutdown = async () => {
    logger.info('Stopping worker gracefully...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch((err) => {
  logger.error({ err }, 'Failed to start BullMQ worker');
  process.exit(1);
});
