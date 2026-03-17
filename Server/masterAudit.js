import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import ApiLog from './src/models/ApiLog.js';
import HourlyStats from './src/models/HourlyStats.js';

dotenv.config();

/**
 * MASTER PRODUCTION AUDIT SCRIPT
 * Compares "Raw Reality" vs "Dashboard Summary" vs "Customer Population"
 */
const runMasterAudit = async () => {
    try {
        await connectDB();
        console.log('\n=========================================');
        console.log('🚀  MASTER DATA AUDIT: PRODUCTION SCALE');
        console.log('=========================================\n');

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        // --- SECTION 1: CUSTOMER POPULATION ---
        console.log('--- [1] CUSTOMER REACH ---');
        const [allTimeUsers, todayUsers] = await Promise.all([
            ApiLog.distinct('customerEmail').then(res => res.length),
            ApiLog.distinct('customerEmail', { date: { $gte: startOfToday } }).then(res => res.length)
        ]);
        console.log(`Unique Customers (All Time): ${allTimeUsers.toLocaleString()}`);
        console.log(`Unique Customers (Today):    ${todayUsers.toLocaleString()}`);
        console.log('💡 Note: If all-time is ~274k, the dashboard card will show this correctly.\n');

        // --- SECTION 2: GRAPH ACCURACY (STATUSES) ---
        console.log('--- [2] RESPONSE TYPE DISTRIBUTION (RAW) ---');
        const rawStatus = await ApiLog.aggregate([
            { $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } }
        ]);

        const statusMap = {
            information: 0,
            warning: 0,
            error: 0,
            critical: 0
        };
        rawStatus.forEach(s => { if (statusMap.hasOwnProperty(s._id)) statusMap[s._id] = s.count; });

        console.log(`Information: ${statusMap.information.toLocaleString()}`);
        console.log(`Warning:     ${statusMap.warning.toLocaleString()}`);
        console.log(`Error:       ${statusMap.error.toLocaleString()}`);
        console.log(`Critical:    ${statusMap.critical.toLocaleString()}\n`);

        // --- SECTION 3: SYNC HEALTH ---
        console.log('--- [3] SYNCHRONIZATION HEALTH ---');
        const [rawTotal, statsTotal] = await Promise.all([
            ApiLog.countDocuments({}),
            HourlyStats.aggregate([{ $group: { _id: null, total: { $sum: "$totalRequests" } } }]).then(res => res[0]?.total || 0)
        ]);

        const syncPercent = (statsTotal / rawTotal) * 100;
        console.log(`Synchronization: ${syncPercent.toFixed(2)}%`);

        if (syncPercent < 90) {
            console.log('⚠️  ALERT: Summary tables are missing data. The Dashboard graphs will be incomplete.');
            console.log('👉 ACTION REQUIRED: Run "node src/utils/backfillStats.js" on production.\n');
        } else {
            console.log('✅ Healthy: Pre-aggregated data is up to date.\n');
        }

        // --- SECTION 4: SERVER IDENTIFICATION ---
        console.log('--- [4] ACTIVE SERVERS ---');
        const servers = await ApiLog.distinct('serverIdentifier');
        console.log(`Detecting Nodes: ${servers.join(', ')}`);

        const volumes = await ApiLog.aggregate([
            { $group: { _id: "$serverIdentifier", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        volumes.forEach(v => {
            console.log(`   - ${v._id.padEnd(15)}: ${v.count.toLocaleString()} logs`);
        });

        console.log('\n=========================================');
        console.log('✅ AUDIT COMPLETE');
        console.log('=========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('Audit crashed:', error);
        process.exit(1);
    }
};

runMasterAudit();
