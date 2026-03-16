import { aggregateLogsToStats } from './aggregationJob.js';

let statsInterval = null;
const AGGREGATION_INTERVAL = 60 * 60 * 1000; // Run every hour

/**
 * Start the background statistics aggregation job
 */
export const startStatsScheduler = () => {
    if (statsInterval) {
        console.log('⚠️  Stats scheduler already running');
        return;
    }

    console.log('🚀 Starting Statistics Aggregation Scheduler...');

    // Initial run to finalize the previous hour
    runAggregationCycle();

    // Set up recurring job
    statsInterval = setInterval(runAggregationCycle, AGGREGATION_INTERVAL);

    console.log(`✅ Stats scheduler started (Interval: ${AGGREGATION_INTERVAL / (60 * 60 * 1000)} hour)`);
};

/**
 * Run a single aggregation cycle for the previous hour
 */
const runAggregationCycle = async () => {
    try {
        const now = new Date();
        // We finalize the hour that just finished
        // E.g. if it's 14:05, we aggregate from 13:00 to 14:00
        const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const startTime = new Date(endTime.getTime() - AGGREGATION_INTERVAL);

        console.log(`[Scheduler] Triggering aggregation for period: ${startTime.toISOString()} to ${endTime.toISOString()}`);
        await aggregateLogsToStats(startTime, endTime);
    } catch (error) {
        console.error('[Scheduler] Error in aggregation cycle:', error);
    }
};

/**
 * Stop the scheduler
 */
export const stopStatsScheduler = () => {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
        console.log('🛑 Stats scheduler stopped');
    }
};
