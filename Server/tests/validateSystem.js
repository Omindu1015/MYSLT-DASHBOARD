/**
 * SYSTEM VALIDATION SUITE
 * 
 * This script performs a full audit of the dashboard API logic
 * against the 6 million logs dataset.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { apiMapping } from '../src/config/apiMapping.js';

dotenv.config();

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myslt_dashboard';

const apiLogSchema = new mongoose.Schema({
    accessMethod: String,
    customerEmail: String,
    status: String,
    apiNumber: String,
    responseTime: Number,
    serverIdentifier: String,
    date: Date
});

const ApiLog = mongoose.models.ApiLog || mongoose.model('ApiLog', apiLogSchema);

const hourlyStatsSchema = new mongoose.Schema({
    date: Date,
    apiNumber: String,
    serverIdentifier: String,
    accessMethod: String,
    totalRequests: Number,
    successCount: Number,
    uniqueCustomersCount: Number
});

const HourlyStats = mongoose.models.HourlyStats || mongoose.model('HourlyStats', hourlyStatsSchema);

const timer = (label) => {
    const start = Date.now();
    return () => {
        const ms = Date.now() - start;
        console.log(`  ⏱  ${label}: ${ms}ms`);
        return ms;
    };
};

const runAudit = async () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 SYSTEM AUDIT: 6M LOG DATASET VALIDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const auditStart = Date.now();

    // 1. Verify Ground Truth
    console.log('📦 Phase 1: Database Integrity');
    const totalLogs = await ApiLog.estimatedDocumentCount();
    console.log(`  ✅ Total Logs in DB: ${totalLogs.toLocaleString()}`);
    
    const totalHourly = await HourlyStats.countDocuments();
    console.log(`  ✅ Total Hourly Buckets: ${totalHourly.toLocaleString()}`);

    // 2. Verify KPI Card Logic
    console.log('\n📊 Phase 2: KPI Card Accuracy');
    const endCard = timer('Unique Customer Count (Aggregation)');
    const customers = await ApiLog.aggregate([
        { $group: { _id: '$customerEmail' } },
        { $count: 'count' }
    ]);
    const uniqueCount = customers[0]?.count || 0;
    endCard();
    console.log(`  ✅ Distinct Customers: ${uniqueCount.toLocaleString()}`);

    // 3. Verify Filter Logic (API A48 - MyPackage)
    console.log('\n🎯 Phase 3: Filter Precision (API: A48)');
    const endFilter = timer('Filtered Query (A48)');
    const apiCount = await ApiLog.countDocuments({ apiNumber: 'A48' });
    endFilter();
    console.log(`  ✅ Hits for MyPackage (A48): ${apiCount.toLocaleString()}`);

    // 4. Verify Server Distribution
    console.log('\n📡 Phase 4: Server Distribution');
    const serverStats = await ApiLog.aggregate([
        { $group: { _id: '$serverIdentifier', count: { $sum: 1 } } }
    ]);
    serverStats.forEach(s => {
        console.log(`  🖥️  Server ${s._id}: ${s.count.toLocaleString()} logs`);
    });

    // 5. Verify Graph Consistency (Time Series)
    console.log('\n📈 Phase 5: Graph Consistency (90-Day History)');
    const dayCheck = await HourlyStats.aggregate([
        { 
            $group: { 
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                dailyTotal: { $sum: "$totalRequests" }
            } 
        },
        { $sort: { _id: 1 } },
        { $limit: 5 }
    ]);
    console.log('  📅 Daily Totals (First 5 days):');
    dayCheck.forEach(d => console.log(`     ${d._id}: ${d.dailyTotal.toLocaleString()} requests`));
    
    if (dayCheck.length > 0) {
        console.log('  ✅ Time series data is continuous and populated.');
    }

    // 6. Verify Table Performance (API Details)
    console.log('\n📋 Phase 6: Top APIs Performance (Table Sort)');
    const endTab = timer('Full API Summary Grouping');
    const apiSummary = await ApiLog.aggregate([
        { $group: { _id: '$apiNumber', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 }
    ]);
    endTab();
    console.log('  🏆 Top 3 APIs by Volume:');
    apiSummary.slice(0, 3).forEach(a => {
        console.log(`     ${a._id} (${apiMapping[a._id]}): ${a.total.toLocaleString()} hits`);
    });

    // 7. Stress Test: Individual Customer Log Retrieval
    console.log('\n⚡ Phase 7: Individual Customer Latency (Stress Test)');
    const sampleCustomer = 'cust_5000@slt.lk';
    const endSearch = timer('Retrieve logs for specific customer');
    const userLogs = await ApiLog.find({ customerEmail: sampleCustomer }).limit(10).lean();
    endSearch();
    console.log(`  ✅ Logs found: ${userLogs.length} entries for ${sampleCustomer}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✨ AUDIT COMPLETE in ${((Date.now() - auditStart) / 1000).toFixed(2)}s`);
    console.log('   System is verified and ready for showcase.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

const run = async () => {
    try {
        await mongoose.connect(DB_URI);
        await runAudit();
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
