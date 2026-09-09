import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Tooltip,
  Marker,
} from 'react-leaflet';
import L from 'leaflet';
import {
  INDIA_ALL_STATES,
  ALL_INDIA_WARDS,
} from '../data/indiaStatesData';
import {
  CloudRain,
  Wind as WindIcon,
  Thermometer,
  Droplets,
  Gauge,
  Globe,
  Map as MapIcon,
  SunMedium,
  Play,
  Pause,
  Compass,
  Radio,
  RotateCcw,
  Layers,
  ChevronDown,
  MapPin,
} from 'lucide-react';

const BASEMAPS = {
  positron: {
    name: 'Clean Light',
    nameHi: 'स्वच्छ मानचित्र',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
  },
  street: {
    name: 'OpenStreetMap',
    nameHi: 'सड़क मानचित्र',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    name: 'Esri Satellite',
    nameHi: 'उपग्रह दृश्य',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{x}/{y}',
    attribution: '&copy; Esri &mdash; Earthstar Geographics',
  },
};

const ALL_INDIA_CENTER = [22.8, 82.0];
const ALL_INDIA_ZOOM = 4.6;

// Map Fly Controller with bound padding
function MapFlyController({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.flyToBounds(bounds, {
        animate: true,
        duration: 1.0,
        padding: [20, 20],
      });
    } else if (center) {
      map.flyTo(center, zoom || 6, {
        animate: true,
        duration: 1.0,
      });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

// Wind Particle Canvas Stream Overlay (Thin, white streamlines matching light theme)
function WindCanvasOverlay({ isActive }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'wind-particle-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '350';
    const container = map.getContainer();
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();

    // Streamline particles
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: 12 + Math.random() * 18,
      speed: 1.6 + Math.random() * 2.2,
      angle: (Math.PI / 180) * (235 + (Math.random() * 24 - 12)),
      opacity: 0.35 + Math.random() * 0.5,
      size: 1.1 + Math.random() * 0.8,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(
          p.x - Math.cos(p.angle) * p.length,
          p.y - Math.sin(p.angle) * p.length
        );
        ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity + 0.3})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    const onMapMove = () => resize();
    map.on('resize', onMapMove);

    return () => {
      cancelAnimationFrame(animId);
      map.off('resize', onMapMove);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [isActive, map]);

  return null;
}

export default function IndiaZoomEarthMap({
  selectedWard,
  onSelectWard,
  selectedStateId,
  onSelectState,
  lang = 'en',
}) {
  const [basemap, setBasemap] = useState('positron');
  const [activeWeatherMode, setActiveWeatherMode] = useState('temperature'); // 'temperature' | 'precipitation' | 'wind' | 'humidity' | 'pressure' | 'wbgt'
  const [humiditySubtype, setHumiditySubtype] = useState('relative');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAllIndiaView, setIsAllIndiaView] = useState(true);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState(2);
  const [currentTimeStr, setCurrentTimeStr] = useState('19:45 IST');

  // Timeline scrubber intervals
  const timelineSteps = [
    { label: '-6h', time: '13:45' },
    { label: '-3h', time: '16:45' },
    { label: 'Live', time: '19:45' },
    { label: '+3h', time: '22:45' },
    { label: '+6h', time: '01:45' },
    { label: '+12h', time: '07:45' },
    { label: '+24h', time: '19:45' },
  ];

  useEffect(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    setCurrentTimeStr(`${hours}:${mins} IST`);
  }, []);

  // Sorted list of all 28 states + 8 UTs (alphabetical)
  const sortedStates = [...INDIA_ALL_STATES].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const activeState =
    INDIA_ALL_STATES.find((s) => s.id === selectedStateId) || sortedStates[0];
  const stateWards = activeState?.wards || [];
  const activeWard = selectedWard || stateWards[0] || ALL_INDIA_WARDS[0];

  // If selectedWard changes, fly to it
  useEffect(() => {
    if (selectedWard && selectedWard.stateId) {
      if (selectedStateId !== selectedWard.stateId) {
        if (onSelectState) onSelectState(selectedWard.stateId);
      }
      setIsAllIndiaView(false);
    }
  }, [selectedWard]);

  const handleStateSelect = (e) => {
    const stateId = e.target.value;
    if (stateId === 'all_india') {
      setIsAllIndiaView(true);
      return;
    }
    setIsAllIndiaView(false);
    onSelectState(stateId);
    const targetState = INDIA_ALL_STATES.find((s) => s.id === stateId);
    if (targetState && targetState.wards.length > 0) {
      onSelectWard(targetState.wards[0]);
    }
  };

  const handleResetToAllIndia = () => {
    setIsAllIndiaView(true);
  };

  const handleSelectSpecificWard = (ward) => {
    setIsAllIndiaView(false);
    onSelectWard(ward);
    if (onSelectState) onSelectState(ward.stateId);
  };

  const mapCenter = isAllIndiaView
    ? ALL_INDIA_CENTER
    : (activeWard?.coordinates || activeState?.center || ALL_INDIA_CENTER);
  const mapZoom = isAllIndiaView ? ALL_INDIA_ZOOM : (activeWard?.coordinates ? 8 : (activeState?.zoom || 7));

  // Custom Layer-specific color schemes matching light UI theme
  const getFeatureStyle = (ward) => {
    const isSelected = activeWard && activeWard.id === ward.id;
    let fillColor = '#6ee7b7';
    let fillOpacity = 0.65;

    if (activeWeatherMode === 'temperature') {
      // Softened thermal spectrum for light theme
      const temp = ward.temperature;
      if (temp >= 42) fillColor = '#f87171'; // Soft Coral Red
      else if (temp >= 38) fillColor = '#fb923c'; // Soft Orange
      else if (temp >= 32) fillColor = '#fde047'; // Pale Yellow
      else if (temp >= 26) fillColor = '#6ee7b7'; // Mint Green
      else fillColor = '#93c5fd'; // Soft Blue
    } else if (activeWeatherMode === 'precipitation') {
      // Greenish -> Pale White gradient
      if (ward.precipitation >= 3.0) fillColor = '#ffffff'; // Pale White for heavy
      else if (ward.precipitation >= 1.0) fillColor = '#bbf7d0'; // Very pale green
      else if (ward.precipitation > 0) fillColor = '#4ade80'; // Light Green
      else fillColor = '#16a34a'; // Soft Green
      fillOpacity = 0.7;
    } else if (activeWeatherMode === 'wind') {
      // Purplish gradient: Lavender -> Deeper Purple
      const spd = ward.windSpeed;
      if (spd >= 20) fillColor = '#7e22ce'; // Deeper purple
      else if (spd >= 15) fillColor = '#a855f7';
      else if (spd >= 10) fillColor = '#c084fc';
      else fillColor = '#e9d5ff'; // Light lavender
      fillOpacity = 0.75;
    } else if (activeWeatherMode === 'humidity') {
      // Yellow -> Warm Orange gradient mix
      const hum = ward.humidity;
      if (hum >= 85) fillColor = '#ea580c'; // Warm Orange
      else if (hum >= 75) fillColor = '#f97316';
      else if (hum >= 60) fillColor = '#f59e0b'; // Amber
      else if (hum >= 45) fillColor = '#facc15';
      else fillColor = '#fef08a'; // Pale Yellow
      fillOpacity = 0.7;
    } else if (activeWeatherMode === 'pressure') {
      // Muted / steely blue gradient light-to-dark
      const p = ward.pressure;
      if (p >= 1018) fillColor = '#0369a1'; // Deep steely blue
      else if (p >= 1012) fillColor = '#0284c7';
      else if (p >= 1008) fillColor = '#38bdf8';
      else if (p >= 1004) fillColor = '#7dd3fc';
      else fillColor = '#e0f2fe'; // Pale soft blue
      fillOpacity = 0.7;
    } else if (activeWeatherMode === 'wbgt') {
      if (ward.riskBand === 'Extreme') fillColor = '#ef4444';
      else if (ward.riskBand === 'Warning') fillColor = '#f97316';
      else fillColor = '#10b981';
    }

    return {
      fillColor,
      fillOpacity: isSelected ? 0.9 : fillOpacity,
      color: isSelected ? '#0f172a' : '#334155',
      weight: isSelected ? 3.0 : 1.4,
    };
  };

  return (
    <div className="zoom-earth-wrapper light-theme-wrapper">
      {/* ============================================================
          TOP TOOLBAR — COMPACT ALL 28 STATES + 8 UTS SELECTOR
      ============================================================= */}
      <div className="zoom-earth-top-toolbar">
        <div className="ze-toolbar-left">
          <div className="ze-toolbar-brand">
            <Globe size={15} className="text-sky-600" />
            <span className="ze-brand-tag">THERMASENSE GIS</span>
          </div>

          <div className="india-selector-pill">
            <Compass size={13} className="text-amber-600" />
            <span className="selector-pill-label">
              {lang === 'hi' ? 'राज्य / केंद्र शासित:' : 'State / UT:'}
            </span>
            <select
              className="gov-select-input"
              value={isAllIndiaView ? 'all_india' : activeState.id}
              onChange={handleStateSelect}
              aria-label="Select State or Union Territory"
            >
              <option value="all_india">
                🇮🇳 {lang === 'hi' ? 'संपूर्ण भारत (२८ राज्य + ८ केंद्र शासित)' : 'All-India National Map (28 States + 8 UTs)'}
              </option>
              <optgroup label="States & Union Territories (A–Z)">
                {sortedStates.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name} ({state.type})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="ze-toolbar-right">
          {!isAllIndiaView && (
            <button
              type="button"
              className="btn-all-india-reset"
              onClick={handleResetToAllIndia}
              title="Return to National Overview"
            >
              <RotateCcw size={12} />
              <span>{lang === 'hi' ? 'संपूर्ण भारत' : 'All-India'}</span>
            </button>
          )}

          <div className="ze-active-ward-pill">
            <MapPin size={12} className="text-sky-600" />
            <span>
              {isAllIndiaView
                ? 'All-India National Overview'
                : `${activeState.name} · ${activeWard.name || activeWard.city}`}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          MAP VIEWPORT (Strictly bounded container)
      ============================================================= */}
      <div className="ze-map-viewport">
        {/* ============================================================
            FLOATING LAYER SWITCHER (Clean Light Glassmorphism)
        ============================================================= */}
        <aside className="ze-floating-sidebar" aria-label="Forecast and Map Layers">
          <div className="ze-sidebar-header">
            <div className="ze-brand-logo">
              <span className="ze-brand-title">ZOOM EARTH</span>
            </div>
          </div>

          <div className="ze-sidebar-scroll">
            {/* BASEMAP TILES */}
            <div className="ze-menu-group">
              <div className="ze-group-heading">
                {lang === 'hi' ? 'बेस मैप' : 'BASE MAP'}
              </div>
              <div className="ze-group-list">
                <button
                  type="button"
                  className={`ze-layer-btn ${basemap === 'positron' ? 'is-active' : ''}`}
                  onClick={() => setBasemap('positron')}
                >
                  <span className="ze-layer-icon-box">🗺️</span>
                  <span className="ze-layer-name">Light Clean</span>
                </button>

                <button
                  type="button"
                  className={`ze-layer-btn ${basemap === 'street' ? 'is-active' : ''}`}
                  onClick={() => setBasemap('street')}
                >
                  <span className="ze-layer-icon-box">📍</span>
                  <span className="ze-layer-name">Street Map</span>
                </button>

                <button
                  type="button"
                  className={`ze-layer-btn ${basemap === 'satellite' ? 'is-active' : ''}`}
                  onClick={() => setBasemap('satellite')}
                >
                  <span className="ze-layer-icon-box">🛰️</span>
                  <span className="ze-layer-name">Satellite</span>
                </button>
              </div>
            </div>

            {/* FORECAST & HAZARD LAYERS */}
            <div className="ze-menu-group">
              <div className="ze-group-heading">
                {lang === 'hi' ? 'मौसम एवं खतरा परतें' : 'HAZARD LAYERS'}
              </div>
              <div className="ze-group-list">
                {/* 1. Heat / Temperature */}
                <button
                  type="button"
                  className={`ze-layer-btn ${activeWeatherMode === 'temperature' ? 'is-active' : ''}`}
                  onClick={() => setActiveWeatherMode('temperature')}
                >
                  <span className="ze-layer-icon-box">🌡️</span>
                  <span className="ze-layer-name">Temperature</span>
                </button>

                {/* 2. Precipitation (Greenish -> Pale White) */}
                <button
                  type="button"
                  className={`ze-layer-btn ${activeWeatherMode === 'precipitation' ? 'is-active' : ''}`}
                  onClick={() => setActiveWeatherMode('precipitation')}
                >
                  <span className="ze-layer-icon-box">🌧️</span>
                  <span className="ze-layer-name">Precipitation</span>
                </button>

                {/* 3. Wind Speed (Purplish Gradient) */}
                <button
                  type="button"
                  className={`ze-layer-btn ${activeWeatherMode === 'wind' ? 'is-active' : ''}`}
                  onClick={() => setActiveWeatherMode('wind')}
                >
                  <span className="ze-layer-icon-box">💨</span>
                  <span className="ze-layer-name">Wind Speed</span>
                </button>

                {/* 4. Humidity (Yellow -> Orange) */}
                <button
                  type="button"
                  className={`ze-layer-btn ${activeWeatherMode === 'humidity' ? 'is-active' : ''}`}
                  onClick={() => setActiveWeatherMode('humidity')}
                >
                  <span className="ze-layer-icon-box">💧</span>
                  <span className="ze-layer-name">Humidity</span>
                </button>

                {/* 5. Air Pressure (Muted Steely Blue) */}
                <button
                  type="button"
                  className={`ze-layer-btn ${activeWeatherMode === 'pressure' ? 'is-active' : ''}`}
                  onClick={() => setActiveWeatherMode('pressure')}
                >
                  <span className="ze-layer-icon-box">🌀</span>
                  <span className="ze-layer-name">Air Pressure</span>
                </button>

                {/* 6. WBGT Heat Stress */}
                <button
                  type="button"
                  className={`ze-layer-btn ${activeWeatherMode === 'wbgt' ? 'is-active' : ''}`}
                  onClick={() => setActiveWeatherMode('wbgt')}
                >
                  <span className="ze-layer-icon-box">🔥</span>
                  <span className="ze-layer-name">WBGT Stress</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ============================================================
            LEAFLET MAP CONTAINER
        ============================================================= */}
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          className="ze-map-container"
        >
          <TileLayer
            key={basemap}
            url={BASEMAPS[basemap].url}
            attribution={BASEMAPS[basemap].attribution}
            maxZoom={18}
          />

          <MapFlyController center={mapCenter} zoom={mapZoom} />

          {/* Wind Streamline Canvas */}
          <WindCanvasOverlay isActive={activeWeatherMode === 'wind'} />

          {/* City / State Pill Badges */}
          {ALL_INDIA_WARDS.map((ward) => {
            const isSelected = activeWard && activeWard.id === ward.id;
            let displayVal = `${ward.temperature}°C`;

            if (activeWeatherMode === 'humidity') {
              displayVal = `${ward.humidity}%`;
            } else if (activeWeatherMode === 'wind') {
              displayVal = `${Math.round(ward.windSpeed * 3.6)} km/h`;
            } else if (activeWeatherMode === 'precipitation') {
              displayVal = ward.precipitation > 0 ? `${ward.precipitation} mm` : '0 mm';
            } else if (activeWeatherMode === 'pressure') {
              displayVal = `${ward.pressure} hPa`;
            } else if (activeWeatherMode === 'wbgt') {
              displayVal = `${ward.wbgt}°C`;
            }

            const badgeHtml = `
              <div class="ze-city-pill light-pill ${isSelected ? 'is-selected' : ''}">
                <span class="ze-pill-city">${ward.name || ward.city}</span>
                <span class="ze-pill-val ${isSelected ? 'is-selected' : ''}">${displayVal}</span>
              </div>
            `;

            const customIcon = L.divIcon({
              className: 'ze-custom-div-icon',
              html: badgeHtml,
              iconSize: [110, 22],
              iconAnchor: [55, 11],
            });

            return (
              <Marker
                key={`badge-${ward.id}`}
                position={ward.coordinates}
                icon={customIcon}
                eventHandlers={{
                  click: () => handleSelectSpecificWard(ward),
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.96}>
                  <div className="ze-map-tooltip light-tooltip">
                    <strong>{ward.name}, {ward.city}</strong>
                    <div>State: <b>{ward.stateName}</b> · Zone: <b>{ward.zone || ward.wardNumber}</b></div>
                    <div>Temp: <b>{ward.temperature}°C</b> | WBGT: <b>{ward.wbgt}°C</b> | Hum: <b>{ward.humidity}%</b></div>
                    <div>Risk Band: <span style={{ color: ward.riskBand === 'Extreme' ? '#ef4444' : ward.riskBand === 'Warning' ? '#ea580c' : '#16a34a', fontWeight: 800 }}>{ward.riskBand}</span></div>
                  </div>
                </Tooltip>
              </Marker>
            );
          })}

          {/* Detailed State Ward Boundary Polygons */}
          {!isAllIndiaView &&
            stateWards.map((w) => {
              if (!w.polygon) return null;
              const geoJsonFeature = {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [w.polygon],
                },
                properties: w,
              };

              return (
                <GeoJSON
                  key={`poly-${w.id}-${activeWeatherMode}-${activeWard?.id === w.id}`}
                  data={geoJsonFeature}
                  style={() => getFeatureStyle(w)}
                  eventHandlers={{
                    click: () => handleSelectSpecificWard(w),
                  }}
                />
              );
            })}
        </MapContainer>

        {/* ============================================================
            INSET MINI-MAP OF INDIA (National Geographic Inset)
        ============================================================= */}
        {!isAllIndiaView && (
          <div className="ze-mini-inset-map light-inset" onClick={handleResetToAllIndia} title="Click to zoom back to All-India view">
            <div className="ze-inset-header">
              <Globe size={10} className="text-sky-600" />
              <span>India Context</span>
            </div>
            <div className="ze-inset-body">
              <svg viewBox="0 0 100 115" className="ze-inset-svg">
                <path
                  d="M48,5 L54,12 L58,10 L62,18 L58,24 L64,28 L68,26 L74,32 L82,33 L85,40 L78,44 L70,44 L66,50 L68,60 L62,70 L54,82 L50,96 L47,96 L44,82 L38,70 L34,60 L32,50 L24,46 L20,40 L28,34 L32,24 L40,16 Z"
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <circle
                  cx={Math.max(25, Math.min(75, ((activeState.center[1] - 68) / (97 - 68)) * 80 + 10))}
                  cy={Math.max(15, Math.min(95, 100 - ((activeState.center[0] - 8) / (37 - 8)) * 90))}
                  r="5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="ze-pulse-marker"
                />
              </svg>
              <div className="ze-inset-footer">
                <strong>{activeState.name}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            BOTTOM COLOR SCALE GRADIENT LEGEND (Custom Colors)
        ============================================================= */}
        <div className="ze-bottom-legend-strip light-legend">
          {/* Heat / Temperature */}
          {activeWeatherMode === 'temperature' && (
            <div className="temp-gradient-custom flex items-center gap-2">
              <span className="legend-unit-title">Temp (°C)</span>
              <div>
                <div className="gradient-bar gradient-temp-soft"></div>
                <div className="gradient-ticks">
                  <span>-30°</span>
                  <span>-10°</span>
                  <span>0°</span>
                  <span>15°</span>
                  <span>25°</span>
                  <span>35°</span>
                  <span>50°C</span>
                </div>
              </div>
            </div>
          )}

          {/* Precipitation (Greenish -> Pale White) */}
          {activeWeatherMode === 'precipitation' && (
            <div className="precip-gradient-custom flex items-center gap-2">
              <span className="legend-unit-title">Precipitation</span>
              <div>
                <div className="gradient-bar gradient-precip-custom"></div>
                <div className="gradient-ticks">
                  <span>No Rain</span>
                  <span>Light</span>
                  <span>Moderate</span>
                  <span>Heavy</span>
                  <span>Snow</span>
                </div>
              </div>
            </div>
          )}

          {/* Wind Speed (Purplish Lavender -> Deeper Purple) */}
          {activeWeatherMode === 'wind' && (
            <div className="wind-gradient-custom flex items-center gap-2">
              <span className="legend-unit-title">Wind (km/h)</span>
              <div>
                <div className="gradient-bar gradient-wind-purple"></div>
                <div className="gradient-ticks">
                  <span>0 (Calm)</span>
                  <span>20</span>
                  <span>40</span>
                  <span>60</span>
                  <span>80</span>
                  <span>100</span>
                  <span>120</span>
                </div>
              </div>
            </div>
          )}

          {/* Humidity (Yellow -> Warm Orange) */}
          {activeWeatherMode === 'humidity' && (
            <div className="humidity-gradient-custom flex items-center gap-2">
              <span className="legend-unit-title">Humidity (%)</span>
              <div>
                <div className="gradient-bar gradient-humidity-warm"></div>
                <div className="gradient-ticks">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}

          {/* Air Pressure (Muted Steely Blue Family) */}
          {activeWeatherMode === 'pressure' && (
            <div className="pressure-gradient-custom flex items-center gap-2">
              <span className="legend-unit-title">Pressure (hPa)</span>
              <div>
                <div className="gradient-bar gradient-pressure-steely"></div>
                <div className="gradient-ticks">
                  <span>970 (Low)</span>
                  <span>990</span>
                  <span>1010</span>
                  <span>1025</span>
                  <span>1045 (High)</span>
                </div>
              </div>
            </div>
          )}

          {/* WBGT */}
          {activeWeatherMode === 'wbgt' && (
            <div className="flex items-center gap-2">
              <span className="legend-unit-title">WBGT Risk</span>
              <div className="flex gap-1.5 text-xs font-bold">
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px]">Caution (&lt;31°C)</span>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px]">Warning (31–33°C)</span>
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px]">Extreme (&gt;33°C)</span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            BOTTOM TIMELINE & SCRUBBER CONTROL BAR (Light Theme)
        ============================================================= */}
        <div className="ze-timeline-control-bar light-timeline">
          <button
            type="button"
            className="ze-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause forecast simulation' : 'Play forecast simulation'}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <div className="ze-timeline-datetime">
            <span className="ze-time-label">9 Sept · {currentTimeStr}</span>
          </div>

          {/* Time Scrubber */}
          <div className="ze-scrubber-steps light-scrubber">
            {timelineSteps.map((step, idx) => (
              <button
                key={step.label}
                type="button"
                className={`ze-scrubber-step ${selectedTimelineIndex === idx ? 'is-active' : ''}`}
                onClick={() => setSelectedTimelineIndex(idx)}
              >
                <span>{step.label}</span>
              </button>
            ))}
          </div>

          <div className="ze-model-tags">
            <span className="ze-tag">IMD WRF 3km</span>
          </div>
        </div>
      </div>
    </div>
  );
}
