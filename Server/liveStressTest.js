import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

const TARGET_HOST = 'localhost';
const TARGET_PORT = 5001;
const TARGET_PATH = '/api/logs/ingest/stream';
const BATCH_SIZE = 20; // 20 requests per batch
const INTERVAL_MS = 20; // Every 20ms = 1000 RPS
const TEST_DURATION_MS = 30000; // 30 seconds

const SERVERS = ['192.168.100.113', '192.168.100.114', '192.168.100.137'];
const APIS = ['A01', 'A02', 'A03', 'A04', 'A05'];
const METHODS = ['MOBILE', 'WEB', 'DESKTOP'];
const STATUSES = ['Information', 'Warning', 'Error', 'Critical'];
const EMAILS = ['live_user1@slt.lk', 'live_user2@slt.lk', 'live_user3@slt.lk'];

const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 2000,
    keepAliveMsecs: 10000
});

console.log(`🔥 Starting Live Stress Test: Target 1000 individual API requests/sec`);
console.log(`Target: http://${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}`);

let totalSent = 0;
let errors = 0;
const startTime = Date.now();

const generateSingleLog = () => {
    const now = Date.now();
    const responseTime = Math.floor(Math.random() * 500) + 50;
    return JSON.stringify([{
        startTimestamp: String(now),
        endTimestamp: String(now + responseTime),
        accessMethod: METHODS[Math.floor(Math.random() * METHODS.length)],
        customerEmail: EMAILS[Math.floor(Math.random() * EMAILS.length)],
        status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        apiNumber: APIS[Math.floor(Math.random() * APIS.length)],
        responseTime,
        serverIdentifier: SERVERS[Math.floor(Math.random() * SERVERS.length)],
        date: now / 1000 // Backend expects seconds for streams
    }]);
};

const sendRequest = () => {
    const data = generateSingleLog();
    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: TARGET_PATH,
        method: 'POST',
        agent: agent,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'x-server-id': 'LIVE_STRESS_BOT'
        }
    };

    const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
            totalSent++;
        } else {
            if (errors % 100 === 0) {
                console.error(`\n❌ API Error: ${res.statusCode} ${res.statusMessage}`);
            }
            errors++;
        }
        res.resume(); // consume response data to free up socket
    });

    req.on('error', (e) => {
        if (errors % 100 === 0) {
            console.error(`\n❌ Fetch Error: ${e.message}`);
        }
        errors++;
    });

    req.write(data);
    req.end();
};

// Fire BATCH_SIZE requests every INTERVAL_MS
const interval = setInterval(() => {
    for (let i = 0; i < BATCH_SIZE; i++) {
        sendRequest();
    }
}, INTERVAL_MS);

// Display stats every second
const statsInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const currentRps = Math.floor(totalSent / elapsed);
    console.log(`🚀 Total: ${totalSent.toLocaleString()} | RPS: ${currentRps.toLocaleString()} | Errors: ${errors.toLocaleString()}`);
}, 1000);

// Auto-stop after TEST_DURATION_MS
setTimeout(() => {
    clearInterval(interval);
    clearInterval(statsInterval);
    console.log(`\n\n✅ 30-second test completed. Total sent: ${totalSent.toLocaleString()}`);
    process.exit(0);
}, TEST_DURATION_MS);

// Handle exit
process.on('SIGINT', () => {
    console.log(`\n\n🛑 Stress test stopped. Total sent: ${totalSent.toLocaleString()}`);
    process.exit(0);
});
