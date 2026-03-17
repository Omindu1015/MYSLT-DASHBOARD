import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import ApiLog from './src/models/ApiLog.js';
import HourlyStats from './src/models/HourlyStats.js';

dotenv.config();

/**
 * PRODUCTION VALIDATION SCRIPT
 * This script audits the "Hybrid Engine" numbers against "Raw Data"
 */
const validate = async () => {
    try {
        await connectDB();
        console.log('\n🔍 --- PRODUCTION DATA AUDIT START --- 🔍\n');

        // 1. Total Traffic Audit
        const rawTotal = await ApiLog.countDocuments({});
        const statsAggregation = await HourlyStats.aggregate([
            { $group: { _id: null, total: { $sum: "$totalRequests" } } }
        ]);
        const statsTotal = statsAggregation[0]?.total || 0;

        console.log('--- [1] TOTAL TRAFFIC ---');
        console.log(`Raw ApiLogs:    ${rawTotal.toLocaleString()}`);
        console.log(`HourlyStats:    ${statsTotal.toLocaleString()}`);
        console.log(`Sync Status:    ${rawTotal === statsTotal ? '✅ MATCH' : '⚠️ MISMATCH'}`);
        console.log(`Synchronization: ${((statsTotal / rawTotal) * 100).toFixed(2)}%\n`);

        // 2. Status Distribution Audit
        const rawStatus = await ApiLog.aggregate([
            { $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } }
        ]);

        const statsStatus = await HourlyStats.aggregate([
            {
                $group: {
                    _id: null,
                    information: { $sum: "$successCount" },
                    warning: { $sum: "$warningCount" },
                    error: { $sum: "$errorCount" },
                    critical: { $sum: "$criticalCount" }
                }
            }
        ]);

        console.log('--- [2] STATUS DISTRIBUTION ---');
        console.log('Status        | Raw Log Count | HourlyStats Sum');
        console.log('--------------|---------------|----------------');

        const types = ['information', 'warning', 'error', 'critical'];
        types.forEach(t => {
            const raw = rawStatus.find(rs => rs._id === t)?.count || 0;
            const stat = statsStatus[0]?.[t] || 0;
            console.log(`${t.padEnd(14)}| ${raw.toString().padEnd(14)}| ${stat.toString().padEnd(14)}`);
        });
        console.log('\n');

        // 3. Server Distribution Audit
        const rawServers = await ApiLog.aggregate([
            { $group: { _id: "$serverIdentifier", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const statsServers = await HourlyStats.aggregate([
            { $group: { _id: "$serverIdentifier", count: { $sum: "$totalRequests" } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('--- [3] SERVER REQUEST DISTRIBUTION ---');
        console.log('Server ID          | Raw Log Count | HourlyStats Sum');
        console.log('-------------------|---------------|----------------');
        rawServers.forEach(rs => {
            const stat = statsServers.find(ss => ss._id === rs._id)?.count || 0;
            console.log(`${rs._id.padEnd(19)}| ${rs.count.toString().padEnd(14)}| ${stat.toString().padEnd(14)}`);
        });

        console.log('\n💡 Tip: Sync percentages slightly below 100% are normal if the hour has not yet been processed by the scheduler.\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Audit Failed:', error);
        process.exit(1);
    }
};

validate();
