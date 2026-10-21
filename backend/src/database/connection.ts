import mongoose from 'mongoose';
import { config } from '../config/index.js';

let isConnected = false;

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || config.mongoUri;
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    isConnected = true;
    return conn;
  } catch (err) {
    isConnected = false;
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
