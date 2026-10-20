import express from 'express';
import {
  uploadReport,
  getReports,
  runReportAnalysis,
  deleteReport
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { uploadReport as multerUpload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.get('/', getReports);
router.post('/', multerUpload.single('report'), uploadReport);
router.post('/:id/analyze', runReportAnalysis);
router.delete('/:id', deleteReport);

export default router;
