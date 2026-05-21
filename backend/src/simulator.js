import { Vehicle, Alert } from './db.js';

// Coordinates dictionary for key Indian cities to guide paths
const CITY_COORDINATES = {
  "Mumbai": [19.0760, 72.8777],
  "Pune": [18.5204, 73.8567],
  "Bangalore": [12.9716, 77.5946],
  "Chennai": [13.0827, 80.2707],
  "Delhi": [28.7041, 77.1025],
  "Hyderabad": [17.3850, 78.4867],
};

export const startSimulator = (io) => {
  console.log("🚀 Telemetry IoT Simulator initialized...");

  setInterval(async () => {
    try {
      const activeVehicles = await Vehicle.find({ status: "Active" });

      for (let vehicle of activeVehicles) {
        // 1. GPS Position Simulation
        // Simulates movement by creeping coordinates toward a target or slightly walking them
        let latChange = (Math.random() - 0.5) * 0.005;
        let lngChange = (Math.random() - 0.5) * 0.005;
        
        // If route matches expected pattern, slowly creep towards destination
        const destination = vehicle.route ? vehicle.route.split(" to ")[1] : null;
        if (destination && CITY_COORDINATES[destination]) {
          const destCoords = CITY_COORDINATES[destination];
          latChange = (destCoords[0] - vehicle.coordinates[0]) * 0.01 + (Math.random() - 0.5) * 0.001;
          lngChange = (destCoords[1] - vehicle.coordinates[1]) * 0.01 + (Math.random() - 0.5) * 0.001;
        }

        const newCoordinates = [
          vehicle.coordinates[0] + latChange,
          vehicle.coordinates[1] + lngChange
        ];

        // 2. Sensor Value Fluctuation
        // Speed oscillates between 50 and 85 km/h
        const speedDelta = (Math.random() - 0.5) * 5;
        let newSpeed = Math.max(50, Math.min(95, Math.round(vehicle.speed + speedDelta)));

        // Temperature fluctuates slightly
        const tempDelta = (Math.random() - 0.5) * 0.2;
        let newTemp = parseFloat((vehicle.temperature + tempDelta).toFixed(2));

        // Humidity fluctuates slightly
        const humidityDelta = Math.round((Math.random() - 0.5) * 2);
        let newHumidity = Math.max(25, Math.min(80, vehicle.humidity + humidityDelta));

        // Battery drains slowly
        let newBattery = Math.max(5, vehicle.batteryLevel - (Math.random() > 0.8 ? 1 : 0));

        // 3. Dynamic Anomaly Trigger (5% chance if no active alerts already exist on this vehicle)
        let hasTriggeredAlert = false;
        if (vehicle.alertCount === 0 && Math.random() < 0.05) {
          const isTempAnomaly = Math.random() > 0.5;
          let alertType = "";
          let alertMessage = "";
          let severity = "High";

          if (isTempAnomaly) {
            newTemp += 3.5; // push temperature up out of limits
            alertType = "Temperature Anomaly";
            alertMessage = `Cargo temperature exceeded critical threshold. Reading: ${newTemp}°C`;
            severity = "Critical";
          } else {
            newSpeed = 105; // exceed safe speed
            alertType = "Overspeeding Warning";
            alertMessage = `Vehicle traveling at dangerous speed: ${newSpeed} km/h (Limit: 80 km/h)`;
          }

          // Create Alert entry
          const newAlert = await Alert.create({
            vehicleId: vehicle.vehicleId,
            type: alertType,
            message: alertMessage,
            severity: severity,
            status: "Active",
            timestamp: new Date().toISOString()
          });

          vehicle.alertCount = 1;
          hasTriggeredAlert = true;

          // Broadcast alert
          io.emit('new_alert', newAlert);
          console.log(`🚨 ALERT triggered on ${vehicle.vehicleId}: ${alertMessage}`);
        }

        // Update DB
        const updatedVehicle = await Vehicle.findByIdAndUpdate(
          vehicle._id,
          {
            coordinates: newCoordinates,
            speed: newSpeed,
            temperature: newTemp,
            humidity: newHumidity,
            batteryLevel: newBattery,
            alertCount: vehicle.alertCount
          },
          { new: true }
        );

        // Broadcast telemetry update
        io.emit('telemetry_update', updatedVehicle);
      }
    } catch (err) {
      console.error("Simulator error:", err);
    }
  }, 3000); // Trigger updates every 3 seconds
};
