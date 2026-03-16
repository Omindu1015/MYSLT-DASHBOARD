import mongoose from 'mongoose';

const dailyStatsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    apiNumber: {
        type: String,
        required: true,
        index: true
    },
    serverIdentifier: {
        type: String,
        required: true,
        index: true
    },
    accessMethod: {
        type: String,
        required: true,
        index: true
    },
    totalRequests: {
        type: Number,
        default: 0
    },
    successCount: {
        type: Number,
        default: 0
    },
    errorCount: {
        type: Number,
        default: 0
    },
    totalResponseTime: {
        type: Number,
        default: 0
    },
    minResponseTime: {
        type: Number,
        default: null
    },
    maxResponseTime: {
        type: Number,
        default: 0
    },
    uniqueCustomersCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for the hybrid query engine
dailyStatsSchema.index({ date: 1, apiNumber: 1, serverIdentifier: 1 });
dailyStatsSchema.index({ date: 1, serverIdentifier: 1 });

const HourlyStats = mongoose.model('HourlyStats', dailyStatsSchema);

export default HourlyStats;
