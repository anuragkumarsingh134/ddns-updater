const fs = require('fs');
const { DOMAINS_FILE, logMessage } = require('./utils');

let cachedPublicIp = null;
const lastUpdatedMap = new Map();
const IP_PROVIDERS = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json'
];

async function getPublicIP() {
    for (const provider of IP_PROVIDERS) {
        try {
            const res = await fetch(provider, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                if (data.ip) return data.ip;
            }
        } catch (e) {}
    }
    try {
        const res = await fetch('https://icanhazip.com', { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const text = await res.text();
            return text.trim();
        }
    } catch (e) {}
    throw new Error('All IP providers failed.');
}

async function forceSyncDomain(domainIndex) {
    try {
        const token = process.env.CLOUDFLARE_API_TOKEN;
        if (!token) throw new Error("No API token");
        
        const domainsStr = fs.readFileSync(DOMAINS_FILE, 'utf8');
        let domains = JSON.parse(domainsStr);
        const domain = domains[domainIndex];
        
        if (!domain) throw new Error("Domain not found");

        const current_ip = await getPublicIP();
        const { ZONE_ID, DNS_RECORD_ID, DNS_RECORD_NAME, PROXIED } = domain;
        
        const url = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${DNS_RECORD_ID}`;
        const payload = { type: 'A', name: DNS_RECORD_NAME, content: current_ip, proxied: !!PROXIED };

        const cfRes = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (cfRes.ok) {
            logMessage('INFO', `Force Sync Success: Updated ${DNS_RECORD_NAME} to ${current_ip} (Proxied: ${!!PROXIED})`);
            lastUpdatedMap.set(DNS_RECORD_ID, Date.now()); // Reset timer
            // Update cache
            cachedPublicIp = current_ip;
            return { success: true, ip: current_ip };
        } else {
            const text = await cfRes.text();
            throw new Error(text);
        }
    } catch(e) {
        logMessage('ERROR', `Force Sync Failed: ${e.message}`);
        throw e;
    }
}

async function updateDDNS() {
    try {
        const token = process.env.CLOUDFLARE_API_TOKEN;
        if (!token) return;

        const domainsStr = fs.readFileSync(DOMAINS_FILE, 'utf8');
        let domains = [];
        try { domains = JSON.parse(domainsStr); } catch(e) {}

        const activeDomains = domains.filter(d => !d.PAUSED);
        if (activeDomains.length === 0) return;

        let needsUpdate = false;
        const now = Date.now();
        for (const domain of activeDomains) {
            const lastUpdated = lastUpdatedMap.get(domain.DNS_RECORD_ID) || 0;
            const intervalMs = (domain.UPDATE_INTERVAL || 1) * 60000;
            if (now - lastUpdated >= intervalMs - 5000) {
                needsUpdate = true;
                break;
            }
        }

        if (!needsUpdate) return;

        const current_ip = await getPublicIP();

        if (!current_ip) {
            logMessage('ERROR', 'Failed to resolve current public IP.');
            return;
        }

        let ipHasChanged = (cachedPublicIp !== current_ip);
        cachedPublicIp = current_ip;

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        for (const domain of activeDomains) {
            const { ZONE_ID, DNS_RECORD_ID, DNS_RECORD_NAME, PROXIED, UPDATE_INTERVAL = 1 } = domain;
            if (!ZONE_ID || !DNS_RECORD_ID || !DNS_RECORD_NAME) continue;

            const domainLastUpdated = lastUpdatedMap.get(DNS_RECORD_ID) || 0;
            const domainIntervalMs = UPDATE_INTERVAL * 60000;

            if (now - domainLastUpdated < domainIntervalMs - 5000) {
                continue;
            }

            if (!ipHasChanged && domainLastUpdated !== 0) {
                // Verify with Cloudflare to ensure manual remote changes are also corrected
                const getUrl = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${DNS_RECORD_ID}`;
                try {
                    const getRes = await fetch(getUrl, { headers, signal: AbortSignal.timeout(5000) });
                    if (getRes.ok) {
                        const data = await getRes.json();
                        if (data.result && data.result.content === current_ip && data.result.proxied === !!PROXIED) {
                            lastUpdatedMap.set(DNS_RECORD_ID, now);
                            continue; 
                        }
                    }
                } catch (e) {
                    // fallthrough to update if verification fails
                }
            }

            const url = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${DNS_RECORD_ID}`;
            const payload = { type: 'A', name: DNS_RECORD_NAME, content: current_ip, proxied: !!PROXIED };

            const cfRes = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(payload)
            });

            if (cfRes.ok) {
                logMessage('INFO', `Success: Updated ${DNS_RECORD_NAME} to ${current_ip} (Proxied: ${!!PROXIED})`);
                lastUpdatedMap.set(DNS_RECORD_ID, now);
            } else {
                const text = await cfRes.text();
                logMessage('ERROR', `Failed to update ${DNS_RECORD_NAME}: ${text}`);
            }
        }
    } catch (e) {
        logMessage('ERROR', `Unexpected error in background loop: ${e.message}`);
    }
}

function startDDNSUpdater() {
    logMessage('INFO', 'DDNS Updater Component Initialized.');
    setInterval(updateDDNS, 60000);
    // Run initial on startup if ready
    setTimeout(updateDDNS, 2000);
}

module.exports = { startDDNSUpdater, forceSyncDomain };
