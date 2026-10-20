import express from 'express';
import { getDashboard, getDoseHistory } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getDashboard);
router.get('/history', getDoseHistory);

export default router;
