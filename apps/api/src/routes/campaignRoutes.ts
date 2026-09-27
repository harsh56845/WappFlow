import { Router } from 'express';
import {
  getCampaigns,
  createCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  getCampaignMessages
} from '../controllers/campaignController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/resume', resumeCampaign);
router.post('/:id/cancel', cancelCampaign);
router.get('/:id/messages', getCampaignMessages);

export default router;
