import ApiLog from '../models/ApiLog.js';
import ServerHealth from '../models/ServerHealth.js';
import HourlyStats from '../models/HourlyStats.js';
import { apiMapping } from '../config/apiMapping.js';
import { withCache, getCacheKey } from '../utils/cache.js';
import hotStats from '../utils/hotStats.js';

/**
 * Get dashboard statistics and KPIs
 */
export const getDashboardStats = async (req, res) => {
  const cacheKey = getCacheKey('stats', req.query);
  console.log(`[Dashboard] Request received: ${JSON.stringify(req.query)}`);

  try {
    const data = await withCache(cacheKey, async () => {
      const { apiNumber, customerEmail, dateFrom, dateTo, serverIdentifier, last15MinsOnly } = req.query;
      const now = new Date();

      if (last15MinsOnly === 'true') {
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const filter15 = {
          date: { $gte: fifteenMinutesAgo, $lte: now }
        };
        if (apiNumber && apiNumber !== 'ALL') {
          filter15.apiNumber = apiNumber;
        }
        if (customerEmail) {
          const safePrefix = customerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          filter15.customerEmail = { $regex: `^${safePrefix}` };
        }
        if (serverIdentifier) {
          filter15.serverIdentifier = serverIdentifier;
        }

        const twoMinutesAgo = new Date(now.getTime() - 120000);
        const liveTrafficFilter = {
          date: { $gte: twoMinutesAgo, $lte: new Date(now.getTime() + 60000) }
        };
        if (apiNumber && apiNumber !== 'ALL') {
          liveTrafficFilter.apiNumber = apiNumber;
        }
        if (customerEmail) {
          const safePrefix = customerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          liveTrafficFilter.customerEmail = { $regex: `^${safePrefix}` };
        }
        if (serverIdentifier) {
          liveTrafficFilter.serverIdentifier = serverIdentifier;
        }

        const addedServers = await ServerHealth.find().select('serverIp').lean();

        const [facetResult, liveTrafCount] = await Promise.all([
          ApiLog.aggregate([
            { $match: filter15 },
            {
              $facet: {
                uniqueCustomers: [
                  { $group: { _id: '$customerEmail' } },
                  { $count: 'count' }
                ],
                totalCount: [
                  { $count: 'count' }
                ],
                accessMethods: [
                  { $group: { _id: '$accessMethod', count: { $sum: 1 } } }
                ],
                responseTypes: [
                  {
                    $group: {
                      _id: {
                        $cond: [
                          { $eq: [{ $toLower: '$status' }, 'information'] },
                          'Information',
                          '$status'
                        ]
                      },
                      count: { $sum: 1 }
                    }
                  }
                ],
                serverStats: [
                  { $group: { _id: '$serverIdentifier', count: { $sum: 1 } } }
                ]
              }
            }
          ]).then(res => res[0] || {}),
          ApiLog.countDocuments(liveTrafficFilter)
        ]);

        const mergeStats = (history, recent) => {
          const merged = {};
          if (Array.isArray(history)) history.forEach(h => merged[h._id] = (merged[h._id] || 0) + h.count);
          if (Array.isArray(recent)) recent.forEach(r => merged[r._id] = (merged[r._id] || 0) + r.count);
          return merged;
        };

        const totalActiveCustomers = facetResult.uniqueCustomers?.[0]?.count || 0;
        const totalTrafficCount = facetResult.totalCount?.[0]?.count || 0;
        const liveTrafficCount = liveTrafCount;
        const accessMethodDistribution = mergeStats([], facetResult.accessMethods || []);
        const responseTypeDistribution = mergeStats([], facetResult.responseTypes || []);
        const serverRequestStats = mergeStats([], facetResult.serverStats || []);

        const serverRequests = {};
        addedServers.forEach(server => {
          const serverIp = server.serverIp;
          const identifier = serverIp.split('.').pop();
          serverRequests[serverIp] = serverRequestStats[identifier] || serverRequestStats[serverIp] || 0;
        });

        return {
          liveTraffic: liveTrafficCount,
          serverRequests,
          customerChange: 'Live data stream active',
          accessMethodDistribution,
          responseTypeDistribution,
          totalTrafficCount,
          totalActiveCustomers
        };
      }

      // Build query filter
      const filter = {};

      if (apiNumber && apiNumber !== 'ALL') {
        filter.apiNumber = apiNumber;
      }

      // Support both email and phone number in customerEmail field (username)
      if (customerEmail) {
        // Use prefix regex to ensure MongoDB can use B-Tree index
        const safePrefix = customerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        filter.customerEmail = { $regex: `^${safePrefix}` }; 
      }

      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);
      }

      if (serverIdentifier) {
        filter.serverIdentifier = serverIdentifier;
      }

      // Get all added servers from ServerHealth
      const addedServers = await ServerHealth.find().select('serverIp').lean();

      // Get statistics
      const twoMinutesAgo = new Date(new Date().getTime() - 120000); // Last 2 minutes

      // Build live traffic filter (last 2 minutes only, ignoring user's date filters)
      const liveTrafficFilter = {};
      if (apiNumber && apiNumber !== 'ALL') {
        liveTrafficFilter.apiNumber = apiNumber;
      }
      if (customerEmail) {
        const safePrefix = customerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        liveTrafficFilter.customerEmail = { $regex: `^${safePrefix}` };
      }
      if (serverIdentifier) {
        liveTrafficFilter.serverIdentifier = serverIdentifier;
      }
      // Check for actual live traffic (last 2 minutes) + a small future buffer for drift
      liveTrafficFilter.date = {
        $gte: twoMinutesAgo,
        $lte: new Date(now.getTime() + 60000)  // 1 min future buffer
      };

      // Debug logging
      console.log(`[Live Traffic] Checking for logs between ${twoMinutesAgo.toISOString()} and ${now.toISOString()}`);

      // Calculate date ranges for customer comparison (today vs yesterday)
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const yesterdayEnd = new Date(todayStart);

      // Build today's customer filter
      const todayCustomerFilter = { ...filter, date: { $gte: todayStart, $lte: now } };

      // 3. Historical Accuracy (Comparison)
      // For comparison, always use the previous 24h period relative to the end of the query or now
      const comparisonEnd = dateFrom ? new Date(dateFrom) : todayStart;
      const comparisonStart = new Date(comparisonEnd.getTime() - 24 * 60 * 60 * 1000);

      const yesterdayCustomerFilter = {
        date: { $gte: comparisonStart, $lt: comparisonEnd }
      };
      if (apiNumber && apiNumber !== 'ALL') yesterdayCustomerFilter.apiNumber = apiNumber;
      if (serverIdentifier) yesterdayCustomerFilter.serverIdentifier = serverIdentifier;

      const yesterdayCustomerCount = await ApiLog.aggregate([
        { $match: yesterdayCustomerFilter },
        { $group: { _id: '$customerEmail' } },
        { $count: 'count' }
      ]).then(res => res[0]?.count || 0);

      // --- HYBRID QUERY ENGINE ---
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0, 0);

      const isCurrentHourIncluded = (!dateTo || new Date(dateTo) >= currentHourStart) && (!dateFrom || new Date(dateFrom) <= now);
      const isFilteredByCustomer = !!customerEmail;

      // 1. History Filter (HourlyStats)
      const historyFilter = {};
      if (apiNumber && apiNumber !== 'ALL') historyFilter.apiNumber = apiNumber;
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;

      historyFilter.date = { $lt: currentHourStart };
      if (dateFrom) historyFilter.date.$gte = new Date(dateFrom);
      if (dateTo) historyFilter.date.$lte = new Date(dateTo);

      // 2. Recent Filter (ApiLog) - ONLY used if HotStats cannot fulfill the request (e.g. complex regex)
      // or if we are looking at a specific partial hour in the past (which shouldn't happen with 1h chunks)
      const recentFilter = { ...filter };
      recentFilter.date = {
        $gte: dateFrom && new Date(dateFrom) > currentHourStart ? new Date(dateFrom) : currentHourStart,
        $lte: now
      };
      console.log(`[Dashboard] historyFilter: ${JSON.stringify(historyFilter)}`);
      console.log(`[Dashboard] recentFilter: ${JSON.stringify(recentFilter)}`);
      console.log(`[Dashboard] hotStats summary total: ${hotStats.getSummary().totalRequests}`);

      // 3. HotStats Optimization
      // If we are looking for the "Current Hour", we use the in-memory HotStats
      const live = hotStats.getSummary();

      // Helper to extract filtered stats from HotStats
      const getFilteredHotStats = () => {
        // If there's a customer filter, we MUST use MongoDB (too complex for simple in-memory)
        if (isFilteredByCustomer) return null;

        let total = live.totalRequests;
        let success = live.successCount;
        let methods = live.methodStats;
        let servers = live.serverStats;

        // Apply Server/API filters to HotStats if present
        if (serverIdentifier || (apiNumber && apiNumber !== 'ALL')) {
          // This is a simplified version; for precision with complex filters, 
          // the dashboard will fall back to Mongo if needed.
          // But for the main "1000 RPS" case (empty filter), this is lightning fast.
          if (serverIdentifier && !apiNumber) {
            total = live.serverStats[serverIdentifier] || 0;
            // Simplified success rate per server is not stored, so we fallback
            return null;
          }
          if (apiNumber && apiNumber !== 'ALL' && !serverIdentifier) {
            total = live.apiStats[apiNumber] || 0;
            return null;
          }
          return null; // Fallback for combined filters
        }

        return {
          total,
          success,
          statusDistribution: live.statusDistribution || [],
          methods: Object.entries(methods).map(([id, count]) => ({ _id: id, count })),
          servers: Object.entries(servers).map(([id, count]) => ({ _id: id, count }))
        };
      };

      const hot = getFilteredHotStats();

      // Helper to merge [{_id, count}] arrays into a flat object
      const mergeStats = (history, recent) => {
        const merged = {};
        if (Array.isArray(history)) history.forEach(h => merged[h._id] = (merged[h._id] || 0) + h.count);
        if (Array.isArray(recent)) recent.forEach(r => merged[r._id] = (merged[r._id] || 0) + r.count);
        return merged;
      };

      let totalActiveCustomers, totalTrafficCount, liveTrafficCount;
      let accessMethodDistribution, responseTypeDistribution, serverRequestStats;

      if (isFilteredByCustomer) {
        // --- CUSTOMER-FILTERED PATH ---
        // HourlyStats has no customerEmail field, so we bypass it entirely.
        // A single $facet aggregation on ApiLog gives all metrics in one indexed scan.
        console.log('[Dashboard] Customer filter active — using ApiLog $facet path');

        const [facetResult, liveTrafCount] = await Promise.all([
          ApiLog.aggregate([
            { $match: filter },
            {
              $facet: {
                uniqueCustomers: [
                  { $group: { _id: '$customerEmail' } },
                  { $count: 'count' }
                ],
                totalCount: [
                  { $count: 'count' }
                ],
                accessMethods: [
                  { $group: { _id: '$accessMethod', count: { $sum: 1 } } }
                ],
                responseTypes: [
                  {
                    $group: {
                      _id: {
                        $cond: [
                          { $eq: [{ $toLower: '$status' }, 'information'] },
                          'Information',
                          '$status'
                        ]
                      },
                      count: { $sum: 1 }
                    }
                  }
                ],
                serverStats: [
                  { $group: { _id: '$serverIdentifier', count: { $sum: 1 } } }
                ]
              }
            }
          ]).then(res => res[0] || {}),
          ApiLog.countDocuments(liveTrafficFilter)
        ]);

        totalActiveCustomers = facetResult.uniqueCustomers?.[0]?.count || 0;
        totalTrafficCount = facetResult.totalCount?.[0]?.count || 0;
        liveTrafficCount = liveTrafCount;
        accessMethodDistribution = mergeStats([], facetResult.accessMethods || []);
        responseTypeDistribution = mergeStats([], facetResult.responseTypes || []);
        serverRequestStats = mergeStats([], facetResult.serverStats || []);

      } else {
        // --- DEFAULT PATH: HourlyStats (history) + HotStats/ApiLog (current hour) ---
        const [
          activeCustomers,
          trafficCountHistory,
          trafficCountRecent,
          methodStatsHistory,
          methodStatsRecent,
          responseTypeHistory,
          responseTypeRecent,
          liveCount,
          serverReqHistory,
          serverReqRecent
        ] = await Promise.all([
          // Active unique customers
          ApiLog.aggregate([
            { $match: filter },
            { $group: { _id: '$customerEmail' } },
            { $count: 'count' }
          ]).then(res => res[0]?.count || 0),

          // Total traffic
          HourlyStats.aggregate([
            { $match: historyFilter },
            { $group: { _id: null, total: { $sum: '$totalRequests' } } }
          ]).then(res => (res[0]?.total || 0)),
          hot ? Promise.resolve(hot.total) : ApiLog.countDocuments(recentFilter),

          // Access method (History)
          HourlyStats.aggregate([
            { $match: historyFilter },
            { $group: { _id: '$accessMethod', count: { $sum: '$totalRequests' } } }
          ]),
          hot ? Promise.resolve(hot.methods) : ApiLog.aggregate([
            { $match: recentFilter },
            { $group: { _id: '$accessMethod', count: { $sum: 1 } } }
          ]),

          // Response type distribution (History)
          HourlyStats.aggregate([
            { $match: historyFilter },
            {
              $group: {
                _id: null,
                Information: { $sum: '$successCount' },
                Warning: { $sum: '$warningCount' },
                Error: { $sum: '$errorCount' },
                Critical: { $sum: '$criticalCount' }
              }
            }
          ]).then(res => {
            if (!res[0]) return [];
            return [
              { _id: 'Information', count: res[0].Information || 0 },
              { _id: 'Warning', count: res[0].Warning || 0 },
              { _id: 'Error', count: res[0].Error || 0 },
              { _id: 'Critical', count: res[0].Critical || 0 }
            ];
          }),
          hot ? Promise.resolve(hot.statusDistribution) : ApiLog.aggregate([
            { $match: recentFilter },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: [{ $toLower: "$status" }, "information"] },
                    "Information",
                    "$status"
                  ]
                },
                count: { $sum: 1 }
              }
            }
          ]),

          // Live traffic
          hot ? Promise.resolve(hot.total) : ApiLog.countDocuments(liveTrafficFilter),

          // Server stats
          HourlyStats.aggregate([
            { $match: historyFilter },
            { $group: { _id: '$serverIdentifier', count: { $sum: '$totalRequests' } } }
          ]),
          hot ? Promise.resolve(hot.servers) : ApiLog.aggregate([
            { $match: recentFilter },
            { $group: { _id: '$serverIdentifier', count: { $sum: 1 } } }
          ])
        ]);

        console.log(`[Dashboard] History Count: ${trafficCountHistory}`);
        console.log(`[Dashboard] Recent Count: ${trafficCountRecent}`);

        totalActiveCustomers = activeCustomers;
        totalTrafficCount = trafficCountHistory + trafficCountRecent;
        liveTrafficCount = liveCount;
        accessMethodDistribution = mergeStats(methodStatsHistory, methodStatsRecent);
        responseTypeDistribution = mergeStats(responseTypeHistory, responseTypeRecent);
        serverRequestStats = mergeStats(serverReqHistory, serverReqRecent);
      }

      // --- COMMON: Map server IPs to their request counts ---
      const serverRequests = {};
      addedServers.forEach(server => {
        const serverIp = server.serverIp;
        const identifier = serverIp.split('.').pop();
        serverRequests[serverIp] = serverRequestStats[identifier] || serverRequestStats[serverIp] || 0;
      });

      // Customer change percentage
      let customerChangeText = 'Live data stream active';
      if (yesterdayCustomerCount > 0) {
        const customerChangePercent = ((totalActiveCustomers - yesterdayCustomerCount) / yesterdayCustomerCount) * 100;
        const sign = customerChangePercent >= 0 ? '+' : '';
        customerChangeText = `${sign}${customerChangePercent.toFixed(1)}% from comparison period`;
      }

      return {
        liveTraffic: liveTrafficCount,
        serverRequests,
        customerChange: customerChangeText,
        accessMethodDistribution,
        responseTypeDistribution,
        totalTrafficCount,
        totalActiveCustomers
      };
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

/**
 * Get API response times
 */
export const getApiResponseTimes = async (req, res) => {
  const cacheKey = getCacheKey('responseTimes', req.query);

  try {
    const data = await withCache(cacheKey, async () => {
      const { apiNumber, customerEmail: rtCustomerEmail, dateFrom, dateTo, serverIdentifier, last15MinsOnly } = req.query;

      if (last15MinsOnly === 'true') {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const filter15 = {
          date: { $gte: fifteenMinutesAgo, $lte: now }
        };
        if (apiNumber && apiNumber !== 'ALL') filter15.apiNumber = apiNumber;
        if (serverIdentifier) filter15.serverIdentifier = serverIdentifier;
        if (rtCustomerEmail) {
          const safePrefix = rtCustomerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          filter15.customerEmail = { $regex: `^${safePrefix}` };
        }

        const recent = await ApiLog.aggregate([
          { $match: filter15 },
          {
            $group: {
              _id: '$apiNumber',
              totalRT: { $sum: '$responseTime' },
              minRT: { $min: '$responseTime' },
              maxRT: { $max: '$responseTime' },
              count: { $sum: 1 }
            }
          }
        ]);

        return recent.map(r => ({
          apiNumber: r._id,
          apiName: apiMapping[r._id] || 'Unknown',
          avgResponseTime: r.count > 0 ? Math.round(r.totalRT / r.count) : 0,
          minResponseTime: r.minRT || 0,
          maxResponseTime: r.maxRT || 0,
          requestCount: r.count
        })).sort((a, b) => b.avgResponseTime - a.avgResponseTime);
      }

      const filter = {};
      if (apiNumber && apiNumber !== 'ALL') filter.apiNumber = apiNumber;
      if (serverIdentifier) filter.serverIdentifier = serverIdentifier;
      if (rtCustomerEmail) {
        const safePrefix = rtCustomerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        filter.customerEmail = { $regex: `^${safePrefix}` };
      }
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);
      }

      const now = new Date();
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0, 0);

      const historyFilter = { date: { $lt: currentHourStart } };
      if (apiNumber && apiNumber !== 'ALL') historyFilter.apiNumber = apiNumber;
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;
      if (dateFrom) historyFilter.date.$gte = new Date(dateFrom);

      const recentFilter = { ...filter, date: { $gte: currentHourStart, $lte: now } };

      let history, recent;
      if (rtCustomerEmail) {
        // Customer filter: skip HourlyStats, query ApiLog for full date range
        history = [];
        recent = await ApiLog.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$apiNumber',
              totalRT: { $sum: '$responseTime' },
              minRT: { $min: '$responseTime' },
              maxRT: { $max: '$responseTime' },
              count: { $sum: 1 }
            }
          }
        ]);
      } else {
        [history, recent] = await Promise.all([
          HourlyStats.aggregate([
            { $match: historyFilter },
            {
              $group: {
                _id: '$apiNumber',
                totalRT: { $sum: '$totalResponseTime' },
                count: { $sum: '$totalRequests' },
                minRT: { $min: '$minResponseTime' },
                maxRT: { $max: '$maxResponseTime' }
              }
            }
          ]),
          ApiLog.aggregate([
            { $match: recentFilter },
            {
              $group: {
                _id: '$apiNumber',
                totalRT: { $sum: '$responseTime' },
                minRT: { $min: '$responseTime' },
                maxRT: { $max: '$responseTime' },
                count: { $sum: 1 }
              }
            }
          ])
        ]);
      }

      const apiMap = {};
      const merge = (results) => {
        results.forEach(s => {
          if (!apiMap[s._id]) apiMap[s._id] = { totalRT: 0, count: 0, min: Infinity, max: 0 };
          apiMap[s._id].totalRT += s.totalRT;
          apiMap[s._id].count += s.count;
          if (s.minRT < apiMap[s._id].min) apiMap[s._id].min = s.minRT;
          if (s.maxRT > apiMap[s._id].max) apiMap[s._id].max = s.maxRT;
        });
      };

      merge(history);
      merge(recent);

      return Object.entries(apiMap)
        .map(([apiNumber, stats]) => ({
          apiNumber,
          apiName: apiMapping[apiNumber] || 'Unknown',
          avgResponseTime: stats.count > 0 ? Math.round(stats.totalRT / stats.count) : 0,
          minResponseTime: stats.min === Infinity ? 0 : stats.min,
          maxResponseTime: stats.max,
          requestCount: stats.count
        }))
        .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        .slice(0, 10);
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getApiResponseTimes:', error);
    res.status(500).json({ success: false, message: 'Error fetching response times', error: error.message });
  }
};

/**
 * Get API success rates
 */
export const getApiSuccessRates = async (req, res) => {
  const cacheKey = getCacheKey('successRates', req.query);

  try {
    const data = await withCache(cacheKey, async () => {
      const { customerEmail: srCustomerEmail, dateFrom, dateTo, serverIdentifier, last15MinsOnly } = req.query;

      if (last15MinsOnly === 'true') {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const filter15 = {
          date: { $gte: fifteenMinutesAgo, $lte: now }
        };
        if (serverIdentifier) filter15.serverIdentifier = serverIdentifier;
        if (srCustomerEmail) {
          const safePrefix = srCustomerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
          filter15.customerEmail = { $regex: `^${safePrefix}` };
        }

        const recent = await ApiLog.aggregate([
          { $match: filter15 },
          {
            $group: {
              _id: '$apiNumber',
              total: { $sum: 1 },
              successful: {
                $sum: {
                  $cond: [
                    { $regexMatch: { input: '$status', regex: /^information$/i } },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]);

        return recent.map(r => ({
          apiNumber: r._id,
          apiName: apiMapping[r._id] || 'Unknown',
          successRate: r.total > 0 ? Math.round((r.successful / r.total) * 10000) / 100 : 0,
          totalRequests: r.total
        })).sort((a, b) => b.totalRequests - a.totalRequests);
      }

      const filter = {};
      if (serverIdentifier) filter.serverIdentifier = serverIdentifier;
      if (srCustomerEmail) {
        const safePrefix = srCustomerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        filter.customerEmail = { $regex: `^${safePrefix}` };
      }
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const historyFilter = { date: { $lt: oneHourAgo } };
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;
      if (dateFrom) historyFilter.date.$gte = new Date(dateFrom);

      const recentFilter = { ...filter, date: { $gte: oneHourAgo, $lte: now } };

      let history, recent;
      if (srCustomerEmail) {
        // Customer filter: skip HourlyStats, query ApiLog for full date range
        history = [];
        recent = await ApiLog.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$apiNumber',
              total: { $sum: 1 },
              successful: {
                $sum: {
                  $cond: [
                    { $regexMatch: { input: '$status', regex: /^information$/i } },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]);
      } else {
        [history, recent] = await Promise.all([
          HourlyStats.aggregate([
            { $match: historyFilter },
            {
              $group: {
                _id: '$apiNumber',
                total: { $sum: '$totalRequests' },
                successful: { $sum: '$successCount' }
              }
            }
          ]),
          ApiLog.aggregate([
            { $match: recentFilter },
            {
              $group: {
                _id: '$apiNumber',
                total: { $sum: 1 },
                successful: {
                  $sum: {
                    $cond: [
                      { $regexMatch: { input: "$status", regex: /^information$/i } },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ])
        ]);
      }

      const apiMap = {};
      const merge = (results) => {
        results.forEach(stat => {
          if (!apiMap[stat._id]) apiMap[stat._id] = { total: 0, successful: 0 };
          apiMap[stat._id].total += stat.total;
          apiMap[stat._id].successful += stat.successful;
        });
      };

      merge(history);
      merge(recent);

      return Object.entries(apiMap)
        .map(([apiNumber, stats]) => ({
          apiNumber,
          apiName: apiMapping[apiNumber] || 'Unknown',
          successRate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 10000) / 100 : 0,
          totalRequests: stats.total
        }))
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 10);
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getApiSuccessRates:', error);
    res.status(500).json({ success: false, message: 'Error fetching success rates', error: error.message });
  }
};

/**
 * Get live traffic data (time series)
 */
export const getLiveTraffic = async (req, res) => {
  try {
    const { minutes = 30, serverIdentifier, customerEmail: ltCustomerEmail } = req.query;
    const now = new Date();
    // Increase window and add future buffer for clock drift
    const timeAgo = new Date(now.getTime() - (parseInt(minutes) + 10) * 60000);
    const futureBuffer = new Date(now.getTime() + 5 * 60000); // 5 min future buffer

    const filter = {
      date: { $gte: timeAgo, $lte: futureBuffer }
    };

    if (serverIdentifier) {
      filter.serverIdentifier = serverIdentifier;
    }
    if (ltCustomerEmail) {
      const safePrefix = ltCustomerEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      filter.customerEmail = { $regex: `^${safePrefix}` };
    }

    // Group by 2-minute intervals for smoother visualization
    const intervalMinutes = 2;

    const trafficData = await ApiLog.aggregate([
      {
        $match: filter
      },
      {
        $group: {
          _id: {
            $subtract: [
              { $toLong: '$date' },
              { $mod: [{ $toLong: '$date' }, intervalMinutes * 60 * 1000] }
            ]
          },
          timestamp: { $first: '$date' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          timestamp: 1,
          count: 1
        }
      }
    ]);

    // Fill in missing time slots with zero values for continuous line
    const result = [];
    const intervalMs = intervalMinutes * 60 * 1000;
    const startTime = Math.floor(timeAgo.getTime() / intervalMs) * intervalMs;
    const endTime = Math.floor(now.getTime() / intervalMs) * intervalMs;

    const dataMap = new Map();
    trafficData.forEach(item => {
      const roundedTime = Math.floor(new Date(item.timestamp).getTime() / intervalMs) * intervalMs;
      dataMap.set(roundedTime, item.count);
    });

    for (let time = startTime; time <= endTime; time += intervalMs) {
      const date = new Date(time);
      result.push({
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        count: dataMap.get(time) || 0
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getLiveTraffic:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching live traffic data',
      error: error.message
    });
  }
};

/**
 * Get API details table data
 */
export const getApiDetails = async (req, res) => {
  const cacheKey = getCacheKey('apiDetails', req.query);

  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await withCache(cacheKey, async () => {
      const { apiNumber, dateFrom, dateTo, serverIdentifier } = req.query;
      let { minutes, last15MinsOnly } = req.query;
      if (last15MinsOnly === 'true' && !minutes && !dateFrom && !dateTo) {
        minutes = 15;
      }

      const filter = {};
      if (apiNumber && apiNumber !== 'ALL') filter.apiNumber = apiNumber;
      if (serverIdentifier) filter.serverIdentifier = serverIdentifier;

      const now = new Date();
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0, 0);

      const historyFilter = { date: { $lt: currentHourStart } };
      if (apiNumber && apiNumber !== 'ALL') historyFilter.apiNumber = apiNumber;
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;

      const recentFilter = { ...filter };
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);

        recentFilter.date = {};
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        if (fromDate) historyFilter.date.$gte = fromDate;
        if (toDate) historyFilter.date.$lte = toDate;
        recentFilter.date.$gte = fromDate && fromDate > currentHourStart ? fromDate : currentHourStart;
        recentFilter.date.$lte = toDate && toDate < now ? toDate : now;
      } else if (minutes) {
        const minsNum = parseFloat(minutes);
        if (!isNaN(minsNum) && minsNum > 0) {
          const fromDate = new Date(now.getTime() - minsNum * 60 * 1000);
          filter.date = { $gte: fromDate, $lte: now };
          recentFilter.date = { $gte: fromDate, $lte: now };
          historyFilter.date = { $lt: new Date(0) };
        } else {
          recentFilter.date = { $gte: currentHourStart, $lte: now };
        }
      } else {
        recentFilter.date = { $gte: currentHourStart, $lte: now };
      }

      const [statsHistory, statsRecent, totalApis] = await Promise.all([
        HourlyStats.aggregate([
          { $match: historyFilter },
          {
            $group: {
              _id: '$apiNumber',
              totalRT: { $sum: '$totalResponseTime' },
              count: { $sum: '$totalRequests' },
              successCount: { $sum: '$successCount' }
            }
          }
        ]),
        ApiLog.aggregate([
          { $match: recentFilter },
          {
            $group: {
              _id: '$apiNumber',
              totalRT: { $sum: '$responseTime' },
              count: { $sum: 1 },
              successCount: {
                $sum: {
                  $cond: [
                    { $regexMatch: { input: "$status", regex: /^information$/i } },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        // Combined distinct count
        // HotStats Optimization: If no specific filters, we can skip API log scan
        Promise.all([
          HourlyStats.distinct('apiNumber', historyFilter),
          hotStats.getSummary().totalRequests > 0 && !dateFrom && !dateTo && !minutes
            ? Promise.resolve(Object.keys(hotStats.getSummary().apiStats))
            : ApiLog.distinct('apiNumber', recentFilter)
        ]).then(([hist, rec]) => new Set([...hist, ...rec]).size)
      ]);

      const apiMap = {};
      const merge = (results) => {
        results.forEach(stat => {
          if (!apiMap[stat._id]) apiMap[stat._id] = { totalRT: 0, count: 0, successCount: 0 };
          apiMap[stat._id].totalRT += stat.totalRT;
          apiMap[stat._id].count += stat.count;
          apiMap[stat._id].successCount += stat.successCount;
        });
      };

      merge(statsHistory);
      merge(statsRecent);

      const fullStatsArray = Object.entries(apiMap)
        .map(([apiId, stats]) => ({
          apiId,
          method: 'GET',
          path: apiMapping[apiId] || 'Unknown',
          successRate: stats.count > 0 ? `${Math.round((stats.successCount / stats.count) * 100)}%` : '0%',
          avgResponse: stats.count > 0 ? `${Math.round(stats.totalRT / stats.count)}ms` : '0ms',
          requestCount: stats.count
        }))
        .sort((a, b) => b.requestCount - a.requestCount);

      return {
        formattedData: fullStatsArray.slice((page - 1) * limit, page * limit),
        totalApis
      };
    });

    res.json({
      success: true,
      data: result.formattedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(result.totalApis / limit),
        totalItems: result.totalApis,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error in getApiDetails:', error);
    res.status(500).json({ success: false, message: 'Error fetching API details', error: error.message });
  }
};

/**
 * Get available API list for filters
 */
export const getApiList = async (req, res) => {
  try {
    const apiList = Object.entries(apiMapping).map(([number, name]) => ({
      number,
      name
    }));

    res.json({
      success: true,
      data: apiList
    });
  } catch (error) {
    console.error('Error in getApiList:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching API list',
      error: error.message
    });
  }
};

/**
 * Get customer logs by username (email or phone)
 */
export const getCustomerLogs = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Search for logs matching the username (customerEmail field)
    const safePrefix = username.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    
    // Optimization: If it's a phone number or we want speed, we MUST avoid the 'i' flag. 
    // Standard B-Tree indexes in MongoDB are case-sensitive.
    const logs = await ApiLog.find({
      customerEmail: { $regex: `^${safePrefix}` } // Removed 'i' to enable index usage
    })
      .sort({ date: -1 })
      .limit(100)
      .select('date accessMethod status apiNumber responseTime serverIdentifier')
      .lean();

    // Map date back to startTimestamp for backend compatibility with React frontend
    const mappedLogs = logs.map(log => ({
      ...log,
      startTimestamp: new Date(log.date).getTime().toString()
    }));

    res.json({
      success: true,
      data: mappedLogs
    });
  } catch (error) {
    console.error('Error in getCustomerLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer logs',
      error: error.message
    });
  }
};

/**
 * Get top 20 APIs with highest success rate
 */
export const getTopSuccessApis = async (req, res) => {
  const cacheKey = getCacheKey('topSuccess', req.query);

  try {
    const data = await withCache(cacheKey, async () => {
      const { dateFrom, dateTo, serverIdentifier, limit } = req.query;
      let { minutes, last15MinsOnly } = req.query;
      if (last15MinsOnly === 'true' && !minutes && !dateFrom && !dateTo) {
        minutes = 15;
      }
      const limitValue = limit ? parseInt(limit, 10) : 20;

      const filter = {};
      if (serverIdentifier) filter.serverIdentifier = serverIdentifier;

      const now = new Date();
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0, 0);

      const historyFilter = { date: { $lt: currentHourStart } };
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;

      const recentFilter = { ...filter };
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);

        recentFilter.date = {};
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        if (fromDate) historyFilter.date.$gte = fromDate;
        if (toDate) historyFilter.date.$lte = toDate;
        recentFilter.date.$gte = fromDate && fromDate > currentHourStart ? fromDate : currentHourStart;
        recentFilter.date.$lte = toDate && toDate < now ? toDate : now;
      } else if (minutes) {
        const minsNum = parseFloat(minutes);
        if (!isNaN(minsNum) && minsNum > 0) {
          const fromDate = new Date(now.getTime() - minsNum * 60 * 1000);
          filter.date = { $gte: fromDate, $lte: now };
          recentFilter.date = { $gte: fromDate, $lte: now };
          historyFilter.date = { $lt: new Date(0) };
        } else {
          recentFilter.date = { $gte: currentHourStart, $lte: now };
        }
      } else {
        recentFilter.date = { $gte: currentHourStart, $lte: now };
      }

      const [history, recent] = await Promise.all([
        HourlyStats.aggregate([
          { $match: historyFilter },
          {
            $group: {
              _id: '$apiNumber',
              total: { $sum: '$totalRequests' },
              successful: { $sum: '$successCount' },
              totalRT: { $sum: '$totalResponseTime' }
            }
          }
        ]),
        ApiLog.aggregate([
          { $match: recentFilter },
          {
            $group: {
              _id: '$apiNumber',
              total: { $sum: 1 },
              successful: {
                $sum: {
                  $cond: [
                    { $regexMatch: { input: "$status", regex: /^information$/i } },
                    1,
                    0
                  ]
                }
              },
              totalRT: { $sum: '$responseTime' }
            }
          }
        ])
      ]);

      const apiMap = {};
      const merge = (results) => {
        results.forEach(stat => {
          if (!apiMap[stat._id]) apiMap[stat._id] = { total: 0, successful: 0, totalRT: 0 };
          apiMap[stat._id].total += stat.total;
          apiMap[stat._id].successful += stat.successful;
          apiMap[stat._id].totalRT += stat.totalRT || stat.totalResponseTime || 0;
        });
      };

      merge(history);
      merge(recent);

      return Object.entries(apiMap)
        .map(([apiId, stats]) => {
          const successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
          return {
            apiId,
            method: 'GET',
            path: apiMapping[apiId] || 'Unknown',
            successRate: `${Math.round(successRate)}%`,
            avgResponse: stats.total > 0 ? `${Math.round(stats.totalRT / stats.total)}ms` : '0ms',
            requestCount: stats.total,
            _successRateNum: successRate
          };
        })
        .sort((a, b) => b._successRateNum - a._successRateNum)
        .slice(0, limitValue);
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getTopSuccessApis:', error);
    res.status(500).json({ success: false, message: 'Error fetching top success APIs', error: error.message });
  }
};

export const getTopErrorApis = async (req, res) => {
  const cacheKey = getCacheKey('topError', req.query);

  try {
    const data = await withCache(cacheKey, async () => {
      const { dateFrom, dateTo, serverIdentifier, limit } = req.query;
      let { minutes, last15MinsOnly } = req.query;
      if (last15MinsOnly === 'true' && !minutes && !dateFrom && !dateTo) {
        minutes = 15;
      }
      const limitValue = limit ? parseInt(limit, 10) : 20;

      const filter = {};
      if (serverIdentifier) filter.serverIdentifier = serverIdentifier;

      const now = new Date();
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0, 0);

      const historyFilter = { date: { $lt: currentHourStart } };
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;

      const recentFilter = { ...filter };
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = new Date(dateFrom);
        if (dateTo) filter.date.$lte = new Date(dateTo);

        recentFilter.date = {};
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo) : null;
        if (fromDate) historyFilter.date.$gte = fromDate;
        if (toDate) historyFilter.date.$lte = toDate;
        recentFilter.date.$gte = fromDate && fromDate > currentHourStart ? fromDate : currentHourStart;
        recentFilter.date.$lte = toDate && toDate < now ? toDate : now;
      } else if (minutes) {
        const minsNum = parseFloat(minutes);
        if (!isNaN(minsNum) && minsNum > 0) {
          const fromDate = new Date(now.getTime() - minsNum * 60 * 1000);
          filter.date = { $gte: fromDate, $lte: now };
          recentFilter.date = { $gte: fromDate, $lte: now };
          historyFilter.date = { $lt: new Date(0) };
        } else {
          recentFilter.date = { $gte: currentHourStart, $lte: now };
        }
      } else {
        recentFilter.date = { $gte: currentHourStart, $lte: now };
      }

      const [history, recent] = await Promise.all([
        HourlyStats.aggregate([
          { $match: historyFilter },
          {
            $group: {
              _id: '$apiNumber',
              total: { $sum: '$totalRequests' },
              errors: { $sum: '$errorCount' },
              totalRT: { $sum: '$totalResponseTime' }
            }
          }
        ]),
        ApiLog.aggregate([
          { $match: recentFilter },
          {
            $group: {
              _id: '$apiNumber',
              total: { $sum: 1 },
              errors: {
                $sum: {
                  $cond: [
                    { $regexMatch: { input: "$status", regex: /^(error|critical|warning)$/i } },
                    1,
                    0
                  ]
                }
              },
              totalRT: { $sum: '$responseTime' }
            }
          }
        ])
      ]);

      const apiMap = {};
      const merge = (results) => {
        results.forEach(stat => {
          if (!apiMap[stat._id]) apiMap[stat._id] = { total: 0, errors: 0, totalRT: 0 };
          apiMap[stat._id].total += stat.total;
          apiMap[stat._id].errors += stat.errors;
          apiMap[stat._id].totalRT += stat.totalRT || stat.totalResponseTime || 0;
        });
      };

      merge(history);
      merge(recent);

      return Object.entries(apiMap)
        .map(([apiId, stats]) => {
          const errorRate = stats.total > 0 ? (stats.errors / stats.total) * 100 : 0;
          const successRate = 100 - errorRate;
          return {
            apiId,
            method: 'GET',
            path: apiMapping[apiId] || 'Unknown',
            successRate: `${Math.round(successRate)}%`,
            avgResponse: stats.total > 0 ? `${Math.round(stats.totalRT / stats.total)}ms` : '0ms',
            requestCount: stats.total,
            _errorRateNum: errorRate
          };
        })
        .sort((a, b) => b._errorRateNum - a._errorRateNum)
        .slice(0, limitValue);
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getTopErrorApis:', error);
    res.status(500).json({ success: false, message: 'Error fetching top error APIs', error: error.message });
  }
};

/**
 * Get API success rate history over time for a specific API
 */
export const getApiSuccessRateHistory = async (req, res) => {
  const cacheKey = getCacheKey('successHistory', req.query);

  try {
    const data = await withCache(cacheKey, async () => {
      const { apiNumber, hours = 24, dateFrom, dateTo, serverIdentifier } = req.query;

      const hoursNum = parseInt(hours);
      const now = new Date();
      const startTime = dateFrom ? new Date(dateFrom) : new Date(now.getTime() - hoursNum * 60 * 60 * 1000);
      const endTime = dateTo ? new Date(dateTo) : now;
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0, 0);

      const historyFilter = { date: { $gte: startTime, $lt: currentHourStart } };
      if (apiNumber && apiNumber !== 'ALL') historyFilter.apiNumber = apiNumber;
      if (serverIdentifier) historyFilter.serverIdentifier = serverIdentifier;

      const recentFilter = { date: { $gte: currentHourStart, $lte: endTime } };
      if (apiNumber && apiNumber !== 'ALL') recentFilter.apiNumber = apiNumber;
      if (serverIdentifier) recentFilter.serverIdentifier = serverIdentifier;

      const [history, recent] = await Promise.all([
        HourlyStats.aggregate([
          { $match: historyFilter },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' },
                hour: { $hour: '$date' }
              },
              total: { $sum: '$totalRequests' },
              success: { $sum: '$successCount' },
              timestamp: { $first: '$date' }
            }
          }
        ]),
        ApiLog.aggregate([
          { $match: recentFilter },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' },
                hour: { $hour: '$date' }
              },
              total: { $sum: 1 },
              success: {
                $sum: {
                  $cond: [
                    { $regexMatch: { input: "$status", regex: /^information$/i } },
                    1,
                    0
                  ]
                }
              },
              timestamp: { $first: '$date' }
            }
          }
        ])
      ]);

      const mergedMap = new Map();
      const merge = (results) => {
        results.forEach(item => {
          const key = `${item._id.year}-${item._id.month}-${item._id.day}-${item._id.hour}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, { total: 0, success: 0, timestamp: item.timestamp });
          }
          const current = mergedMap.get(key);
          current.total += item.total || item.totalRequests || 0;
          current.success += item.success || item.successRequests || 0;
        });
      };

      merge(history);
      merge(recent);

      return Array.from(mergedMap.values())
        .map(item => ({
          timestamp: item.timestamp,
          successRate: item.total > 0 ? (item.success / item.total) * 100 : 0,
          totalRequests: item.total,
          successRequests: item.success
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in getApiSuccessRateHistory:', error);
    res.status(500).json({ success: false, message: 'Error fetching success rate history', error: error.message });
  }
};
