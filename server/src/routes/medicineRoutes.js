import express from 'express';
import {
  getMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getAvailableCompartments
} from '../controllers/medicineController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/available-compartments', getAvailableCompartments);
router.get('/', getMedicines);
router.post('/', addMedicine);
router.patch('/:id', updateMedicine);
router.delete('/:id', deleteMedicine);

export default router;
