/**
 * HotStats provides in-memory counters for real-time dashboard data.
 * This avoids expensive MongoDB aggregations for 'Live' traffic.
 */
class HotStats {
    constructor() {
        this.reset();
    }

    reset() {
        this.data = {
            totalRequests: 0,
            successCount: 0,
            errorCount: 0,
            warningCount: 0,
            totalResponseTime: 0,
            uniqueCustomers: new Set(),
            serverStats: {}, // { serverId: count }
            apiStats: {},    // { apiNumber: count }
            methodStats: {}, // { method: count }
            statusStats: {}, // { status: count }
            successByApi: {}, // { apiNumber: { total: n, success: m } }
            lastUpdated: new Date()
        };
    }

    /**
     * Record a batch of logs in memory
     */
    recordLogs(logs) {
        if (!Array.isArray(logs)) return;

        logs.forEach(log => {
            this.data.totalRequests++;
            this.data.totalResponseTime += (log.responseTime || 0);

            if (log.customerEmail) {
                this.data.uniqueCustomers.add(log.customerEmail);
            }

            // Server stats
            const sId = log.serverIdentifier || 'unknown';
            this.data.serverStats[sId] = (this.data.serverStats[sId] || 0) + 1;

            // API stats
            const api = log.apiNumber || 'unknown';
            this.data.apiStats[api] = (this.data.apiStats[api] || 0) + 1;

            // Method stats
            const method = log.accessMethod || 'unknown';
            this.data.methodStats[method] = (this.data.methodStats[method] || 0) + 1;

            // Status stats
            const status = log.status || 'Information';
            this.data.statusStats[status] = (this.data.statusStats[status] || 0) + 1;

            if (status === 'Information' || status === 'Success') {
                this.data.successCount++;
            } else if (status === 'Error' || status === 'Critical') {
                this.data.errorCount++;
            } else if (status === 'Warning') {
                this.data.warningCount++;
            }

            // Success by API calculation helper
            if (!this.data.successByApi[api]) {
                this.data.successByApi[api] = { total: 0, success: 0 };
            }
            this.data.successByApi[api].total++;
            if (status === 'Information' || status === 'Success') {
                this.data.successByApi[api].success++;
            }
        });

        this.data.lastUpdated = new Date();
    }

    /**
     * Get summarized stats for the dashboard
     */
    getSummary() {
        return {
            ...this.data,
            uniqueCustomersCount: this.data.uniqueCustomers.size,
            avgResponseTime: this.data.totalRequests > 0
                ? Math.round(this.data.totalResponseTime / this.data.totalRequests)
                : 0,
            statusDistribution: Object.entries(this.data.statusStats).map(([status, count]) => ({
                _id: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
                count
            }))
        };
    }
}

// Singleton instance
const hotStats = new HotStats();

/**
 * Automatically reset stats every hour at the top of the hour.
 * This ensures 'HotStats' perfectly represents the "Current Hour"
 * so the Dashboard can use it for the "Live" portion of hybrid queries.
 */
const scheduleReset = () => {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    setTimeout(() => {
        console.log(`[HotStats] Hourly reset triggered at ${new Date().toISOString()}`);
        hotStats.reset();
        scheduleReset(); // Schedule next
    }, msUntilNextHour);
};

scheduleReset();

export default hotStats;
