import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  previewTemplate
} from '../controllers/templateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.post('/preview', previewTemplate);
router.get('/:id', getTemplateById);
router.patch('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
