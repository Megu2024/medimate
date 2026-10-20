import express from 'express';
import {
  getPatientProfile,
  updatePatientProfile,
  uploadPatientPhoto,
  servePatientPhoto
} from '../controllers/patientController.js';
import { protect } from '../middleware/auth.js';
import { uploadPhoto } from '../middleware/upload.js';

const router = express.Router();

router.get('/me', protect, getPatientProfile);
router.patch('/me', protect, updatePatientProfile);
router.post('/me/photo', protect, uploadPhoto.single('photo'), uploadPatientPhoto);
router.get('/photo/:filename', servePatientPhoto);

export default router;
