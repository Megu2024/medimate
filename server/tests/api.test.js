import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Patient } from '../src/models/Patient.js';
import { Medicine } from '../src/models/Medicine.js';
import { Device } from '../src/models/Device.js';
import { DoseInstance } from '../src/models/DoseInstance.js';
import { DeviceEvent } from '../src/models/DeviceEvent.js';
import { calculateAge } from '../src/utils/dateUtils.js';

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/medimate_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
  await User.deleteMany({});
  await Patient.deleteMany({});
  await Medicine.deleteMany({});
  await Device.deleteMany({});
  await DoseInstance.deleteMany({});
  await DeviceEvent.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('MediMate Core API & Business Logic Tests', () => {
  let authToken = '';
  let caregiverId = '';
  let patientId = '';
  let deviceId = '';
  let deviceToken = 'test_device_secret_token_123';

  // 1. Automatic Age Calculation from Date of Birth
  describe('Age Calculation Utility', () => {
    it('accurately calculates age from date of birth', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 68;
      const dob = new Date(birthYear, today.getMonth(), today.getDate() - 1);
      const age = calculateAge(dob);
      expect(age).toBe(68);
    });
  });

  // 2. Authentication & Registration
  describe('Caregiver Registration & Login', () => {
    it('successfully registers caregiver and patient without photo', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Arun Kumar',
          email: 'arun@example.com',
          password: 'Password123!',
          passwordConfirm: 'Password123!',
          patientName: 'Kalyani Amma',
          patientDob: '1955-08-15',
          relationship: 'Mother',
          phoneNumber: '+919876543210'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('arun@example.com');
      expect(res.body.patient.name).toBe('Kalyani Amma');
      expect(res.body.patient.age).toBeGreaterThan(65);

      authToken = res.body.token;
      caregiverId = res.body.user.id;
      patientId = res.body.patient.id;
    });

    it('rejects duplicate email registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Another User',
          email: 'arun@example.com',
          password: 'Password123!',
          passwordConfirm: 'Password123!',
          patientName: 'Test Patient',
          patientDob: '1960-01-01'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'arun@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'arun@example.com',
          password: 'WrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // 3. Medicine Management & 3-Compartment Constraint
  describe('Medicine Management & Strict Compartment Enforcement', () => {
    it('lists all 3 compartments available initially', async () => {
      const res = await request(app)
        .get('/api/medicines/available-compartments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.availableCompartments).toEqual([1, 2, 3]);
      expect(res.body.isFull).toBe(false);
    });

    it('successfully assigns medicine to Compartment 1', async () => {
      const res = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Sugar Tablet',
          category: 'Sugar',
          compartment: 1,
          scheduledTime: '08:00',
          repeatIntervalMinutes: 5,
          deadlineTime: '08:30',
          notes: 'Take after light breakfast'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.medicine.compartment).toBe(1);
    });

    it('now only offers compartments 2 and 3', async () => {
      const res = await request(app)
        .get('/api/medicines/available-compartments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.availableCompartments).toEqual([2, 3]);
      expect(res.body.occupiedCompartments).toEqual([1]);
    });

    it('strictly rejects adding a duplicate medicine to Compartment 1', async () => {
      const res = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Duplicate Tablet',
          category: 'General',
          compartment: 1,
          scheduledTime: '09:00',
          repeatIntervalMinutes: 5,
          deadlineTime: '09:30'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('assigns medicine to Compartment 2 and 3', async () => {
      // Compartment 2: BP Tablet
      const res2 = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'BP Medicine',
          category: 'BP',
          compartment: 2,
          scheduledTime: '13:00',
          repeatIntervalMinutes: 10,
          deadlineTime: '13:45'
        });
      expect(res2.status).toBe(201);

      // Compartment 3: Cold Tablet
      const res3 = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cold Medicine',
          category: 'Cold',
          compartment: 3,
          scheduledTime: '20:00',
          repeatIntervalMinutes: 5,
          deadlineTime: '20:30'
        });
      expect(res3.status).toBe(201);
    });

    it('reports all 3 compartments full and rejects 4th medicine', async () => {
      const res = await request(app)
        .get('/api/medicines/available-compartments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.availableCompartments).toEqual([]);
      expect(res.body.isFull).toBe(true);

      const resAdd = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Fourth Medicine',
          category: 'Vitamin',
          compartment: 1,
          scheduledTime: '11:00',
          deadlineTime: '11:30'
        });

      expect(resAdd.status).toBe(400);
      expect(resAdd.body.success).toBe(false);
    });
  });

  // 4. Hardware REST APIs & Event Processing
  describe('ESP32 Hardware APIs & Event Processing', () => {
    let pairedDeviceId = '';
    let rawDeviceToken = '';

    beforeAll(async () => {
      // Setup device credentials for hardware testing
      const credsRes = await request(app)
        .post('/api/devices/credentials')
        .set('Authorization', `Bearer ${authToken}`);

      pairedDeviceId = credsRes.body.credentials.deviceId;
      rawDeviceToken = credsRes.body.credentials.deviceToken;
    });

    it('acknowledges device heartbeat and updates lastHeartbeat', async () => {
      const res = await request(app)
        .post('/api/device-api/heartbeat')
        .set('X-Device-Id', pairedDeviceId)
        .set('Authorization', `Bearer ${rawDeviceToken}`)
        .send({
          firmwareVersion: '1.0.0',
          wifiRssi: -58,
          ipAddress: '192.168.1.150'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.serverUtc).toBeDefined();
    });

    it('provides active schedule configuration to ESP32', async () => {
      const res = await request(app)
        .get('/api/device-api/config')
        .set('X-Device-Id', pairedDeviceId)
        .set('Authorization', `Bearer ${rawDeviceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.medicines.length).toBe(3);
      expect(res.body.medicines[0].compartment).toBe(1);
    });

    it('correctly processes normal compartment access event', async () => {
      const eventId = `evt-${Date.now()}-1`;
      const res = await request(app)
        .post('/api/device-api/events')
        .set('X-Device-Id', pairedDeviceId)
        .set('Authorization', `Bearer ${rawDeviceToken}`)
        .send({
          eventId,
          timestamp: new Date().toISOString(),
          compartment: 1,
          lidState: 'open'
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('accepted');
      expect(res.body.results[0].eventType).toBe('normal_access');
      expect(res.body.results[0].feedback.oledSymbol).toBe('CHECK');
    });

    it('idempotently deduplicates retransmitted device event', async () => {
      const duplicateEventId = 'fixed-uuid-test-123';

      // First submission
      const res1 = await request(app)
        .post('/api/device-api/events')
        .set('X-Device-Id', pairedDeviceId)
        .set('Authorization', `Bearer ${rawDeviceToken}`)
        .send({
          eventId: duplicateEventId,
          timestamp: new Date().toISOString(),
          compartment: 2,
          lidState: 'open'
        });
      expect(res1.status).toBe(200);

      // Retransmission of identical eventId
      const res2 = await request(app)
        .post('/api/device-api/events')
        .set('X-Device-Id', pairedDeviceId)
        .set('Authorization', `Bearer ${rawDeviceToken}`)
        .send({
          eventId: duplicateEventId,
          timestamp: new Date().toISOString(),
          compartment: 2,
          lidState: 'open'
        });
      expect(res2.status).toBe(200);
      expect(res2.body.results[0].status).toBe('accepted');
    });
  });

  // 5. Dashboard State
  describe('Caregiver Dashboard View', () => {
    it('returns dashboard summary and compartment cards with correct colors', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.patient.name).toBe('Kalyani Amma');
      expect(res.body.compartmentCards.length).toBe(3);

      // Compartment 1 was accessed in the test above -> should be green
      const comp1 = res.body.compartmentCards.find((c) => c.compartment === 1);
      expect(comp1.status).toBe('green');
      expect(comp1.statusLabel).toBe('Taken / Accessed');
    });
  });
});
