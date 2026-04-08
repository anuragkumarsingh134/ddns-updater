const express = require('express');
const fs = require('fs');
const { ENV_FILE, DOMAINS_FILE, LOG_FILE, logMessage } = require('./utils');
const { forceSyncDomain, getUpdaterStatus } = require('./updater');

const router = express.Router();

router.get('/config', (req, res) => {
    let domains = [];
    try {
        domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf8') || '[]');
    } catch (e) { }
    res.json({ token: process.env.CLOUDFLARE_API_TOKEN || '', domains });
});

router.post('/config/token', (req, res) => {
    const { token } = req.body;
    fs.writeFileSync(ENV_FILE, `CLOUDFLARE_API_TOKEN=${token}\n`);
    process.env.CLOUDFLARE_API_TOKEN = token;
    logMessage('INFO', 'API Token updated via UI.');
    res.json({ status: 'success' });
});

router.post('/domains', (req, res) => {
    const newDomain = req.body; 
    try {
        const domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf8') || '[]');
        domains.push(newDomain);
        fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
        logMessage('INFO', `Added domain to track: ${newDomain.DNS_RECORD_NAME}`);
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/domains/:index/toggle', (req, res) => {
    try {
        const domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf8') || '[]');
        const domain = domains[req.params.index];
        if (domain) {
            domain.PAUSED = !domain.PAUSED;
            fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
            logMessage('INFO', `${domain.PAUSED ? 'Paused' : 'Resumed'} tracking for ${domain.DNS_RECORD_NAME}`);
            res.json({ status: 'success', paused: domain.PAUSED });
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/domains/:index/sync', async (req, res) => {
    try {
        logMessage('INFO', `Manual Force Sync triggered for domain index ${req.params.index}`);
        const result = await forceSyncDomain(req.params.index);
        res.json({ status: 'success', ip: result.ip });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/domains/:index', (req, res) => {
    try {
        const domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf8') || '[]');
        domains.splice(req.params.index, 1);
        fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
        logMessage('INFO', `Removed domain from tracking.`);
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/status', (req, res) => {
    res.json(getUpdaterStatus());
});

// Cloudflare API Proxies
router.get('/cf/zones', async (req, res) => {
    try {
        const token = process.env.CLOUDFLARE_API_TOKEN;
        if (!token) return res.status(400).json({ error: 'No API token' });
        
        const response = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/cf/zones/:zone_id/dns_records', async (req, res) => {
    try {
        const token = process.env.CLOUDFLARE_API_TOKEN;
        if (!token) return res.status(400).json({ error: 'No API token' });
        
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${req.params.zone_id}/dns_records?type=A&per_page=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/logs', (req, res) => {
    try {
        if (!fs.existsSync(LOG_FILE)) return res.json({ logs: '' });
        const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(l => l);
        res.json({ logs: lines.slice(-200).join('\n') });
    } catch (e) {
        res.json({ logs: `Error reading logs: ${e}` });
    }
});

router.delete('/logs', (req, res) => {
    try {
        fs.writeFileSync(LOG_FILE, '');
        logMessage('INFO', 'Logs cleared by user.');
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/restart', (req, res) => {
    logMessage('INFO', 'Restart requested via API. Exiting. Docker will restart the container...');
    setTimeout(() => process.exit(1), 1000);
    res.json({ status: 'restarting' });
});

module.exports = router;
