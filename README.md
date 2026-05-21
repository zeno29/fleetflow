# FleetFlow 🛸 // Smart Logistics & IoT Telemetry Command Center

[![Live Dashboard Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://fleetflow-1zpy0p78c-zeno29s-projects.vercel.app/)
[![Backend API Status](https://img.shields.io/badge/API%20Status-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://fleetflow-bi6n.onrender.com/api/status)

FleetFlow is a state-of-the-art **Smart Logistics & IoT Telemetry Command Center** built using the MERN stack. Designed for high-stress operations environments, it features real-time WebSocket telemetry tracking, interactive geospatial mapping, dynamic incident alarm logging, and historical sensor analytics.

---

## 🎨 Oceanic Dark Operations Theme

FleetFlow implements a custom, sleek **Oceanic Dark Operations** layout tailored for modern control rooms:
*   **Aesthetics:** Frosted glass panels, subtle border glows, and crisp high-contrast sans-serif typography.
*   **Operations Colorway:** Deep midnight backgrounds (`#07090E`), slate panels (`#0E131F`), vibrant tracking cyan (`#0EA5E9`), and rapid alert rose (`#F43F5E`).
*   **Night Mapping:** Interactive OpenStreetMap layers with customized Leaflet night filters to match high-tech overlays.

---

## 🚀 Key Features

*   🛰️ **Real-Time GPS Tracking:** Live vehicle coordinates creep automatically along actual transit routes in India.
*   📊 **Sensory Telemetry Analytics:** Dynamic Recharts line graphs showing real-time sliding logs of cargo temperature and fleet speeds.
*   🚨 **Incident & Alarm Command:** Automatically monitors and fires alarms for sensor breaches (e.g., vaccine cargo temperature exceeding safe thresholds or speed limit violations). Overriding resolves alerts instantly via Socket messages.
*   ⚓ **Virtual Database Engine:** Built with a hybrid Mongo database layer—if MongoDB is not running locally, it seamlessly falls back to an in-memory virtual database engine for full out-of-the-box plug-and-play capability!
*   🚚 **Interactive Fleet Dispatch:** Create and dispatch new vehicle orders on-the-fly via interactive multi-step control forms.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend:** React (Vite), React-Leaflet (Maps), Recharts (Sensor Graphs), Lucide Icons, CSS Variables (Custom Design System).
*   **Backend:** Node.js, Express, Socket.io (WebSocket Streaming).
*   **Database:** MongoDB, Mongoose (with elegant Virtual Fallback layer).

---

## 💻 Local Setup & Development

### 1. Pre-requisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### 2. Install Dependencies
Run the unified setup command in the project root directory:
```bash
npm run setup
```

### 3. Run the Servers
You will spin up both the background simulator server and the Vite development client:

```bash
# Terminal 1: Boot backend server & telemetry generator
npm run server

# Terminal 2: Boot React Vite dashboard
npm run client
```

Open your browser to `http://localhost:5173` to explore the telemetry center.
