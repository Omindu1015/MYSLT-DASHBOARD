import snmp from 'net-snmp';

/**
 * SNMP OIDs for both Linux and Windows systems
 */
const OIDS = {
  // System Info (Standard MIB-2 - Works on both)
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysDescr: '1.3.6.1.2.1.1.1.0',

  // LINUX OIDS (UCD-SNMP-MIB)
  linux: {
    cpuIdle: '1.3.6.1.4.1.2021.11.11.0',
    cpuUser: '1.3.6.1.4.1.2021.11.9.0',
    cpuSystem: '1.3.6.1.4.1.2021.11.10.0',
    memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
    memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
    memBuffer: '1.3.6.1.4.1.2021.4.14.0',
    memCached: '1.3.6.1.4.1.2021.4.15.0',
    dskPercent: '1.3.6.1.4.1.2021.9.1.9.1',
    dskTotal: '1.3.6.1.4.1.2021.9.1.6.1',
    dskUsed: '1.3.6.1.4.1.2021.9.1.8.1',
  },

  // WINDOWS OIDS (HOST-RESOURCES-MIB)
  windows: {
    // CPU - hrProcessorLoad (average across all CPUs)
    cpuLoad: '1.3.6.1.2.1.25.3.3.1.2.1',

    // Memory - hrStorage
    memPhysicalRAM: '1.3.6.1.2.1.25.2.3.1.2.1',      // Physical Memory
    memTotalUnits: '1.3.6.1.2.1.25.2.3.1.5.1',       // Total units
    memUsedUnits: '1.3.6.1.2.1.25.2.3.1.6.1',        // Used units
    memUnitSize: '1.3.6.1.2.1.25.2.3.1.4.1',         // Unit size in bytes

    // Disk - hrStorageTable (Fixed Disk at index 4)
    diskDescr: '1.3.6.1.2.1.25.2.3.1.3.4',
    diskUnits: '1.3.6.1.2.1.25.2.3.1.4.4',
    diskSize: '1.3.6.1.2.1.25.2.3.1.5.4',
    diskUsed: '1.3.6.1.2.1.25.2.3.1.6.4',
  },

  // Network (IF-MIB - Standard, works on both) - Dynamic interface detection
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',      // Base OID, append interface index
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',     // Base OID, append interface index
  ifDescr: '1.3.6.1.2.1.2.2.1.2',          // Base OID, append interface index
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',     // Interface operational status
};

/**
 * Create SNMP session
 */
const createSession = (host, community = 'public') => {
  const options = {
    port: 161,
    retries: 1,
    timeout: 5000,
    transport: 'udp4',
    trapPort: 162,
    version: snmp.Version2c,
  };

  return snmp.createSession(host, community, options);
};

/**
 * Query single SNMP OID
 */
const getSingleOid = (session, oid) => {
  return new Promise((resolve, reject) => {
    session.get([oid], (error, varbinds) => {
      if (error) {
        reject(error);
      } else {
        if (snmp.isVarbindError(varbinds[0])) {
          reject(new Error(snmp.varbindError(varbinds[0])));
        } else {
          resolve(varbinds[0].value);
        }
      }
    });
  });
};

/**
 * Query multiple SNMP OIDs
 */
const getMultipleOids = (session, oids) => {
  return new Promise((resolve, reject) => {
    session.get(oids, (error, varbinds) => {
      if (error) {
        reject(error);
      } else {
        const results = {};
        varbinds.forEach((varbind, index) => {
          if (snmp.isVarbindError(varbind)) {
            results[oids[index]] = null;
          } else {
            results[oids[index]] = varbind.value;
          }
        });
        resolve(results);
      }
    });
  });
};

/**
 * Find the most active network interface
 */
const findActiveNetworkInterface = async (session) => {
  let bestInterface = 2; // Default fallback
  let maxTraffic = 0;

  try {
    // Check interfaces 1-20 to find the most active one
    for (let i = 1; i <= 20; i++) {
      try {
        const inOctets = await getSingleOid(session, `${OIDS.ifInOctets}.${i}`);
        const outOctets = await getSingleOid(session, `${OIDS.ifOutOctets}.${i}`);
        const operStatus = await getSingleOid(session, `${OIDS.ifOperStatus}.${i}`);

        // Only consider interfaces that are up (operStatus = 1)
        if (parseInt(operStatus) === 1) {
          const totalTraffic = parseInt(inOctets || 0) + parseInt(outOctets || 0);

          if (totalTraffic > maxTraffic) {
            maxTraffic = totalTraffic;
            bestInterface = i;

            // Get interface description for logging
            try {
              const ifDescr = await getSingleOid(session, `${OIDS.ifDescr}.${i}`);
              console.log(`🌐 Found active interface ${i}: ${ifDescr.toString()} (${(totalTraffic / (1024 * 1024)).toFixed(2)} MB)`);
            } catch (error) {
              console.log(`🌐 Found active interface ${i}: Unknown name (${(totalTraffic / (1024 * 1024)).toFixed(2)} MB)`);
            }
          }
        }
      } catch (error) {
        // Interface doesn't exist or error - continue
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error finding active network interface: ${error.message}`);
  }

  console.log(`🎯 Using network interface ${bestInterface} for monitoring`);
  return bestInterface;
};

/**
 * Get average CPU usage from multiple cores (Windows)
 */
const getWindowsCpuAverage = async (session) => {
  return new Promise((resolve) => {
    let totalCpu = 0;
    let cpuCount = 0;
    const cpuOidBase = '1.3.6.1.2.1.25.3.3.1.2';

    session.subtree(cpuOidBase, 20, (varbinds) => {
      for (let i = 0; i < varbinds.length; i++) {
        const oid = varbinds[i].oid;
        if (!snmp.isVarbindError(varbinds[i]) && oid.startsWith(cpuOidBase)) {
          const val = parseInt(varbinds[i].value || 0);
          console.log(`🖥️  Found CPU OID: ${oid} = ${val}%`);
          totalCpu += val;
          cpuCount++;
        }
      }
    }, (error) => {
      if (error) {
        console.warn(`⚠️ SNMP Subtree Error for Windows CPU: ${error.message}`);
      }

      if (cpuCount > 0) {
        const avg = Math.round(totalCpu / cpuCount);
        console.log(`🎯 Calculated Average CPU (${totalCpu}/${cpuCount}): ${avg}%`);
        resolve(avg);
      } else {
        resolve(0);
      }
    });
  });
};

/**
 * Format uptime from timeticks to readable string
 */
const formatUptime = (timeticks) => {
  const seconds = Math.floor(timeticks / 100);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
};

/**
 * Get server health metrics via SNMP (Auto-detects Windows/Linux)
 */
export const getServerMetrics = async (host, community = 'public', osType = null) => {
  let session;

  try {
    session = createSession(host, community);

    // Auto-detect OS if not specified
    if (!osType) {
      const sysDescr = await getSingleOid(session, OIDS.sysDescr);
      const sysDescrStr = sysDescr.toString().toLowerCase();
      osType = sysDescrStr.includes('windows') ? 'windows' : 'linux';
      console.log(`🔍 Auto-detected OS: ${osType} for ${host}`);
    }

    let cpuUtilization, ramUsage, diskSpace, networkTraffic, uptime, results;

    if (osType === 'windows') {
      // ===== WINDOWS METRICS =====
      console.log(`🪟 Getting Windows metrics for ${host}...`);

      // Get CPU average from multiple cores
      cpuUtilization = await getWindowsCpuAverage(session);

      // Find the most active network interface
      const activeInterface = await findActiveNetworkInterface(session);

      const oidList = [
        OIDS.sysUpTime,
        OIDS.windows.memUnitSize,
        OIDS.windows.memTotalUnits,
        OIDS.windows.memUsedUnits,
        OIDS.windows.diskUnits,
        OIDS.windows.diskSize,
        OIDS.windows.diskUsed,
        `${OIDS.ifInOctets}.${activeInterface}`,
        `${OIDS.ifOutOctets}.${activeInterface}`,
      ];

      results = await getMultipleOids(session, oidList);

      console.log(`📊 Windows SNMP data for ${host}:`, {
        cpuUtilization: cpuUtilization + '%',
        memUnitSize: results[OIDS.windows.memUnitSize],
        memTotal: results[OIDS.windows.memTotalUnits],
        memUsed: results[OIDS.windows.memUsedUnits],
        diskSize: results[OIDS.windows.diskSize],
        diskUsed: results[OIDS.windows.diskUsed],
        networkInterface: activeInterface,
      });

      // RAM calculation
      const memUnitSize = parseInt(results[OIDS.windows.memUnitSize]) || 1024;
      const memTotal = parseInt(results[OIDS.windows.memTotalUnits]) || 1;
      const memUsed = parseInt(results[OIDS.windows.memUsedUnits]) || 0;
      ramUsage = Math.max(0, Math.min(100, (memUsed / memTotal) * 100));

      // Disk calculation
      const diskUnits = parseInt(results[OIDS.windows.diskUnits]) || 1024;
      const diskTotal = parseInt(results[OIDS.windows.diskSize]) || 1;
      const diskUsed = parseInt(results[OIDS.windows.diskUsed]) || 0;
      diskSpace = Math.max(0, Math.min(100, (diskUsed / diskTotal) * 100));

      // Network traffic (use the active interface)
      const bytesIn = parseInt(results[`${OIDS.ifInOctets}.${activeInterface}`]) || 0;
      const bytesOut = parseInt(results[`${OIDS.ifOutOctets}.${activeInterface}`]) || 0;
      const totalBytes = bytesIn + bytesOut;
      networkTraffic = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));

    } else {
      // ===== LINUX METRICS =====
      console.log(`🐧 Getting Linux metrics for ${host}...`);

      // Find the most active network interface
      const activeInterface = await findActiveNetworkInterface(session);

      const oidList = [
        OIDS.sysUpTime,
        OIDS.linux.cpuIdle,
        OIDS.linux.cpuUser,
        OIDS.linux.cpuSystem,
        OIDS.linux.memTotalReal,
        OIDS.linux.memAvailReal,
        OIDS.linux.memBuffer,
        OIDS.linux.memCached,
        OIDS.linux.dskPercent,
        `${OIDS.ifInOctets}.${activeInterface}`,
        `${OIDS.ifOutOctets}.${activeInterface}`,
      ];

      results = await getMultipleOids(session, oidList);

      console.log(`📊 Linux SNMP data for ${host}:`, {
        cpuIdle: results[OIDS.linux.cpuIdle],
        memTotal: results[OIDS.linux.memTotalReal],
        memAvail: results[OIDS.linux.memAvailReal],
        diskPercent: results[OIDS.linux.dskPercent],
        networkInterface: activeInterface,
      });

      // CPU (100 - idle)
      const cpuIdle = parseInt(results[OIDS.linux.cpuIdle]) || 0;
      cpuUtilization = Math.max(0, Math.min(100, 100 - cpuIdle));

      // RAM calculation
      const memTotal = parseInt(results[OIDS.linux.memTotalReal]) || 1;
      const memAvail = parseInt(results[OIDS.linux.memAvailReal]) || 0;
      const memBuffer = parseInt(results[OIDS.linux.memBuffer]) || 0;
      const memCached = parseInt(results[OIDS.linux.memCached]) || 0;
      const memUsed = memTotal - memAvail - memBuffer - memCached;
      ramUsage = Math.max(0, Math.min(100, (memUsed / memTotal) * 100));

      // Disk percentage
      diskSpace = parseInt(results[OIDS.linux.dskPercent]) || 0;

      // Network traffic (use the active interface)
      const bytesIn = parseInt(results[`${OIDS.ifInOctets}.${activeInterface}`]) || 0;
      const bytesOut = parseInt(results[`${OIDS.ifOutOctets}.${activeInterface}`]) || 0;
      const totalBytes = bytesIn + bytesOut;
      networkTraffic = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    }

    // Uptime (common for both)
    uptime = formatUptime(parseInt(results[OIDS.sysUpTime]) || 0);

    console.log(`✅ Calculated metrics for ${host} (${osType}):`, {
      cpuUtilization: cpuUtilization + '%',
      ramUsage: ramUsage.toFixed(2) + '%',
      diskSpace: diskSpace + '%',
      networkTraffic: networkTraffic + ' MB',
      uptime
    });

    // Determine status
    let status = 'healthy';
    if (cpuUtilization > 80 || ramUsage > 80 || diskSpace > 80) {
      status = 'critical';
    } else if (cpuUtilization > 60 || ramUsage > 60 || diskSpace > 60) {
      status = 'warning';
    }

    session.close();

    return {
      success: true,
      osType,
      metrics: {
        cpuUtilization: parseFloat(cpuUtilization.toFixed(2)),
        ramUsage: parseFloat(ramUsage.toFixed(2)),
        diskSpace: parseFloat(diskSpace.toFixed(2)),
        networkTraffic,
        uptime,
        status,
        lastUpdated: new Date(),
      }
    };

  } catch (error) {
    if (session) {
      session.close();
    }

    console.error(`❌ SNMP Error for ${host}:`, error.message);

    return {
      success: false,
      error: error.message,
      message: 'Failed to retrieve SNMP metrics. Ensure SNMP is enabled on the server.'
    };
  }
};

/**
 * Test SNMP connection to a host
 */
export const testSNMPConnection = async (host, community = 'public') => {
  let session;

  try {
    session = createSession(host, community);

    // Try to get system description
    const sysDescr = await getSingleOid(session, OIDS.sysDescr);

    session.close();

    return {
      success: true,
      message: 'SNMP connection successful',
      systemDescription: sysDescr.toString()
    };

  } catch (error) {
    if (session) {
      session.close();
    }

    return {
      success: false,
      error: error.message,
      message: 'SNMP connection failed'
    };
  }
};

export default {
  getServerMetrics,
  testSNMPConnection,
};
