import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Tooltip,
  CircleMarker,
} from 'react-leaflet';
import { BENGALURU_WARDS_GEOJSON, WARDS_STATIC_METADATA } from '../data/wardsData';
import {
  Layers,
  CloudRain,
  Wind as WindIcon,
  Thermometer,
  Cloud,
  Globe,
  Map as MapIcon,
  SunMedium,
  Info,
} from 'lucide-react';

const BASEMAPS = {
  positron: {
    name: 'Clean Positron',
    nameHi: 'स्वच्छ मानचित्र',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
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
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Earthstar Geographics',
  },
};

// OpenWeatherMap tile layers
const WEATHER_OVERLAY_CONFIG = {
  precipitation: {
    layer: 'precipitation_new',
    label: 'Precipitation',
    labelHi: 'वर्षा',
    icon: CloudRain,
  },
  wind: {
    layer: 'wind_new',
    label: 'Wind Speed',
    labelHi: 'हवा की गति',
    icon: WindIcon,
  },
  temperature: {
    layer: 'temp_new',
    label: 'Temperature',
    labelHi: 'तापमान',
    icon: Thermometer,
  },
  clouds: {
    layer: 'clouds_new',
    label: 'Cloud Cover',
    labelHi: 'बादल',
    icon: Cloud,
  },
};

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true, duration: 0.6 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function WardMap({
  selectedWardId,
  onSelectWard,
  activeLayer = 'wbgt',
  onLayerChange,
  liveWards = [],
  geoData = null,
  lang = 'en',
  translations,
}) {
  const [basemap, setBasemap] = useState('positron');
  const [activeWeatherOverlay, setActiveWeatherOverlay] = useState(null); // 'precipitation' | 'wind' | 'temperature' | 'clouds' | null
  const t = translations || {};

  // Check OpenWeatherMap API key from environment
  const owmApiKey =
    import.meta.env.VITE_OWM_API_KEY ||
    import.meta.env.VITE_OPENWEATHER_API_KEY ||
    import.meta.env.OWM_API_KEY ||
    '';

  const hasOwmKey = Boolean(owmApiKey && owmApiKey !== 'YOUR_OPENWEATHER_KEY' && owmApiKey !== 'YOUR_KEY');

  // Merged ward list for rendering (live data overlaid on static metadata)
  const mergedWards = WARDS_STATIC_METADATA.map((staticWard) => {
    const liveMatch = liveWards.find((lw) => (lw.id === staticWard.id || lw.properties?.id === staticWard.id));
    const liveProps = liveMatch?.properties || liveMatch || {};
    return {
      ...staticWard,
      ...liveProps,
      vulnerability: staticWard.vulnerability,
      coordinates: staticWard.coordinates,
      riskBand: liveProps.risk_band || liveProps.riskBand || 'Caution',
      riskLevel: (liveProps.risk_band || liveProps.riskBand || 'caution').toLowerCase(),
      wbgt: liveProps.wbgt,
      utci: liveProps.utci,
      heatIndex: liveProps.heat_index || liveProps.heatIndex,
      isLive: liveProps.is_live,
    };
  });

  const selectedWard = mergedWards.find((w) => w.id === selectedWardId) || mergedWards[0];

  const getFeatureStyle = (feature) => {
    const wardId = feature?.properties?.id;
    const isSelected = wardId === selectedWardId;
    const ward = mergedWards.find((w) => w.id === wardId);

    let fillColor = '#2e7d32'; // Caution Green
    let fillOpacity = 0.58;

    if (activeLayer === 'wbgt') {
      const wbgt = ward?.wbgt;
      if (wbgt === null || wbgt === undefined) {
        fillColor = '#64748b'; // Neutral Slate when loading / unavailable
        fillOpacity = 0.45;
      } else if (wbgt >= 33.0) {
        fillColor = '#c62828'; // Extreme Red
        fillOpacity = 0.68;
      } else if (wbgt >= 31.0) {
        fillColor = '#ef6c00'; // Warning Orange
        fillOpacity = 0.62;
      } else {
        fillColor = '#2e7d32'; // Caution Green
        fillOpacity = 0.55;
      }
    } else if (activeLayer === 'vulnerability') {
      const score = ward?.vulnerability?.compositeScore || feature.properties?.vulnerabilityScore || 50;
      if (score >= 70) {
        fillColor = '#b71c1c';
        fillOpacity = 0.70;
      } else if (score >= 45) {
        fillColor = '#f57c00';
        fillOpacity = 0.64;
      } else {
        fillColor = '#388e3c';
        fillOpacity = 0.55;
      }
    } else if (activeLayer === 'heatmap') {
      const heatIndex = ward?.heatIndex;
      if (heatIndex === null || heatIndex === undefined) {
        fillColor = '#64748b';
        fillOpacity = 0.45;
      } else if (heatIndex >= 43.0) {
        fillColor = '#d32f2f';
        fillOpacity = 0.75;
      } else if (heatIndex >= 38.0) {
        fillColor = '#f57c00';
        fillOpacity = 0.68;
      } else {
        fillColor = '#689f38';
        fillOpacity = 0.58;
      }
    }

    return {
      fillColor,
      fillOpacity: isSelected ? Math.min(fillOpacity + 0.2, 0.92) : fillOpacity,
      color: isSelected ? '#0a2540' : '#1e3a5f',
      weight: isSelected ? 3.5 : 1.8,
      dashArray: isSelected ? '' : '3, 3',
    };
  };

  const onEachFeature = (feature, layer) => {
    const wardId = feature?.properties?.id;
    const ward = mergedWards.find((w) => w.id === wardId);
    const wardName = lang === 'hi' ? (ward?.nameHi || feature.properties.nameHi) : (ward?.name || feature.properties.name);
    const wardNum = feature?.properties?.wardNumber || `Ward ${wardId}`;
    const riskBand = ward?.riskBand || 'Caution';
    const wbgt = ward?.wbgt !== null && ward?.wbgt !== undefined ? `${ward.wbgt}°C` : '—';
    const utci = ward?.utci !== null && ward?.utci !== undefined ? `${ward.utci}°C` : '—';

    layer.bindTooltip(
      `<div class="map-ward-tooltip">
        <div class="tooltip-header">
          <strong>${wardNum} — ${wardName}</strong>
          <span class="tooltip-badge badge-${riskBand.toLowerCase()}">${riskBand.toUpperCase()}</span>
        </div>
        <div class="tooltip-metrics">
          <span>WBGT (est): <b>${wbgt}</b></span>
          <span>UTCI (mod): <b>${utci}</b></span>
        </div>
        <div class="tooltip-action">${lang === 'hi' ? 'क्लिक करके चुनें' : 'Click to inspect ward'}</div>
      </div>`,
      {
        sticky: true,
        direction: 'top',
        className: 'custom-leaflet-tooltip',
        opacity: 0.98,
      }
    );

    layer.on({
      click: () => {
        if (onSelectWard) {
          onSelectWard(wardId);
        }
      },
      mouseover: (e) => {
        const target = e.target;
        if (wardId !== selectedWardId) {
          target.setStyle({
            weight: 3,
            color: '#0a2540',
            fillOpacity: 0.85,
          });
        }
      },
      mouseout: (e) => {
        const target = e.target;
        if (wardId !== selectedWardId) {
          target.setStyle(getFeatureStyle(feature));
        }
      },
    });
  };

  const mapCenter = [12.9716, 77.5946];

  return (
    <div className="gis-map-wrapper">
      {/* Top Map Toolbar */}
      <div className="gis-map-top-bar">
        <div className="gis-layer-toggles" role="group" aria-label="Map layer selection">
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'wbgt' ? 'active' : ''}`}
            onClick={() => onLayerChange && onLayerChange('wbgt')}
          >
            <span className="layer-dot dot-wbgt"></span>
            {t.layerWbgt || 'WBGT layer'}
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'vulnerability' ? 'active' : ''}`}
            onClick={() => onLayerChange && onLayerChange('vulnerability')}
          >
            <span className="layer-dot dot-vuln"></span>
            {t.layerVuln || 'Vulnerability layer'}
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'heatmap' ? 'active' : ''}`}
            onClick={() => onLayerChange && onLayerChange('heatmap')}
          >
            <span className="layer-dot dot-heatmap"></span>
            {t.layerHeatmap || 'Heatmap overlay'}
          </button>
        </div>

        <div className="gis-basemap-switcher">
          <span className="basemap-label">{lang === 'hi' ? 'आधार:' : 'Base:'}</span>
          {Object.entries(BASEMAPS).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className={`basemap-btn ${basemap === key ? 'active' : ''}`}
              onClick={() => setBasemap(key)}
              title={config.name}
            >
              {key === 'positron' ? (lang === 'hi' ? 'स्पष्ट' : 'Clean') : key === 'street' ? (lang === 'hi' ? 'सड़क' : 'Street') : (lang === 'hi' ? 'उपग्रह' : 'Satellite')}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas Container with Floating Left Controls */}
      <div className="gis-map-canvas-container">
        {/* ============================================================
            TASK 4: Zoom Earth Style Left-Side Vertical Layer Control Panel
        ============================================================= */}
        <div className="zoom-earth-layer-panel" aria-label="Map layers and overlays">
          <div className="layer-panel-section-title">
            <Layers size={13} />
            <span>{lang === 'hi' ? 'परत नियंत्रण' : 'LAYERS'}</span>
          </div>

          {/* Base Layer Switchers */}
          <div className="layer-panel-group">
            <button
              type="button"
              className={`zoom-layer-btn ${basemap === 'satellite' ? 'active' : ''}`}
              onClick={() => setBasemap('satellite')}
              title={lang === 'hi' ? 'उपग्रह दृश्य' : 'Satellite Imagery'}
            >
              <Globe size={16} />
              <span className="zoom-btn-label">{lang === 'hi' ? 'उपग्रह' : 'Satellite'}</span>
            </button>

            <button
              type="button"
              className={`zoom-layer-btn ${basemap === 'street' ? 'active' : ''}`}
              onClick={() => setBasemap('street')}
              title={lang === 'hi' ? 'सड़क दृश्य' : 'Street Map'}
            >
              <MapIcon size={16} />
              <span className="zoom-btn-label">{lang === 'hi' ? 'सड़क' : 'Street'}</span>
            </button>

            <button
              type="button"
              className={`zoom-layer-btn ${basemap === 'positron' ? 'active' : ''}`}
              onClick={() => setBasemap('positron')}
              title={lang === 'hi' ? 'स्पष्ट दृश्य' : 'Clean Light'}
            >
              <SunMedium size={16} />
              <span className="zoom-btn-label">{lang === 'hi' ? 'स्पष्ट' : 'Clean'}</span>
            </button>
          </div>

          <div className="layer-panel-divider"></div>

          {/* Weather Overlays (OpenWeatherMap Tile Layers) */}
          <div className="layer-panel-section-title">
            <CloudRain size={13} />
            <span>{lang === 'hi' ? 'मौसम ओवरले' : 'WEATHER'}</span>
          </div>

          <div className="layer-panel-group">
            {Object.entries(WEATHER_OVERLAY_CONFIG).map(([key, item]) => {
              const IconComp = item.icon;
              const isActive = activeWeatherOverlay === key;

              return (
                <div key={key} className="weather-overlay-btn-wrapper">
                  <button
                    type="button"
                    className={`zoom-layer-btn weather-layer-btn ${isActive ? 'active' : ''} ${!hasOwmKey ? 'disabled' : ''}`}
                    disabled={!hasOwmKey}
                    onClick={() => setActiveWeatherOverlay(isActive ? null : key)}
                    title={!hasOwmKey ? 'Add OWM_API_KEY to .env to enable' : (lang === 'hi' ? item.labelHi : item.label)}
                  >
                    <IconComp size={16} />
                    <span className="zoom-btn-label">{lang === 'hi' ? item.labelHi : item.label}</span>
                  </button>
                  {!hasOwmKey && (
                    <div className="owm-key-tooltip">
                      <Info size={11} />
                      <span>Add OWM_API_KEY to .env to enable</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaflet Map */}
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom={true}
          className="gis-leaflet-container"
        >
          {/* Active Basemap */}
          <TileLayer
            key={basemap}
            url={BASEMAPS[basemap].url}
            attribution={BASEMAPS[basemap].attribution}
            maxZoom={18}
          />

          {/* Weather Overlay TileLayer if Active & Key Present */}
          {hasOwmKey && activeWeatherOverlay && (
            <TileLayer
              key={`weather-${activeWeatherOverlay}`}
              url={`https://tile.openweathermap.org/map/${WEATHER_OVERLAY_CONFIG[activeWeatherOverlay].layer}/{z}/{x}/{y}.png?appid=${owmApiKey}`}
              attribution="&copy; OpenWeatherMap"
              opacity={0.65}
              maxZoom={18}
            />
          )}

          <MapController center={selectedWard ? selectedWard.coordinates : mapCenter} />

          {/* Choropleth Ward Polygons */}
          <GeoJSON
            key={`${activeLayer}-${selectedWardId}-${basemap}-${JSON.stringify(liveWards.map(w => w.wbgt))}`}
            data={geoData || BENGALURU_WARDS_GEOJSON}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />

          {/* Ward Centroid Labels / Markers */}
          {mergedWards.map((w) => {
            const isSelected = w.id === selectedWardId;
            return (
              <CircleMarker
                key={`marker-${w.id}`}
                center={w.coordinates}
                radius={isSelected ? 6 : 4}
                pathOptions={{
                  fillColor: isSelected ? '#0a2540' : '#ffffff',
                  fillOpacity: 1,
                  color: isSelected ? '#ffffff' : '#0a2540',
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="center" className={`ward-center-tag ${isSelected ? 'selected' : ''}`}>
                  <span>{w.wardNumber}</span>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Bottom Left Choropleth Legend */}
        <div className="gis-map-legend">
          <div className="legend-header">
            <strong>{t.legendTitle || 'Risk Level Legend'}</strong>
            <span className="legend-layer-tag">{activeLayer.toUpperCase()}</span>
          </div>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-swatch swatch-caution"></span>
              <span className="legend-label">{t.legendCaution || 'Caution (< 31°C)'}</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch swatch-warning"></span>
              <span className="legend-label">{t.legendWarning || 'Warning (31 - 33°C)'}</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch swatch-extreme"></span>
              <span className="legend-label">{t.legendExtreme || 'Extreme (> 33°C)'}</span>
            </div>
          </div>
          <div className="legend-note">
            {t.clickToSelect || 'Click any ward polygon to inspect details'}
          </div>
        </div>

        {/* Selected Ward Floating Indicator on Map */}
        {selectedWard && (
          <div className="gis-map-selected-pill">
            <span className={`pill-dot dot-${selectedWard.riskLevel}`}></span>
            <span className="pill-name">{selectedWard.wardNumber}: {lang === 'hi' ? selectedWard.nameHi : selectedWard.name}</span>
            <span className={`pill-badge badge-${selectedWard.riskLevel}`}>{selectedWard.riskBand.toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
