import ApiLog from '../models/ApiLog.js';
import hotStats from '../utils/hotStats.js';

// Configuration for Bulk Ingestion
const LOG_BUFFER = [];
const BUFFER_FLUSH_INTERVAL = 2000; // 2 seconds
const MAX_BUFFER_SIZE = 2000;

/**
 * Flush the log buffer to MongoDB
 */
const flushLogBuffer = async () => {
  if (LOG_BUFFER.length === 0) return;

  const logsToInsert = [...LOG_BUFFER];
  LOG_BUFFER.length = 0; // Clear buffer immediately to prevent duplicates

  try {
    const startTime = Date.now();
    await ApiLog.insertMany(logsToInsert, { ordered: false });
    const duration = Date.now() - startTime;
    console.log(`[BUFFER] Flushed ${logsToInsert.length} logs to DB in ${duration}ms`);
  } catch (error) {
    console.error('[BUFFER] Error flushing logs:', error.message);
    // If it's a partial failure, we don't retry for now to avoid complexity
  }
};

// Start the periodic flush
setInterval(flushLogBuffer, BUFFER_FLUSH_INTERVAL);

/**
 * Convert a timestamp string to milliseconds.
 * Handles:
 *   - nanoseconds  (19 digits, e.g. 1741150000000000000) → divide by 1,000,000
 *   - microseconds (16 digits, e.g. 1741150000000000)    → divide by 1,000
 *   - milliseconds (13 digits, e.g. 1741150000000)       → use as-is
 *   - seconds      (10 digits, e.g. 1741150000)          → multiply by 1,000
 */
const parseTimestampToMs = (raw) => {
  const str = String(raw).trim();
  const n = parseInt(str);
  if (isNaN(n)) return Date.now();

  const DOTNET_TO_UNIX_OFFSET_MS = 62135596800000;
  
  if (n > DOTNET_TO_UNIX_OFFSET_MS) {
    let correctedMs = n - DOTNET_TO_UNIX_OFFSET_MS;
    const IST_TO_UTC_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    correctedMs -= IST_TO_UTC_OFFSET_MS;
    return correctedMs;
  }

  const len = str.replace('-', '').length;
  if (len >= 18) return Math.floor(n / 1_000_000);
  if (len >= 15) return Math.floor(n / 1_000);
  if (len >= 12) return n;
  return n * 1_000;
};

/**
 * Parse a single log line (Copied from importLogs.js logic)
 * Format: startTimestamp,accessMethod,customerEmail,status,apiNumber,empty,endTimestamp,responseTime,serverIdentifier
 */
const parseLogLine = (line, remoteServerId) => {
  if (!line || !line.trim()) return null;

  const parts = line.split(',');
  if (parts.length < 8) return null;

  const [startTimestamp, accessMethod, customerEmail, status, apiNumber, , endTimestamp, responseTime, serverIdentifier] = parts;

  // Use the one from the log line if available, otherwise fallback to the one provided by the agent
  const finalServerId = serverIdentifier || remoteServerId;

  return {
    accessMethod,
    customerEmail,
    status,
    apiNumber,
    responseTime: parseInt(responseTime) || 0,
    serverIdentifier: finalServerId,
    date: new Date(parseTimestampToMs(startTimestamp))
  };
};

/**
 * Ingest logs from remote servers
 */
export const ingestLogs = async (req, res) => {
  try {
    const { serverIdentifier, logs } = req.body;
    // console.log(`[INGEST] Request from ${serverIdentifier}, logs count: ${logs?.length}`);

    if (!logs || !Array.isArray(logs)) {
      // console.warn(`[INGEST] Invalid logs format from ${serverIdentifier}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid logs format. Expected an array of log lines.'
      });
    }

    if (!serverIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'serverIdentifier is required.'
      });
    }

    /*
    if (logs.length > 0) {
      console.log(`[DEBUG] First log line from ${serverIdentifier}:`, logs[0]);
    }
    */

    const parsedLogs = logs
      .map(line => parseLogLine(line, serverIdentifier))
      .filter(log => log !== null);

    // console.log(`[INGEST] Parsed ${parsedLogs.length} valid logs from ${serverIdentifier}`);

    if (parsedLogs.length === 0) {
      return res.json({
        success: true,
        message: 'No valid logs to process.',
        count: 0
      });
    }

    // 1. Record stats in memory (Instant/Live)
    hotStats.recordLogs(parsedLogs);

    // 2. Add to Buffer for Bulk Insertion
    LOG_BUFFER.push(...parsedLogs);

    // 3. Immediate flush if buffer is too large
    if (LOG_BUFFER.length >= MAX_BUFFER_SIZE) {
      flushLogBuffer();
    }

    res.json({
      success: true,
      message: `Logs queued for ingestion (${parsedLogs.length} lines).`,
      count: parsedLogs.length
    });
  } catch (error) {
    console.error('Error in ingestLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Error ingesting logs',
      error: error.message
    });
  }
};
/**
 * Ingest logs as a stream (Optimized for Fluent Bit NDJSON)
 */
export const ingestLogStream = async (req, res) => {
  try {
    const serverIdentifier = req.headers['x-server-id'] || 'UNKNOWN_STREAM';
    // console.log(`[STREAM] Request from ${serverIdentifier}. logs count: ${Array.isArray(req.body) ? req.body.length : (req.body.logs ? req.body.logs.length : 'N/A')}`);
    let count = 0;
    const logsToInsert = [];

    // Fluent Bit with Format json sends an array
    if (Array.isArray(req.body)) {
      count = req.body.length;
      /*
      if (count > 0) {
        console.log(`[STREAM DEBUG] First item from ${serverIdentifier}:`, JSON.stringify(req.body[0], null, 2));
      }
      */
      const parsedLogs = req.body.map(log => {
        // Fluent Bit sends a correct Unix timestamp in 'log.date' which we should use!
        const date = log.date
          ? new Date(parseFloat(log.date) * 1000)
          : new Date(parseTimestampToMs(log.startTimestamp));

        const processedLog = {
          ...log,
          responseTime: parseInt(log.responseTime) || 0,
          date: date,
          serverIdentifier: log.serverIdentifier || serverIdentifier
        };
        
        // Remove raw timestamps to save DB space
        delete processedLog.startTimestamp;
        delete processedLog.endTimestamp;
        
        return processedLog;
      });

      if (parsedLogs.length > 0) {
        hotStats.recordLogs(parsedLogs);
        LOG_BUFFER.push(...parsedLogs);
      }
    } else if (req.body.logs && Array.isArray(req.body.logs)) {
      // Handle same format as ingestLogs but in this controller for consistency
      const parsedLogs = req.body.logs
        .map(line => parseLogLine(line, req.body.serverIdentifier))
        .filter(log => log !== null);
      count = parsedLogs.length;
      if (parsedLogs.length > 0) {
        hotStats.recordLogs(parsedLogs);
        LOG_BUFFER.push(...parsedLogs);
      }
    }

    // Immediate flush if buffer is too large
    if (LOG_BUFFER.length >= MAX_BUFFER_SIZE) {
      flushLogBuffer();
    }

    res.json({
      success: true,
      message: `Successfully ingested ${count} logs via stream.`,
      count
    });
  } catch (error) {
    console.error('Error in ingestLogStream:', error);
    res.status(500).json({
      success: false,
      message: 'Error ingesting stream logs',
      error: error.message
    });
  }
};
