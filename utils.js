const fs = require('fs');
const path = require('path');

const APP_DIR = __dirname;
const DATA_DIR = path.join(APP_DIR, 'data');
const ENV_FILE = path.join(DATA_DIR, '.env');
const DOMAINS_FILE = path.join(DATA_DIR, 'domains.json');
const LOG_FILE = path.join(DATA_DIR, 'ddns.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

function ensureFiles() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');
    if (!fs.existsSync(ENV_FILE)) fs.writeFileSync(ENV_FILE, '');
    if (!fs.existsSync(DOMAINS_FILE)) fs.writeFileSync(DOMAINS_FILE, '[]');
}

function logMessage(level, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `${timestamp} - ${level} - ${message}\n`;
    console.log(logLine.trim());
    try {
        fs.appendFileSync(LOG_FILE, logLine);
        const stats = fs.statSync(LOG_FILE);
        if (stats.size > MAX_LOG_SIZE) {
            const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
            const newLines = lines.slice(-500); 
            fs.writeFileSync(LOG_FILE, newLines.join('\n'));
            fs.appendFileSync(LOG_FILE, `${timestamp} - INFO - Log file rotated due to size limit.\n`);
        }
    } catch(e) {}
}

module.exports = {
    ENV_FILE, DOMAINS_FILE, LOG_FILE,
    ensureFiles, logMessage
};
