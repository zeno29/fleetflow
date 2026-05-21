import { Vehicle, Alert } from './db.js';

const CITY_COORDINATES = {
  "Mumbai": [19.0760, 72.8777],
  "Pune": [18.5204, 73.8567],
  "Bangalore": [12.9716, 77.5946],
  "Chennai": [13.0827, 80.2707],
  "Delhi": [28.7041, 77.1025],
  "Hyderabad": [17.3850, 78.4867],
};

export const startSimulator = (io) => {
  console.log("Telemetry simulator started");

  setInterval(async () => {
    try {
      const activeVehicles = await Vehicle.find({ status: "Active" });

      for (let vehicle of activeVehicles) {
        let latChange = (Math.random() - 0.5) * 0.005;
        let lngChange = (Math.random() - 0.5) * 0.005;
        
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

        const speedDelta = (Math.random() - 0.5) * 5;
        let newSpeed = Math.max(50, Math.min(95, Math.round(vehicle.speed + speedDelta)));

        const tempDelta = (Math.random() - 0.5) * 0.2;
        let newTemp = parseFloat((vehicle.temperature + tempDelta).toFixed(2));

        const humidityDelta = Math.round((Math.random() - 0.5) * 2);
        let newHumidity = Math.max(25, Math.min(80, vehicle.humidity + humidityDelta));

        let newBattery = Math.max(5, vehicle.batteryLevel - (Math.random() > 0.8 ? 1 : 0));

        if (vehicle.alertCount === 0 && Math.random() < 0.05) {
          const isTempAnomaly = Math.random() > 0.5;
          let alertType = "";
          let alertMessage = "";
          let severity = "High";

          if (isTempAnomaly) {
            newTemp += 3.5;
            alertType = "Temperature Anomaly";
            alertMessage = `Cargo temperature exceeded critical threshold. Reading: ${newTemp}°C`;
            severity = "Critical";
          } else {
            newSpeed = 105;
            alertType = "Overspeeding Warning";
            alertMessage = `Vehicle traveling at dangerous speed: ${newSpeed} km/h (Limit: 80 km/h)`;
          }

          const newAlert = await Alert.create({
            vehicleId: vehicle.vehicleId,
            type: alertType,
            message: alertMessage,
            severity,
            status: "Active",
            timestamp: new Date().toISOString()
          });

          vehicle.alertCount = 1;
          io.emit('new_alert', newAlert);
          console.log(`Alert on ${vehicle.vehicleId}: ${alertMessage}`);
        }

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

        io.emit('telemetry_update', updatedVehicle);
      }
    } catch (err) {
      console.error("Simulator error:", err);
    }
  }, 3000);
};
