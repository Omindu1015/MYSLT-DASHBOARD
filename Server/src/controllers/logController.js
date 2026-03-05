import ApiLog from '../models/ApiLog.js';

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
    startTimestamp,
    accessMethod,
    customerEmail,
    status,
    apiNumber,
    endTimestamp,
    responseTime: parseInt(responseTime) || 0,
    serverIdentifier: finalServerId,
    date: new Date(parseInt(startTimestamp))
  };
};

/**
 * Ingest logs from remote servers
 */
export const ingestLogs = async (req, res) => {
  try {
    const { serverIdentifier, logs } = req.body;
    console.log(`[INGEST] Request from ${serverIdentifier}, logs count: ${logs?.length}`);

    if (!logs || !Array.isArray(logs)) {
      console.warn(`[INGEST] Invalid logs format from ${serverIdentifier}`);
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

    const parsedLogs = logs
      .map(line => parseLogLine(line, serverIdentifier))
      .filter(log => log !== null);

    console.log(`[INGEST] Parsed ${parsedLogs.length} valid logs from ${serverIdentifier}`);

    if (parsedLogs.length === 0) {
      return res.json({
        success: true,
        message: 'No valid logs to process.',
        count: 0
      });
    }

    // High speed bulk insertion
    await ApiLog.insertMany(parsedLogs, { ordered: false });

    res.json({
      success: true,
      message: `Successfully ingested ${parsedLogs.length} log lines.`,
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
    console.log(`[STREAM] Request from ${serverIdentifier}. logs count: ${Array.isArray(req.body) ? req.body.length : (req.body.logs ? req.body.logs.length : 'N/A')}`);
    let count = 0;
    const logsToInsert = [];

    // Fluent Bit with Format json sends an array
    if (Array.isArray(req.body)) {
      count = req.body.length;
      const parsedLogs = req.body.map(log => {
        let timestamp = parseInt(log.startTimestamp);
        let date = isNaN(timestamp) ? new Date() : new Date(timestamp);

        // Fix: If date is in the far future (Year 3000+), subtract 1970 years
        // This handles cases where the timestamp includes 1970 years of "pre-epoch" time.
        if (date.getFullYear() > 3000) {
          date.setFullYear(date.getFullYear() - 1970);
        }

        return {
          ...log,
          responseTime: parseInt(log.responseTime) || 0,
          date: date,
          serverIdentifier: log.serverIdentifier || serverIdentifier
        };
      });
      if (parsedLogs.length > 0) {
        await ApiLog.insertMany(parsedLogs, { ordered: false });
      }
    } else if (req.body.logs && Array.isArray(req.body.logs)) {
      // Handle same format as ingestLogs but in this controller for consistency
      const parsedLogs = req.body.logs
        .map(line => parseLogLine(line, req.body.serverIdentifier))
        .filter(log => log !== null);
      count = parsedLogs.length;
      if (count > 0) {
        await ApiLog.insertMany(parsedLogs, { ordered: false });
      }
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
