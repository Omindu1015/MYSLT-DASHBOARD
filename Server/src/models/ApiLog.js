import mongoose from 'mongoose';

const apiLogSchema = new mongoose.Schema({
  accessMethod: {
    type: String,
    required: true,
    index: true
    // No enum - allows any access method value from logs
  },
  customerEmail: {
    type: String,
    required: true,
    index: true
    // Can be email address or phone number (username)
  },
  status: {
    type: String,
    required: true,
    index: true
  },
  apiNumber: {
    type: String,
    required: true,
    index: true
  },
  responseTime: {
    type: Number,
    required: true
  },
  serverIdentifier: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: false
});

// Indexes for efficient querying
apiLogSchema.index({ date: -1 });
apiLogSchema.index({ date: -1, customerEmail: 1 }); // Optimized for Unique Customer counts by date
apiLogSchema.index({ date: -1, apiNumber: 1 });    // Optimized for API filtering by date
apiLogSchema.index({ date: -1, serverIdentifier: 1 }); // Optimized for Server filtering by date
apiLogSchema.index({ apiNumber: 1, date: -1 });
apiLogSchema.index({ serverIdentifier: 1, date: -1 });
apiLogSchema.index({ customerEmail: 1, date: -1 });

const ApiLog = mongoose.model('ApiLog', apiLogSchema);

export default ApiLog;
