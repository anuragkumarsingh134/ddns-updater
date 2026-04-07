# Cloudflare DDNS Updater (Node.js) ⚡

A robust, enterprise-grade Dynamic DNS (DDNS) updater for Cloudflare, built entirely in Node.js. It features an incredibly sleek **Web Dashboard** for managing domains, configuring per-domain polling intervals, proxy status overrides, and smart IP caching.

## Key Features 🚀
- **Smart IP Caching**: Prevents spamming the Cloudflare API. Only pushes updates when your physical router IP changes.
- **Microservices Architecture**: Modular codebase splitting the Express API, the background DDNS polling engine, and the visual dashboard.
- **Data Persistence**: Uses a unified `./data` filesystem structure, making it 100% Docker-safe to ensure you never lose your configuration keys or domain setups on container restarts.
- **Failover Logic**: Uses multiple IP resolvers (`ipify.org`, `api64.ipify.org`, `icanhazip.com`) so the engine never crashes if a provider goes down.
- **Force Sync**: Push an IP update manually directly from the UI.
- **Dark Mode**: Premium frontend dashboard supporting seamless dark mode.

---

## 💻 Standalone Installation (Without Docker)

You must have **Node.js 20+** installed.

1. Clone the repository:
   ```bash
   git clone https://github.com/anuragkumarsingh134/ddns-updater.git
   cd ddns-updater
   ```
2. Install NodeJS dependencies:
   ```bash
   npm install
   ```
3. Boot the DDNS Edge Server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to the dashboard at:
   👉 `http://localhost:5000`

---

## 🐳 Docker Install (Recommended: 24/7 Uptime)

Running this application via Docker guarantees that it runs infinitely in the background, surviving server reboots automatically.

1. Clone the repo and enter the directory.
2. Run Docker Compose in detached mode to build and start the image:
   ```bash
   docker compose up -d --build
   ```
   *Note: Because of the `restart: always` flag in `docker-compose.yml`, if Docker stops or your host machine restarts, this container will instantly reboot the DDNS service itself without manual intervention.*

3. **Where is my data?**
   All your configurations containing tokens and domains are safely isolated inside the `./data/` folder dynamically generated next to the `docker-compose.yml` file.

## Usage Guide
1. Launch the dashboard (`http://localhost:5000`).
2. Input your **Cloudflare API Token** (Ensure the token has `Zone.DNS` edit permissions).
3. Select your Cloudflare Domain/Zone from the dynamic dropdown.
4. Select the specific `A` record you want to physically track.
5. Define whether the IP should be permanently Proxied (Orange Cloud) and the exact polling interval.
6. Click **Start Tracking** and let the background Node.js engine handle the rest!
