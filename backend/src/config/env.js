import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_SECRET = 'dev-only-secret-change-me';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 5000),
  apiUrl: process.env.API_URL ?? 'http://localhost:5000',
  clientUrls: (process.env.CLIENT_URL ?? 'http://localhost:4200').split(',').map((url) => url.trim()),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/dinarius',
  jwtSecret: process.env.JWT_SECRET && process.env.JWT_SECRET !== 'change-me' ? process.env.JWT_SECRET : DEV_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  uploadsDir: path.join(rootDir, 'uploads'),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Dinarius <no-reply@dinarius.dev>',
  },
};

/** First configured frontend origin, used to build links (emails, redirects). */
env.clientUrl = env.clientUrls[0];

if (env.isProd && env.jwtSecret === DEV_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
