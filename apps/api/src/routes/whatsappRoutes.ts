import { Router } from 'express';
import {
  getWhatsAppConfig,
  updateWhatsAppConfig,
  testConnection
} from '../controllers/whatsappController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/config', getWhatsAppConfig);
router.post('/config', updateWhatsAppConfig);
router.post('/test', testConnection);

export default router;
