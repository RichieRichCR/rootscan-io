import * as DB from '@/database/models';
import logger from '@/logger';
import dotenv from 'dotenv';
import Mongoose from 'mongoose';

dotenv.config();

Mongoose.set('strictQuery', false);

logger.info(`Attempting to connect to database..`);

/** @dev Shutdown server if we are not able to connect to server */
if (!process.env.MONGO_URI) {
  logger.error(`Missing MONGO_URI from ENV`);
  process.exit(1);
}

/** @dev Connect to MongoDB */
Mongoose.connect(process.env.MONGO_URI, {
  socketTimeoutMS: 60_000,
  dbName: process.env.MONGO_DB_NAME,
}).catch((e) => {
  logger.info(`Unable to connect to database => ${e.message}`);
});

/** @dev MongoDB Event Listeners */
Mongoose.connection.on('error', (err) => {
  logger.error(`Database error => ${err.message}`);
});

Mongoose.connection.on('open', () => {
  logger.info('Database open');
});

Mongoose.connection.on('connected', () => {
  logger.info('Database connected');
});

Mongoose.connection.on('reconnected', () => {
  logger.info('Database reconnected');
});

Mongoose.connection.on('disconnecting', () => {
  logger.error('Database disconnecting');
});

Mongoose.connection.on('disconnected', () => {
  logger.error('Database disconnected');
});

// Mongoose.set('debug', true);

export default DB;
