import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { passport } from './config/passport.js';
import { stripeWebhook } from './controllers/investment.controller.js';
import { errorHandler, notFound } from './middleware/error.js';
import apiRouter from './routes/index.js';

export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
// Images are served to the Angular app from another origin during development.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientUrls }));
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Stripe signs the raw payload, so the webhook must be registered before the JSON parser.
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());
app.use('/uploads', express.static(env.uploadsDir, { maxAge: '7d', fallthrough: false }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
