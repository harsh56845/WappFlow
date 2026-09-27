import { Router } from 'express';
import multer from 'multer';
import {
  getCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  importCustomers,
  exportCustomers
} from '../controllers/customerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(authenticateToken);

router.get('/', getCustomers);
router.post('/', createCustomer);
router.get('/export', exportCustomers);
router.post('/import', upload.single('file'), importCustomers);
router.get('/:id', getCustomerById);
router.patch('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
