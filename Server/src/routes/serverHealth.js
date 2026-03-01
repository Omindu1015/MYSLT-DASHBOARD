import express from 'express';
import {
  getAllServersHealth,
  getServerHealth,
  updateServerHealth,
  initializeServerHealth,
  getServerMetricsSNMP,
  testSNMPConnectionEndpoint,
  addServerWithSNMP,
  deleteServer
} from '../controllers/serverHealthController.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require valid token)
router.get('/', verifyToken, getAllServersHealth);
router.get('/:ip', verifyToken, getServerHealth);
router.get('/snmp/:ip', verifyToken, getServerMetricsSNMP);

// Admin-only routes
router.post('/snmp/test', verifyToken, isAdmin, testSNMPConnectionEndpoint);
router.post('/snmp/add', verifyToken, isAdmin, addServerWithSNMP);
router.post('/initialize', verifyToken, isAdmin, initializeServerHealth);
router.delete('/:ip', verifyToken, isAdmin, deleteServer);

// Public route for agents to report health
router.post('/update', updateServerHealth);

export default router;
