import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import path from 'path';
import fs from 'fs';

/**
 * Get patient profile for the current caregiver
 */
export async function getPatientProfile(req, res, next) {
  try {
    const patient = await Patient.findOne({ caregiverId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'No patient record found for this account.'
      });
    }

    res.status(200).json({
      success: true,
      patient: {
        id: patient._id,
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        age: patient.age,
        relationship: patient.relationship,
        timezone: patient.timezone,
        photoUrl: patient.photoUrl,
        medicalNotes: patient.medicalNotes
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update patient profile and/or caregiver details
 */
export async function updatePatientProfile(req, res, next) {
  try {
    const {
      caregiverName,
      caregiverPhone,
      patientName,
      patientDob,
      relationship,
      timezone,
      medicalNotes
    } = req.body;

    // Update Caregiver User
    const user = req.user;
    if (caregiverName) user.fullName = caregiverName;
    if (caregiverPhone !== undefined) user.phoneNumber = caregiverPhone;
    await user.save();

    // Update Patient
    let patient = await Patient.findOne({ caregiverId: user._id });
    if (!patient) {
      patient = new Patient({ caregiverId: user._id });
    }

    if (patientName) patient.name = patientName;
    if (patientDob) patient.dateOfBirth = new Date(patientDob);
    if (relationship) patient.relationship = relationship;
    if (timezone) patient.timezone = timezone;
    if (medicalNotes !== undefined) patient.medicalNotes = medicalNotes;

    await patient.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber
      },
      patient: {
        id: patient._id,
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        age: patient.age,
        relationship: patient.relationship,
        timezone: patient.timezone,
        photoUrl: patient.photoUrl,
        medicalNotes: patient.medicalNotes
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload patient profile photo
 */
export async function uploadPatientPhoto(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image file to upload.'
      });
    }

    const patient = await Patient.findOne({ caregiverId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found.'
      });
    }

    // Relative URL endpoint to serve photo securely
    const photoUrl = `/api/patients/photo/${req.file.filename}`;
    patient.photoUrl = photoUrl;
    await patient.save();

    res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      photoUrl,
      patient: {
        id: patient._id,
        name: patient.name,
        photoUrl: patient.photoUrl,
        age: patient.age
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Serve patient photo securely
 */
export async function servePatientPhoto(req, res, next) {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.resolve('./uploads', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}
