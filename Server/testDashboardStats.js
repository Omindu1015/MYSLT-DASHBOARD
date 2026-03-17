import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import ApiLog from './src/models/ApiLog.js';
import HourlyStats from './src/models/HourlyStats.js';
import hotStats from './src/utils/hotStats.js';

dotenv.config();

const runTest = async () => {
    await connectDB();
    console.log('connected');

    const now = new Date();
    const currentHourStart = new Date(now);
    currentHourStart.setMinutes(0, 0, 0, 0);

    console.log('Current Hour Start (Local):', currentHourStart.toLocaleString());
    console.log('Current Hour Start (UTC):', currentHourStart.toISOString());

    const historyFilter = { date: { $lt: currentHourStart } };
    const recentFilter = { date: { $gte: currentHourStart, $lte: now } };

    console.log('History Match:', JSON.stringify(historyFilter));
    console.log('Recent Match:', JSON.stringify(recentFilter));

    const totalTrafficHistory = await HourlyStats.aggregate([
        { $match: historyFilter },
        { $group: { _id: null, total: { $sum: '$totalRequests' } } }
    ]);

    const totalTrafficRecent = await ApiLog.countDocuments(recentFilter);
    const totalRaw = await ApiLog.countDocuments({});

    console.log('\nResults:');
    console.log('Total Raw Logs in DB:', totalRaw);
    console.log('Total History Count (HourlyStats):', totalTrafficHistory[0]?.total || 0);
    console.log('Total Recent Count (ApiLog):', totalTrafficRecent);
    console.log('HotStats Total:', hotStats.getSummary().totalRequests);

    process.exit(0);
};

runTest();
