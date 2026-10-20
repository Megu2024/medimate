import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { Settings } from '../models/Settings.js';
import { Device } from '../models/Device.js';
import { config } from '../config/env.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

/**
 * Register a new caregiver and patient
 */
export async function register(req, res, next) {
  try {
    const {
      fullName,
      email,
      password,
      passwordConfirm,
      patientName,
      patientDob,
      relationship,
      phoneNumber
    } = req.body;

    if (!fullName || !email || !password || !patientName || !patientDob) {
      return res.status(400).json({
        success: false,
        message: 'Please provide caregiver name, email, password, patient name, and patient date of birth.'
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Create caregiver user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password,
      phoneNumber: phoneNumber || ''
    });

    // Create patient associated with caregiver
    const patient = await Patient.create({
      caregiverId: user._id,
      name: patientName,
      dateOfBirth: new Date(patientDob),
      relationship: relationship || 'Mother',
      timezone: 'Asia/Kolkata'
    });

    // Create default Settings record
    await Settings.create({
      userId: user._id,
      smsRecipientNumber: phoneNumber || ''
    });

    // Provision a default Device entry for this patient with pairing code
    const initialDeviceId = `MEDIMATE-${Math.floor(1000 + Math.random() * 9000)}`;
    const initialToken = crypto.randomBytes(16).toString('hex');
    const tokenHash = await bcrypt.hash(initialToken, 10);
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Device.create({
      caregiverId: user._id,
      patientId: patient._id,
      deviceId: initialDeviceId,
      deviceName: `${patient.name}'s Smart Medicine Box`,
      deviceTokenHash: tokenHash,
      pairingCode,
      isPaired: true // Automatically paired to the registered caregiver
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber
      },
      patient: {
        id: patient._id,
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        age: patient.age,
        relationship: patient.relationship,
        timezone: patient.timezone,
        photoUrl: patient.photoUrl
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login caregiver
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const patient = await Patient.findOne({ caregiverId: user._id });
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber
      },
      patient: patient
        ? {
            id: patient._id,
            name: patient.name,
            dateOfBirth: patient.dateOfBirth,
            age: patient.age,
            relationship: patient.relationship,
            timezone: patient.timezone,
            photoUrl: patient.photoUrl
          }
        : null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user and patient profile
 */
export async function getMe(req, res, next) {
  try {
    const user = req.user;
    const patient = req.patient;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber
      },
      patient: patient
        ? {
            id: patient._id,
            name: patient.name,
            dateOfBirth: patient.dateOfBirth,
            age: patient.age,
            relationship: patient.relationship,
            timezone: patient.timezone,
            photoUrl: patient.photoUrl,
            medicalNotes: patient.medicalNotes
          }
        : null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout
 */
export async function logout(req, res) {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
}
