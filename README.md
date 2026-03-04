## 🚀 Deployment & Setup

For a complete, end-to-end production deployment instructions (Dashboard hosting, SNMP Metrics, and Log Streaming), please follow the:

👉 **[ULTIMATE_DEPLOYMENT_GUIDE.md](file:///var/www/MYSLT-DASHBOARD/ULTIMATE_DEPLOYMENT_GUIDE.md)**

---

## Project layout

This repository now uses a mono-style layout: the frontend lives in the `client/` folder and the backend remains in `Server/`.

Files intentionally kept at the repository root: `package.json`, `README.md`, `.gitignore`.

## Running the frontend (developer)

From a PowerShell terminal (Windows):

```powershell
cd client
npm install
npm run dev
```

This starts the Vite dev server for the frontend.

## Build (production bundle)

```powershell
cd client
npm install
npx vite build
```

This produces the production assets in `client/dist`.
## Log Monitoring (Production)

This project uses **Fluent Bit** for production-grade log ingestion from remote Linux and Windows servers.

- **Backend Endpoint**: `http://[DASHBOARD_IP]:5001/api/logs/ingest/stream` (NDJSON)
- **Agent Configs**: Located in the [Scripts/](file:///var/www/MYSLT-DASHBOARD/Scripts/) folder.
- **Rollout Guide**: See [TRANSITION_GUIDE.md](file:///var/www/MYSLT-DASHBOARD/Scripts/TRANSITION_GUIDE.md) for step-by-step instructions.
