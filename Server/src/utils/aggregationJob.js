import ApiLog from '../models/ApiLog.js';
import HourlyStats from '../models/HourlyStats.js';

/**
 * Aggregate logs for a specific time range and merge into HourlyStats
 * @param {Date} startTime 
 * @param {Date} endTime 
 */
export const aggregateLogsToStats = async (startTime, endTime) => {
    try {
        console.log(`📊 Aggregating logs from ${startTime.toISOString()} to ${endTime.toISOString()}...`);

        const stats = await ApiLog.aggregate([
            {
                $match: {
                    date: { $gte: startTime, $lt: endTime }
                }
            },
            {
                $group: {
                    _id: {
                        date: {
                            $dateFromParts: {
                                year: { $year: "$date" },
                                month: { $month: "$date" },
                                day: { $dayOfMonth: "$date" },
                                hour: { $hour: "$date" }
                            }
                        },
                        apiNumber: "$apiNumber",
                        serverIdentifier: "$serverIdentifier",
                        accessMethod: "$accessMethod"
                    },
                    totalRequests: { $sum: 1 },
                    successCount: {
                        $sum: {
                            $cond: [
                                { $regexMatch: { input: "$status", regex: /^information$/i } },
                                1,
                                0
                            ]
                        }
                    },
                    errorCount: {
                        $sum: {
                            $cond: [
                                { $regexMatch: { input: "$status", regex: /^(error|critical|warning)$/i } },
                                1,
                                0
                            ]
                        }
                    },
                    totalResponseTime: { $sum: "$responseTime" },
                    minResponseTime: { $min: "$responseTime" },
                    maxResponseTime: { $max: "$responseTime" },
                    uniqueCustomers: { $addToSet: "$customerEmail" }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id.date",
                    apiNumber: "$_id.apiNumber",
                    serverIdentifier: "$_id.serverIdentifier",
                    accessMethod: "$_id.accessMethod",
                    totalRequests: 1,
                    successCount: 1,
                    errorCount: 1,
                    totalResponseTime: 1,
                    minResponseTime: 1,
                    maxResponseTime: 1,
                    uniqueCustomersCount: { $size: "$uniqueCustomers" }
                }
            }
        ]);

        if (stats.length === 0) {
            console.log('ℹ️ No logs found to aggregate in this range.');
            return;
        }

        // Merge into HourlyStats (Idempotent update using $set)
        const bulkOps = stats.map(stat => ({
            updateOne: {
                filter: {
                    date: stat.date,
                    apiNumber: stat.apiNumber,
                    serverIdentifier: stat.serverIdentifier,
                    accessMethod: stat.accessMethod
                },
                update: {
                    $set: {
                        totalRequests: stat.totalRequests,
                        successCount: stat.successCount,
                        errorCount: stat.errorCount,
                        totalResponseTime: stat.totalResponseTime,
                        uniqueCustomersCount: stat.uniqueCustomersCount,
                        minResponseTime: stat.minResponseTime,
                        maxResponseTime: stat.maxResponseTime
                    }
                },
                upsert: true
            }
        }));

        const result = await HourlyStats.bulkWrite(bulkOps);
        console.log(`✅ Aggregation complete. Matched: ${result.matchedCount}, Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);

    } catch (error) {
        console.error('❌ Error in aggregateLogsToStats:', error);
        throw error;
    }
};

/**
 * Runs a full aggregation for the last 24 hours to ensure consistency
 */
export const runDailyMaintenance = async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // We process in hourly chunks to avoid giant memory usage
    for (let i = 0; i < 24; i++) {
        const chunkStart = new Date(yesterday.getTime() + i * 60 * 60 * 1000);
        chunkStart.setUTCMinutes(0, 0, 0); // Align to UTC hour
        const chunkEnd = new Date(chunkStart.getTime() + 60 * 60 * 1000);
        await aggregateLogsToStats(chunkStart, chunkEnd);
    }
};

/**
 * Backfills statistics from the very first log in the database
 */
export const fullHistoryBackfill = async () => {
    try {
        const oldestLog = await ApiLog.findOne().sort({ date: 1 }).select('date').lean();
        if (!oldestLog) {
            console.log('ℹ️ No logs found to backfill.');
            return;
        }

        const start = new Date(oldestLog.date);
        start.setUTCMinutes(0, 0, 0); // Start at the beginning of the UTC hour

        const now = new Date();
        now.setUTCMinutes(0, 0, 0); // End at the current UTC hour (start of it)

        let current = start;
        console.log(`🚀 Starting full backfill from ${start.toISOString()} to ${now.toISOString()}...`);

        while (current < now) {
            const chunkEnd = new Date(current.getTime() + 60 * 60 * 1000);
            await aggregateLogsToStats(current, chunkEnd);
            current = chunkEnd;
        }

        console.log('✅ Full history backfill complete!');
    } catch (error) {
        console.error('❌ Error in fullHistoryBackfill:', error);
        throw error;
    }
};
