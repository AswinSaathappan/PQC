import mongoose from 'mongoose';

/**
 * Normalizes MongoDB URI by properly URL-encoding unencoded special characters
 * (such as '@' or ':') in the password portion if present.
 */
function normalizeMongoUri(uri: string): string {
  if (!uri) return uri;
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^/]+)(.*)$/);
  if (!match) return uri;
  const [, protocol, hostAndAuth, rest] = match;
  const atIndex = hostAndAuth.lastIndexOf('@');
  if (atIndex === -1) return uri;

  const auth = hostAndAuth.substring(0, atIndex);
  const host = hostAndAuth.substring(atIndex + 1);

  const colonIndex = auth.indexOf(':');
  if (colonIndex === -1) return uri;

  const user = auth.substring(0, colonIndex);
  const pass = auth.substring(colonIndex + 1);

  const encodedPass = encodeURIComponent(decodeURIComponent(pass));
  return `${protocol}${user}:${encodedPass}@${host}${rest}`;
}

let isConnecting = false;

export const connectDB = async (): Promise<typeof mongoose> => {
  // Prevent duplicate connections if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Prevent concurrent connection attempts
  if (isConnecting) {
    while (isConnecting) {
      await new Promise(r => setTimeout(r, 50));
    }
    return mongoose;
  }

  isConnecting = true;

  try {
    const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecdat';
    const mongoUri = normalizeMongoUri(rawUri);

    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      console.log(`[MongoDB] Connected to primary database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
      return mongoose;
    } catch (primaryErr: any) {
      const allowFallback = process.env.MONGODB_FALLBACK_TO_LOCAL !== 'false';
      if (allowFallback && (rawUri.includes('mongodb.net') || rawUri.includes('+srv'))) {
        console.warn(`[MongoDB] Primary Atlas connection failed (${primaryErr.message}). MONGODB_FALLBACK_TO_LOCAL is active. Attempting fallback at mongodb://127.0.0.1:27017/ecdat...`);
        const fallbackUri = 'mongodb://127.0.0.1:27017/ecdat';
        await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 3000 });
        console.log(`[MongoDB] Connected to fallback local database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
        return mongoose;
      }
      throw primaryErr;
    }
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    isConnecting = false;
  }
};
