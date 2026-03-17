import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import ApiLog from './src/models/ApiLog.js';
import HourlyStats from './src/models/HourlyStats.js';

dotenv.config();

/**
 * COMPREHENSIVE PRODUCTION VALIDATION SCRIPT
 * Audits 100% of dashboard metrics against raw database records.
 */
const runFullAudit = async () => {
    try {
        await connectDB();
        console.log('\n=========================================');
        console.log('�️  MYSLT DASHBOARD: DEEP DATA AUDIT');
        console.log('=========================================\n');

        const now = new Date();
        const hourStart = new Date(now);
        hourStart.setMinutes(0, 0, 0, 0);

        // 1. UNIQUE CUSTOMER AUDIT
        console.log('--- [1] CUSTOMER METRICS ---');
        const totalUniqueCustomers = await ApiLog.distinct('customerEmail');
        console.log(`Total Database Users:    ${totalUniqueCustomers.length.toLocaleString()}`);

        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const todayUnique = await ApiLog.distinct('customerEmail', { date: { $gte: todayStart } });
        console.log(`Today Active Users:      ${todayUnique.length.toLocaleString()}\n`);

        // 2. TRAFFIC SYNC AUDIT (RAW vs HYBRID)
        console.log('--- [2] TRAFFIC SYNCHRONIZATION ---');
        const rawTotal = await ApiLog.countDocuments({});
        const statsSummary = await HourlyStats.aggregate([
            { $group: { _id: null, total: { $sum: "$totalRequests" } } }
        ]);
        const statsTotal = statsSummary[0]?.total || 0;
        const syncPercent = (statsTotal / rawTotal) * 100;

        console.log(`Raw Logs (ApiLog):       ${rawTotal.toLocaleString()}`);
        console.log(`Summary Records (Stats): ${statsTotal.toLocaleString()}`);
        console.log(`Synchronization:         ${syncPercent.toFixed(2)}%`);

        if (syncPercent < 95) {
            console.log('⚠️  ALERT: Critical Data Desync. Please run: node src/utils/backfillStats.js\n');
        } else {
            console.log('✅ Synchronized\n');
        }

        // 3. STATUS DISTRIBUTION (4-WAY)
        console.log('--- [3] RESPONSE TYPE DISTRIBUTION ---');
        const rawStatus = await ApiLog.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        console.log('Status        | Raw Record Count');
        console.log('--------------|-----------------');
        const types = ['Information', 'Warning', 'Error', 'Critical'];
        types.forEach(t => {
            const count = rawStatus.find(rs => rs._id === t)?.count ||
                rawStatus.find(rs => rs._id.toLowerCase() === t.toLowerCase())?.count || 0;
            console.log(`${t.padEnd(14)}| ${count.toLocaleString().padEnd(17)}`);
        });
        console.log('\n');

        // 4. SERVER AUDIT
        console.log('--- [4] SERVER INGESTION ---');
        const servers = await ApiLog.aggregate([
            { $group: { _id: "$serverIdentifier", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        console.log('Server IP           | Log Volume');
        console.log('--------------------|-----------');
        servers.forEach(s => {
            console.log(`${s._id.padEnd(20)}| ${s.count.toLocaleString()}`);
        });

        // 5. HOURLY GAP DETECTION
        console.log('\n--- [5] RECENT HOURLY ACTIVITY ---');
        const last6Hours = await HourlyStats.find({ date: { $gte: new Date(Date.now() - 6 * 3600000) } })
            .sort({ date: -1 });

        if (last6Hours.length === 0) {
            console.log('❌ No pre-aggregated data for the last 6 hours.');
        } else {
            console.log('Hour (UTC)           | Requests');
            console.log('---------------------|---------');
            last6Hours.forEach(h => {
                console.log(`${h.date.toISOString().padEnd(21)}| ${h.totalRequests.toLocaleString()}`);
            });
        }

        console.log('\nAudit complete.\n');
        process.exit(0);
    } catch (err) {
        console.error('Audit Error:', err);
        process.exit(1);
    }
};

runFullAudit();
