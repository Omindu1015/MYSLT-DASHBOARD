import express from 'express';
import {
  getDashboardStats,
  getApiResponseTimes,
  getApiSuccessRates,
  getLiveTraffic,
  getApiDetails,
  getApiList,
  getCustomerLogs,
  getTopSuccessApis,
  getTopErrorApis,
  getApiSuccessRateHistory
} from '../controllers/dashboardController.js';
import {
  getAllServersHealth,
  getServerHealth,
  getServerMetricsSNMP,
  testSNMPConnectionEndpoint,
  addServerWithSNMP,
  initializeServerHealth,
  deleteServer,
  updateServerHealth
} from '../controllers/serverHealthController.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(verifyToken);

// Dashboard statistics
router.get('/stats', getDashboardStats);

// API response times
router.get('/response-times', getApiResponseTimes);

// API success rates
router.get('/success-rates', getApiSuccessRates);

// Live traffic data
router.get('/live-traffic', getLiveTraffic);

// API details table
router.get('/api-details', getApiDetails);

// Get API list for filters
router.get('/api-list', getApiList);

// Get customer logs by username
router.get('/customer-logs/:username', getCustomerLogs);

// Get top 20 APIs with highest success rate
router.get('/top-success-apis', getTopSuccessApis);

// Get top 20 APIs with highest error rate
router.get('/top-error-apis', getTopErrorApis);

// Get API success rate history over time
router.get('/api-success-history', getApiSuccessRateHistory);

export default router;
