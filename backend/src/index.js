import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, Vehicle, Shipment, Alert, getDBMode } from './db.js';
import { startSimulator } from './simulator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*', // Dynamic access for local environment setup
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Main HTTP Server setup
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Seed DB & Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`📡 Socket connected: ${socket.id}`);
  socket.emit('connection_status', { connected: true, dbMode: getDBMode() });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: "Healthy",
    uptime: process.uptime(),
    dbMode: getDBMode(),
    timestamp: new Date()
  });
});

// Get all vehicles
app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({});
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all shipments
app.get('/api/shipments', async (req, res) => {
  try {
    const shipments = await Shipment.find({});
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find({ status: "Active" });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Dispatch a new Shipment & associate a dynamic vehicle
app.post('/api/shipments', async (req, res) => {
  const { origin, destination, cargoType, weight, priority } = req.body;

  if (!origin || !destination || !cargoType) {
    return res.status(400).json({ error: "Missing required shipment parameters." });
  }

  try {
    // Generate IDs
    const shipmentId = "SH-" + Math.floor(10000 + Math.random() * 90000);
    const vehicleId = "TRK-" + Math.floor(1000 + Math.random() * 9000);

    // City coordinates lookup for starting position
    const CITY_COORDINATES = {
      "Mumbai": [19.0760, 72.8777],
      "Pune": [18.5204, 73.8567],
      "Bangalore": [12.9716, 77.5946],
      "Chennai": [13.0827, 80.2707],
      "Delhi": [28.7041, 77.1025],
      "Hyderabad": [17.3850, 78.4867],
    };

    const startCoords = CITY_COORDINATES[origin] || [21.1458, 79.0882]; // default Nagpur center

    // Determine cargo safe temperature limits based on category
    let temperatureLimit = { min: 15, max: 25 }; // generic electronics/cargo
    if (cargoType.toLowerCase().includes("pharmaceutical") || cargoType.toLowerCase().includes("vaccine")) {
      temperatureLimit = { min: 2, max: 8 };
    } else if (cargoType.toLowerCase().includes("produce") || cargoType.toLowerCase().includes("fruit")) {
      temperatureLimit = { min: 0, max: 4 };
    } else if (cargoType.toLowerCase().includes("seafood") || cargoType.toLowerCase().includes("frozen")) {
      temperatureLimit = { min: -22, max: -15 };
    }

    // 1. Create matching active Vehicle
    const driverNames = ["Ramesh Kumar", "Vikram Rathore", "Gurpreet Singh", "Karan Johar", "Arjun Patel", "Vijay Mallya"];
    const randomDriver = driverNames[Math.floor(Math.random() * driverNames.length)];
    const randomPhone = "+91 9" + Math.floor(100000000 + Math.random() * 900000000);

    const newVehicle = await Vehicle.create({
      vehicleId,
      driverName: randomDriver,
      phone: randomPhone,
      status: "Active",
      batteryLevel: 100,
      speed: 65,
      temperature: (temperatureLimit.min + temperatureLimit.max) / 2, // start right in the target center
      humidity: 40,
      coordinates: startCoords,
      route: `${origin} to ${destination}`,
      alertCount: 0
    });

    // 2. Create Shipment
    const newShipment = await Shipment.create({
      shipmentId,
      vehicleId,
      cargoType,
      origin,
      destination,
      status: "In Transit",
      temperatureLimit,
      weight: weight || 500,
      priority: priority || "Medium"
    });

    // Broadcast new entries via Socket.io
    io.emit('new_shipment', newShipment);
    io.emit('new_vehicle', newVehicle);

    res.status(201).json({ shipment: newShipment, vehicle: newVehicle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve an Alert manually
app.post('/api/alerts/:id/resolve', async (req, res) => {
  const alertId = req.params.id;

  try {
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found." });
    }

    // Update alert status
    const updatedAlert = await Alert.findByIdAndUpdate(alertId, { status: "Resolved" }, { new: true });

    // Reset vehicle alert status
    const vehicle = await Vehicle.findOne({ vehicleId: alert.vehicleId });
    if (vehicle) {
      // Find default limits to reset temperature/speed to normal
      let resetTemp = 3.0; // safe default
      let resetSpeed = 65; // safe default

      await Vehicle.findByIdAndUpdate(vehicle._id, {
        alertCount: 0,
        temperature: resetTemp,
        speed: resetSpeed
      });
    }

    // Broadcast alert resolved event
    io.emit('alert_resolved', { alertId, vehicleId: alert.vehicleId });

    // Remove active alert from list by sending refreshed active state or direct notice
    res.json({ success: true, message: "Alert resolved successfully.", alert: updatedAlert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Boot process
const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, () => {
    console.log(`🛸 FleetFlow server running on port: ${PORT}`);
    // Start background IoT generator
    startSimulator(io);
  });
};

startServer();
