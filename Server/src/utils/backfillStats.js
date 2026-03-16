import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import { fullHistoryBackfill } from './aggregationJob.js';

// Load environment variables
dotenv.config();

const backfill = async () => {
    try {
        await connectDB();
        console.log('🚀 Starting full history backfill of HourlyStats...');

        await fullHistoryBackfill();

        console.log('✅ Backfill complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Backfill failed:', error);
        process.exit(1);
    }
};

backfill();
