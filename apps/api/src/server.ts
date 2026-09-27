import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { logger } from './config/logger';

const startServer = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`WhatsFlow API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`DEMO_MODE: ${env.DEMO_MODE}`);
  });

  const shutdown = () => {
    logger.info('Shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
