import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error({ error }, 'MongoDB Connection Error');
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};
