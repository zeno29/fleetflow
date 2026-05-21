import mongoose from 'mongoose';

const seedVehicles = [
  { _id: "v_1", vehicleId: "TRK-8821", driverName: "Rajesh Kumar", phone: "+91 98765 43210", status: "Active", batteryLevel: 98, speed: 65, temperature: 3.2, humidity: 42, coordinates: [19.0760, 72.8777], route: "Mumbai to Pune", alertCount: 0 },
  { _id: "v_2", vehicleId: "TRK-4409", driverName: "Amit Singh", phone: "+91 98123 45678", status: "Active", batteryLevel: 85, speed: 82, temperature: 4.8, humidity: 48, coordinates: [12.9716, 77.5946], route: "Bangalore to Chennai", alertCount: 1 },
  { _id: "v_3", vehicleId: "TRK-1092", driverName: "Vikram Rathore", phone: "+91 99887 76655", status: "Idle", batteryLevel: 100, speed: 0, temperature: 2.1, humidity: 39, coordinates: [28.7041, 77.1025], route: "Delhi Depot", alertCount: 0 },
  { _id: "v_4", vehicleId: "TRK-5572", driverName: "Sanjay Dutt", phone: "+91 97766 55443", status: "Active", batteryLevel: 72, speed: 70, temperature: 1.5, humidity: 35, coordinates: [17.3850, 78.4867], route: "Hyderabad to Bangalore", alertCount: 0 }
];

const seedShipments = [
  { _id: "s_1", shipmentId: "SH-90021", vehicleId: "TRK-8821", cargoType: "Pharmaceuticals (Vaccines)", origin: "Mumbai", destination: "Pune", status: "In Transit", temperatureLimit: { min: 2, max: 8 }, weight: 450, priority: "Critical" },
  { _id: "s_2", shipmentId: "SH-44102", vehicleId: "TRK-4409", cargoType: "Fresh Produce (Organic Berries)", origin: "Bangalore", destination: "Chennai", status: "In Transit", temperatureLimit: { min: 0, max: 4 }, weight: 1200, priority: "High" },
  { _id: "s_3", shipmentId: "SH-10119", vehicleId: "TRK-1092", cargoType: "Electronics (Microchips)", origin: "Delhi", destination: "Delhi Depot", status: "Delivered", temperatureLimit: { min: 15, max: 25 }, weight: 200, priority: "Medium" },
  { _id: "s_4", shipmentId: "SH-55110", vehicleId: "TRK-5572", cargoType: "Frozen Seafood", origin: "Hyderabad", destination: "Bangalore", status: "In Transit", temperatureLimit: { min: -18, max: -12 }, weight: 3200, priority: "High" }
];

const seedAlerts = [
  { _id: "a_1", vehicleId: "TRK-4409", type: "Temperature Anomaly", message: "Cargo temperature reached 4.8°C (Max limit: 4°C)", severity: "Critical", status: "Active", timestamp: new Date().toISOString() }
];

class MockModel {
  constructor(name, initialData) {
    this.name = name;
    this.data = JSON.parse(JSON.stringify(initialData));
  }

  async find(query = {}) {
    return this.data.filter(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
  }

  async findOne(query = {}) {
    const list = await this.find(query);
    return list.length ? list[0] : null;
  }

  async findById(id) {
    return this.data.find(item => item._id === id);
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const index = this.data.findIndex(item => item._id === id);
    if (index === -1) return null;
    
    let parsedUpdate = { ...update };
    if (update.$set) parsedUpdate = { ...parsedUpdate, ...update.$set };

    const updatedItem = { ...this.data[index], ...parsedUpdate, updatedAt: new Date().toISOString() };
    this.data[index] = updatedItem;
    return options.new !== false ? updatedItem : this.data[index];
  }

  async create(doc) {
    const newDoc = {
      _id: this.name.toLowerCase().substring(0,1) + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...doc
    };
    this.data.push(newDoc);
    return newDoc;
  }

  async deleteOne(query = {}) {
    const index = this.data.findIndex(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    if (index !== -1) {
      this.data.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
}

let isMockMode = false;

const MockVehicle = new MockModel("Vehicle", seedVehicles);
const MockShipment = new MockModel("Shipment", seedShipments);
const MockAlert = new MockModel("Alert", seedAlerts);

export const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/fleetflow";
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log("Connected to MongoDB successfully");
    isMockMode = false;
  } catch (error) {
    console.warn("MongoDB connection failed, falling back to in-memory store:", error.message);
    isMockMode = true;
  }
};

const vehicleSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true, unique: true },
  driverName: String,
  phone: String,
  status: { type: String, default: "Idle" },
  batteryLevel: { type: Number, default: 100 },
  speed: { type: Number, default: 0 },
  temperature: { type: Number, default: 2.0 },
  humidity: { type: Number, default: 40 },
  coordinates: { type: [Number], default: [0, 0] },
  route: String,
  alertCount: { type: Number, default: 0 }
}, { timestamps: true });

const shipmentSchema = new mongoose.Schema({
  shipmentId: { type: String, required: true, unique: true },
  vehicleId: String,
  cargoType: String,
  origin: String,
  destination: String,
  status: { type: String, default: "Pending" },
  temperatureLimit: {
    min: Number,
    max: Number
  },
  weight: Number,
  priority: String
}, { timestamps: true });

const alertSchema = new mongoose.Schema({
  vehicleId: String,
  type: String,
  message: String,
  severity: String,
  status: { type: String, default: "Active" },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const MongoVehicle = mongoose.model('Vehicle', vehicleSchema);
const MongoShipment = mongoose.model('Shipment', shipmentSchema);
const MongoAlert = mongoose.model('Alert', alertSchema);

export const Vehicle = new Proxy({}, {
  get(target, prop) {
    return isMockMode ? MockVehicle[prop] : MongoVehicle[prop];
  }
});

export const Shipment = new Proxy({}, {
  get(target, prop) {
    return isMockMode ? MockShipment[prop] : MongoShipment[prop];
  }
});

export const Alert = new Proxy({}, {
  get(target, prop) {
    return isMockMode ? MockAlert[prop] : MongoAlert[prop];
  }
});

export const getDBMode = () => isMockMode ? "In-Memory" : "MongoDB";
