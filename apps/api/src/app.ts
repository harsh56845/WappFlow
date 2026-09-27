import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import templateRoutes from './routes/templateRoutes';
import campaignRoutes from './routes/campaignRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import webhookRoutes from './routes/webhookRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

const swaggerDocument = require('./swagger.json');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'WhatsFlow API',
    demoMode: env.DEMO_MODE,
    timestamp: new Date().toISOString()
  });
});

// Swagger / OpenAPI documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error Handler
app.use(errorHandler);

export default app;
