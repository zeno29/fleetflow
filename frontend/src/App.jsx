import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Truck, AlertTriangle, ShieldAlert, CheckCircle, Navigation, 
  Thermometer, Droplets, Battery, Activity, Send, Phone, User
} from 'lucide-react';

const SOCKET_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api';

// Center coordinates for Indian cities used for route lines
const CITY_COORDINATES = {
  "Mumbai": [19.0760, 72.8777],
  "Pune": [18.5204, 73.8567],
  "Bangalore": [12.9716, 77.5946],
  "Chennai": [13.0827, 80.2707],
  "Delhi": [28.7041, 77.1025],
  "Hyderabad": [17.3850, 78.4867],
};

// Map Recenter Helper Component
function MapRecenter({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates) {
      map.setView(coordinates, map.getZoom(), { animate: true });
    }
  }, [coordinates]);
  return null;
}

export default function App() {
  // State variables
  const [vehicles, setVehicles] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [dbMode, setDbMode] = useState("Connecting...");
  const [socketConnected, setSocketConnected] = useState(false);
  const [telemetryHistory, setTelemetryHistory] = useState({});

  // Dispatch Form State
  const [origin, setOrigin] = useState('Mumbai');
  const [destination, setDestination] = useState('Pune');
  const [cargoType, setCargoType] = useState('Pharmaceuticals (Vaccines)');
  const [weight, setWeight] = useState(500);
  const [priority, setPriority] = useState('High');

  const socketRef = useRef(null);

  // 1. Initial Load APIs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vehiclesRes, shipmentsRes, alertsRes] = await Promise.all([
          fetch(`${API_URL}/vehicles`).then(r => r.json()),
          fetch(`${API_URL}/shipments`).then(r => r.json()),
          fetch(`${API_URL}/alerts`).then(r => r.json())
        ]);
        setVehicles(vehiclesRes);
        setShipments(shipmentsRes);
        setAlerts(alertsRes);

        // Pre-seed some historical telemetry logs for seed data
        const initialHistory = {};
        vehiclesRes.forEach(v => {
          initialHistory[v.vehicleId] = [
            { time: '14:00', temp: v.temperature - 0.2, speed: v.speed - 5, humidity: v.humidity },
            { time: '14:01', temp: v.temperature - 0.1, speed: v.speed - 2, humidity: v.humidity },
            { time: '14:02', temp: v.temperature, speed: v.speed, humidity: v.humidity }
          ];
        });
        setTelemetryHistory(initialHistory);

        // Auto select first vehicle
        if (vehiclesRes.length > 0) {
          setSelectedVehicleId(vehiclesRes[0].vehicleId);
        }
      } catch (err) {
        console.error("API fetching error:", err);
      }
    };

    fetchData();

    // 2. Initialize Real-Time WebSockets
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect_status', (status) => {
      setSocketConnected(true);
      setDbMode(status.dbMode);
    });

    socketRef.current.on('connect', () => {
      setSocketConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Real-Time Telemetry Updates
    socketRef.current.on('telemetry_update', (updatedVehicle) => {
      setVehicles(prev => prev.map(v => 
        v.vehicleId === updatedVehicle.vehicleId ? updatedVehicle : v
      ));

      // Append coordinates history for graph drawing
      setTelemetryHistory(prev => {
        const history = prev[updatedVehicle.vehicleId] || [];
        const newHistory = [...history, {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temp: updatedVehicle.temperature,
          speed: updatedVehicle.speed,
          humidity: updatedVehicle.humidity
        }].slice(-10); // cap history at 10 items for sliding window
        return { ...prev, [updatedVehicle.vehicleId]: newHistory };
      });
    });

    // New Alerts Trigger
    socketRef.current.on('new_alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
    });

    // Resolved Alerts Listener
    socketRef.current.on('alert_resolved', ({ alertId, vehicleId }) => {
      setAlerts(prev => prev.filter(a => a._id !== alertId));
      setVehicles(prev => prev.map(v => 
        v.vehicleId === vehicleId ? { ...v, alertCount: 0 } : v
      ));
    });

    // New Shipment Dispatched
    socketRef.current.on('new_shipment', (newShipment) => {
      setShipments(prev => [newShipment, ...prev]);
    });

    socketRef.current.on('new_vehicle', (newVehicle) => {
      setVehicles(prev => [newVehicle, ...prev]);
      setSelectedVehicleId(newVehicle.vehicleId);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Form Submit Handler
  const handleDispatch = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, cargoType, weight, priority })
      });
      if (response.ok) {
        // Form reset / visual cue
        console.log("Shipment dispatched successfully!");
      }
    } catch (err) {
      console.error("Failed to dispatch shipment:", err);
    }
  };

  // Alert Resolve Handler
  const handleResolveAlert = async (id) => {
    try {
      await fetch(`${API_URL}/alerts/${id}/resolve`, { method: 'POST' });
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    }
  };

  // State computations
  const activeVehicle = vehicles.find(v => v.vehicleId === selectedVehicleId) || vehicles[0];
  const activeShipment = shipments.find(s => s.vehicleId === selectedVehicleId);
  const activeHistory = activeVehicle ? (telemetryHistory[activeVehicle.vehicleId] || []) : [];

  // Helper to draw custom markers with SVG glows
  const createVehicleMarker = (vehicle) => {
    const isAlert = vehicle.alertCount > 0;
    return L.divIcon({
      html: `<div class="marker-pin ${isAlert ? 'alert-pin' : ''}"></div>`,
      className: 'custom-div-icon',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  };

  // Compute route overlay coordinates if a vehicle is selected
  const getRouteCoordinates = () => {
    if (!activeVehicle || !activeShipment) return null;
    const originCoords = CITY_COORDINATES[activeShipment.origin];
    const destCoords = CITY_COORDINATES[activeShipment.destination];
    if (originCoords && destCoords) {
      return [originCoords, destCoords];
    }
    return null;
  };

  const routePolyline = getRouteCoordinates();

  return (
    <div className="app-container">
      {/* 1. Header Control Panel */}
      <header className="header-panel">
        <div className="header-title-container">
          <div className="header-logo">🛸</div>
          <div className="header-title">
            <h1>FLEETFLOW</h1>
            <span>Smart Logistics & Telemetry Command</span>
          </div>
        </div>

        <div className="stats-bar">
          <div className="stat-item">
            <span className={`stat-value ${socketConnected ? 'glow-cyan' : 'glow-red'}`} style={{ color: socketConnected ? '#0EA5E9' : '#F43F5E' }}>
              ● {socketConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
            <span className="stat-label">Network Sync</span>
          </div>

          <div className="stat-item">
            <span className="stat-value" style={{ color: '#6366F1' }}>{dbMode}</span>
            <span className="stat-label">Database</span>
          </div>

          <div className="stat-item">
            <span className="stat-value">{vehicles.length}</span>
            <span className="stat-label">Active Fleets</span>
          </div>

          <div className="stat-item">
            <span className="stat-value" style={{ color: alerts.length > 0 ? '#F43F5E' : '#10B981' }}>
              {alerts.length}
            </span>
            <span className="stat-label">Active Alerts</span>
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Workspace Grid */}
      <main className="dashboard-grid">
        
        {/* Left Pane: Fleet List */}
        <section className="dashboard-panel" style={{ gridRow: "1" }}>
          <div className="panel-header">
            <h2><Truck size={16} /> Fleet Directory</h2>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{vehicles.length} Units</span>
          </div>
          <div className="panel-content">
            <div className="vehicles-list">
              {vehicles.map((vehicle) => (
                <div 
                  key={vehicle._id} 
                  className={`vehicle-card ${selectedVehicleId === vehicle.vehicleId ? 'selected' : ''}`}
                  onClick={() => setSelectedVehicleId(vehicle.vehicleId)}
                >
                  <div className="vehicle-card-header">
                    <span className="vehicle-id">{vehicle.vehicleId}</span>
                    <span className={`status-badge ${vehicle.status.toLowerCase()}`}>
                      {vehicle.status}
                    </span>
                  </div>
                  <div className="vehicle-details">
                    <div><strong>Driver:</strong> {vehicle.driverName}</div>
                    <div><strong>Route:</strong> {vehicle.route || 'Stationary Depot'}</div>
                  </div>
                  <div className="vehicle-telemetry-micro">
                    <div className="micro-item">
                      <Activity size={12} /> {vehicle.speed} km/h
                    </div>
                    <div className="micro-item">
                      <Thermometer size={12} /> {vehicle.temperature}°C
                    </div>
                    <div className={`micro-item ${vehicle.alertCount > 0 ? 'alert-active' : ''}`}>
                      <AlertTriangle size={12} /> {vehicle.alertCount} Alerts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Left Bottom Pane: Dispatch Portal */}
        <section className="dashboard-panel dispatch-panel">
          <div className="panel-header">
            <h2><Send size={16} /> Order & Dispatch</h2>
          </div>
          <div className="panel-content">
            <form onSubmit={handleDispatch} className="dispatch-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div className="form-group">
                  <label>Origin</label>
                  <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="form-select">
                    <option>Mumbai</option>
                    <option>Bangalore</option>
                    <option>Delhi</option>
                    <option>Hyderabad</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Destination</label>
                  <select value={destination} onChange={(e) => setDestination(e.target.value)} className="form-select">
                    <option>Pune</option>
                    <option>Chennai</option>
                    <option>Bangalore</option>
                    <option>Mumbai</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Cargo Classification</label>
                <select value={cargoType} onChange={(e) => setCargoType(e.target.value)} className="form-select">
                  <option>Pharmaceuticals (Vaccines) [2°C - 8°C]</option>
                  <option>Fresh Produce (Organic Berries) [0°C - 4°C]</option>
                  <option>Frozen Seafood [-22°C - -15°C]</option>
                  <option>Electronics (Microchips) [15°C - 25°C]</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input 
                    type="number" 
                    value={weight} 
                    onChange={(e) => setWeight(e.target.value)} 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className="form-select">
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="dispatch-btn">
                <Navigation size={14} /> Dispatch Live Fleet
              </button>
            </form>
          </div>
        </section>

        {/* Center Panel: Map Container */}
        <section className="dashboard-panel map-panel">
          <div className="panel-header">
            <h2><Navigation size={16} /> Live GPS Route Telemetry</h2>
            {activeVehicle && (
              <span style={{ fontSize: '0.75rem', color: '#0EA5E9' }}>
                Tracking: {activeVehicle.vehicleId} • {activeVehicle.route}
              </span>
            )}
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer 
              center={[20.5937, 78.9629]} // Center of India
              zoom={5} 
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Recenter map when driver selection changes */}
              {activeVehicle && (
                <MapRecenter coordinates={activeVehicle.coordinates} />
              )}

              {/* All active vehicles */}
              {vehicles.map((v) => (
                <Marker 
                  key={v._id} 
                  position={v.coordinates} 
                  icon={createVehicleMarker(v)}
                >
                  <Popup>
                    <div style={{ color: '#000', fontSize: '0.75rem' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{v.vehicleId}</strong><br />
                      <strong>Driver:</strong> {v.driverName}<br />
                      <strong>Speed:</strong> {v.speed} km/h<br />
                      <strong>Temp:</strong> {v.temperature}°C<br />
                      <strong>Battery:</strong> {v.batteryLevel}%
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Selected Route Polyline Overlay */}
              {routePolyline && (
                <Polyline 
                  positions={routePolyline} 
                  color="#6366F1" 
                  dashArray="10, 10" 
                  weight={3} 
                />
              )}
            </MapContainer>
          </div>
        </section>

        {/* Center Bottom Panel: Telemetry Graphs */}
        <section className="dashboard-panel analytics-panel">
          <div className="panel-header">
            <h2><Activity size={16} /> Telemetry Analytics & Sensor Logs</h2>
            {activeVehicle && (
              <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem' }}>
                <span style={{ color: '#0EA5E9' }}>Speed Limit: 80 km/h</span>
                {activeShipment && (
                  <span style={{ color: '#14B8A6' }}>
                    Safe Temp: {activeShipment.temperatureLimit.min}°C to {activeShipment.temperatureLimit.max}°C
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="panel-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.5rem' }}>
            {activeVehicle ? (
              <>
                <div style={{ height: '150px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>TEMP PROFILE (°C)</span>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="#64748B" fontSize={8} />
                      <YAxis stroke="#64748B" fontSize={8} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: '#0E131F', borderColor: 'rgba(99, 102, 241, 0.15)', fontSize: '10px' }} />
                      <Line type="monotone" dataKey="temp" stroke="#0EA5E9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ height: '150px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>SPEED FLUIDITY (KM/H)</span>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="#64748B" fontSize={8} />
                      <YAxis stroke="#64748B" fontSize={8} domain={[40, 110]} />
                      <Tooltip contentStyle={{ background: '#0E131F', borderColor: 'rgba(99, 102, 241, 0.15)', fontSize: '10px' }} />
                      <Line type="monotone" dataKey="speed" stroke="#6366F1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div style={{ gridColumn: "span 2", display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B' }}>
                Select a fleet vehicle to visualize live sensory charts
              </div>
            )}
          </div>
        </section>

        {/* Right Pane: Diagnostic Details & active Alerts */}
        <section className="dashboard-panel" style={{ gridRow: "1 / span 2" }}>
          
          {/* Active Sensor Readings */}
          <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
            <h2 style={{ fontSize: '0.9rem', color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={15} /> Sensor Diagnostic
            </h2>
          </div>
          
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            {activeVehicle ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>SPEED</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: activeVehicle.speed > 80 ? '#F43F5E' : '#FFF' }}>
                    {activeVehicle.speed} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>km/h</span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>CARGO TEMP</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0EA5E9' }}>
                    {activeVehicle.temperature}°C
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>HUMIDITY</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#14B8A6' }}>
                    {activeVehicle.humidity}%
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>BATTERY</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Battery size={14} /> {activeVehicle.batteryLevel}%
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2', padding: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                    <User size={12} color="#6366F1" /> <strong>Driver:</strong> {activeVehicle.driverName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={12} color="#14B8A6" /> <strong>Radio:</strong> {activeVehicle.phone}
                  </div>
                  {activeShipment && (
                    <div style={{ marginTop: '0.4rem', padding: '0.4rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '4px', border: '1px dashed rgba(99, 102, 241, 0.15)' }}>
                      <strong>Cargo Type:</strong> {activeShipment.cargoType}<br />
                      <strong>Priority Status:</strong> <span style={{ color: activeShipment.priority === 'Critical' ? '#F43F5E' : '#F59E0B', fontWeight: 700 }}>{activeShipment.priority}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748B', fontSize: '0.8rem' }}>No Active Unit Selected</div>
            )}
          </div>

          {/* Real-time Alerts Log */}
          <div className="panel-header" style={{ borderTop: '1px solid var(--border-color)' }}>
            <h2 style={{ color: '#F43F5E' }}><ShieldAlert size={16} /> Incident & Alarm Center</h2>
            <span className="status-badge" style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E' }}>
              {alerts.length} Active
            </span>
          </div>

          <div className="panel-content" style={{ overflowY: 'auto' }}>
            <div className="alerts-list">
              {alerts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', color: '#64748B', gap: '0.5rem' }}>
                  <CheckCircle size={32} color="#10B981" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>All Telemetry Normal</span>
                  <span style={{ fontSize: '0.65rem', textAlign: 'center' }}>No active speed or temperature limits breached across the fleet.</span>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert._id} className="alert-card">
                    <div className="alert-card-header">
                      <span className="alert-title">
                        <AlertTriangle size={12} /> {alert.vehicleId} {alert.type}
                      </span>
                      <span className="alert-time">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="alert-message">{alert.message}</div>
                    <button 
                      onClick={() => handleResolveAlert(alert._id)} 
                      className="alert-resolve-btn"
                    >
                      Resolve & Override
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
