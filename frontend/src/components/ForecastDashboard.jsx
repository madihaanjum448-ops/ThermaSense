import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import {
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Calendar,
  MapPin
} from 'lucide-react';

// ============================================================================
// CONSTANTS & DEFINITIONS
// ============================================================================

// ===========================================================================
// LOCATION DATA IMPORT
// ===========================================================================
import locationData from '../data/india_locations.json';

// Helper to flatten wards into a map for quick lookup (optional)
const getStateList = () => locationData.map((state) => state.name);
const getCitiesForState = (stateName) => {
  const stateObj = locationData.find((s) => s.name === stateName);
  return stateObj ? stateObj.cities.map((c) => c.name) : [];
};
const getWardsForCity = (stateName, cityName) => {
  const stateObj = locationData.find((s) => s.name === stateName);
  if (!stateObj) return [];
  const cityObj = stateObj.cities.find((c) => c.name === cityName);
  return cityObj ? cityObj.wards : [];
};

// NOTE: We keep a fallback constant for backward compatibility (unused now)
const CITY_WARDS = {};


const RISK_BANDS = [
  { name: 'Low', min: 0, max: 35, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: '#86efac', text: '#15803d' },
  { name: 'Moderate', min: 35, max: 60, color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: '#fde047', text: '#a16207' },
  { name: 'Extreme', min: 80, max: 100, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', border: '#fca5a5', text: '#b91c1c' },
];

const tileStyle = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 600, color: '#0f172a' };


const getRiskBandInfo = (score) => {
  if (score >= 80) return RISK_BANDS[3]; // Extreme
  if (score >= 60) return RISK_BANDS[2]; // High
  if (score >= 35) return RISK_BANDS[1]; // Moderate
  return RISK_BANDS[0]; // Low
};

// ============================================================================
// DATA PROVIDER (Single function boundary for future live API replacement)
// ============================================================================

/**
 * Generates or fetches forecast time-series data for a given city, ward, and test scenario.
 * Returns { success: boolean, data?: Array, warning?: string }
 */
async function generateForecast({ city, wardId, scenario = 'NORMAL' }) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (scenario === 'API failure') {
    throw new Error('500 Internal Server Error: Failed to fetch forecast readings from weather service.');
  }

  if (scenario === 'Empty forecast') {
    return {
      success: true,
      data: [],
      warning: null
    };
  }

  const now = new Date();
  const rawPoints = [];

  const formatDayLabel = (d, isToday) => {
    if (isToday) return 'Today (Current)';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const createPoint = (dateObj, isForecast, riskScore, wbgt, utci, hi, isDuplicate = false, timeLabel = '') => {
    const bandInfo = getRiskBandInfo(riskScore);
    return {
      timestamp: dateObj.toISOString(),
      displayDate: timeLabel || formatDayLabel(dateObj, !isForecast),
      is_forecast: isForecast,
      final_risk_score: riskScore,
      risk_band: bandInfo.name.toLowerCase(),
      wbgt_c: wbgt,
      utci_c: utci,
      heat_index_c: hi,
      vulnerability_score: 42.5,
      isDuplicate
    };
  };

  // 1. Handle Duplicate Ingestion Scenario
  if (scenario === 'Duplicate ingestion (today)') {
    const todayStale = new Date(now);
    todayStale.setUTCHours(6, 0, 0, 0);

    const todayFresh = new Date(now);
    todayFresh.setUTCHours(12, 0, 0, 0);

    const stalePoint = createPoint(todayStale, false, 52.0, 27.8, 32.4, 33.0, true, 'Today 06:00 UTC (Stale)');
    const freshPoint = createPoint(todayFresh, false, 68.4, 30.6, 36.2, 38.5, false, 'Today 12:00 UTC (Fresh)');

    const forecastList = [
      createPoint(new Date(now.getTime() + 1 * 86400000), true, 72.0, 31.2, 37.0, 39.0),
      createPoint(new Date(now.getTime() + 2 * 86400000), true, 78.5, 32.4, 38.2, 40.5),
      createPoint(new Date(now.getTime() + 3 * 86400000), true, 84.0, 33.5, 40.1, 42.0),
      createPoint(new Date(now.getTime() + 4 * 86400000), true, 81.2, 33.0, 39.4, 41.2),
      createPoint(new Date(now.getTime() + 5 * 86400000), true, 66.0, 29.8, 34.8, 36.5),
      createPoint(new Date(now.getTime() + 6 * 86400000), true, 58.0, 28.5, 33.0, 34.2)
    ];

    const deduplicatedData = [freshPoint, ...forecastList];

    return {
      success: true,
      data: deduplicatedData,
      rawCountWithDuplicates: [stalePoint, freshPoint, ...forecastList].length,
      warning: 'Duplicate weather ingestion detected for today. Displaying the fresher reading (12:00 UTC) and discarded the stale duplicate.'
    };
  }

  // 2. Trajectory Scenarios
  let scorePattern = [];
  let wbgtPattern = [];
  let utciPattern = [];
  let hiPattern = [];

  switch (scenario) {
    case 'LOW forecast':
      scorePattern = [24.0, 26.5, 29.0, 31.2, 28.0, 25.0, 22.5];
      wbgtPattern  = [21.5, 22.0, 22.8, 23.4, 22.5, 21.8, 21.0];
      utciPattern  = [23.0, 24.2, 25.0, 25.8, 24.5, 23.5, 22.8];
      hiPattern    = [25.0, 26.2, 27.0, 28.0, 26.8, 25.5, 24.8];
      break;

    case 'HIGH forecast':
      scorePattern = [48.0, 56.5, 64.2, 71.0, 75.8, 68.4, 62.0];
      wbgtPattern  = [27.0, 28.4, 29.6, 30.8, 31.4, 30.2, 29.0];
      utciPattern  = [31.5, 33.2, 35.0, 36.8, 37.5, 35.8, 34.0];
      hiPattern    = [33.0, 35.2, 37.4, 39.5, 40.2, 38.0, 36.0];
      break;

    case 'EXTREME forecast':
      scorePattern = [62.0, 74.5, 83.0, 89.5, 94.0, 88.2, 79.5];
      wbgtPattern  = [29.2, 31.0, 32.8, 34.2, 35.0, 33.8, 32.0];
      utciPattern  = [34.0, 36.8, 39.5, 42.0, 44.2, 41.5, 38.6];
      hiPattern    = [36.5, 39.8, 43.0, 45.8, 48.0, 44.5, 41.0];
      break;

    case 'NORMAL':
    default:
      const cityOffset = city === 'Nagpur' ? 4.5 : 0;
      const wardOffset = (wardId % 3) * 2.0;
      scorePattern = [
        42.0 + cityOffset,
        48.5 + cityOffset + wardOffset,
        55.0 + cityOffset,
        63.2 + cityOffset + wardOffset,
        59.0 + cityOffset,
        51.4 + cityOffset,
        45.0 + cityOffset
      ];
      wbgtPattern = [25.5, 26.8, 28.0, 29.5, 28.8, 27.2, 26.0];
      utciPattern = [29.0, 31.2, 33.0, 35.4, 34.2, 32.0, 30.5];
      hiPattern   = [31.0, 33.4, 35.8, 38.0, 36.8, 34.5, 32.8];
      break;
  }

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(now.getTime() + i * 86400000);
    const isForecast = i > 0;
    const score = Math.round(scorePattern[i] * 10) / 10;
    const wbgt = Math.round(wbgtPattern[i] * 10) / 10;
    const utci = Math.round(utciPattern[i] * 10) / 10;
    const hi = Math.round(hiPattern[i] * 10) / 10;

    rawPoints.push(createPoint(targetDate, isForecast, score, wbgt, utci, hi));
  }

  return {
    success: true,
    data: rawPoints,
    warning: null
  };
}

// ============================================================================
// CUSTOM TOOLTIP COMPONENT
// ============================================================================

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const band = getRiskBandInfo(data.final_risk_score);

  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      minWidth: '220px',
      zIndex: 50
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
        <span style={{ fontWeight: 600, color: '#1e293b' }}>{data.displayDate}</span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: data.is_forecast ? '#f1f5f9' : '#0284c7',
          color: data.is_forecast ? '#475569' : '#ffffff'
        }}>
          {data.is_forecast ? 'Forecast' : 'Current Obs'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ color: '#64748b' }}>Risk Score:</span>
        <span style={{
          fontWeight: 700,
          fontSize: '15px',
          color: band.color,
          backgroundColor: band.bg,
          padding: '2px 8px',
          borderRadius: '4px',
          border: `1px solid ${band.border}`
        }}>
          {data.final_risk_score} — {band.name}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: '#334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748b' }}>WBGT:</span>
          <strong>{data.wbgt_c}°C</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748b' }}>UTCI:</span>
          <strong>{data.utci_c}°C</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748b' }}>Heat Index:</span>
          <strong>{data.heat_index_c}°C</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748b' }}>Vuln Score:</span>
          <strong>{data.vulnerability_score}</strong>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CUSTOM DOT RENDERER (Distinguishes Current vs Forecast on chart)
// ============================================================================

const CustomizedDot = (props) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;

  const band = getRiskBandInfo(payload.final_risk_score);

  if (!payload.is_forecast) {
    return (
      <g key={`dot-${payload.timestamp}`}>
        <circle cx={cx} cy={cy} r={8} fill={band.color} fillOpacity={0.25} />
        <circle cx={cx} cy={cy} r={5} fill={band.color} stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  }

  return (
    <circle key={`dot-${payload.timestamp}`} cx={cx} cy={cy} r={4} fill="#ffffff" stroke={band.color} strokeWidth={2.5} />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ForecastDashboard() {
// State handling
  const [selectedState, setSelectedState] = useState(locationData[0]?.name || '');
  const [selectedCity, setSelectedCity] = useState(() => {
    const initState = locationData[0];
    return initState?.cities[0]?.name || '';
  });
  const [selectedWardId, setSelectedWardId] = useState(() => {
    const initState = locationData[0];
    const initCity = initState?.cities[0];
    return initCity?.wards[0]?.id || 0;
  });
  const [scenario, setScenario] = useState('NORMAL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [warningMessage, setWarningMessage] = useState(null);

  // Helpers to get lists
  const cityList = useMemo(() => getCitiesForState(selectedState), [selectedState]);
  const wards = useMemo(() => getWardsForCity(selectedState, selectedCity) || [], [selectedState, selectedCity]);

  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    const cities = getCitiesForState(newState);
    const firstCity = cities[0] || '';
    setSelectedCity(firstCity);
    const cityWards = getWardsForCity(newState, firstCity);
    const firstWardId = cityWards[0]?.id || 0;
    setSelectedWardId(firstWardId);
  };

  const handleCityChange = (e) => {
    const newCity = e.target.value;
    setSelectedCity(newCity);
    const cityWards = getWardsForCity(selectedState, newCity);
    if (cityWards.length > 0) {
      setSelectedWardId(cityWards[0].id);
    } else {
      setSelectedWardId(0);
    }
  };

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarningMessage(null);

    try {
      const res = await generateForecast({
        city: selectedCity,
        wardId: selectedWardId,
        scenario
      });
      setForecastData(res.data || []);
      setWarningMessage(res.warning || null);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while loading forecast data.');
      setForecastData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCity, selectedWardId, scenario]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  // Fetch live ward data and compute aggregates
  const [wardData, setWardData] = useState(null);
  useEffect(() => {
    fetch('/wards/geojson')
      .then((r) => r.json())
      .then((data) => setWardData(data))
      .catch((e) => console.error('Failed to fetch ward data', e));
  }, [selectedState, selectedCity]);

  const wardCount = useMemo(() => {
    if (!wardData) return 0;
    const feats = wardData.features.filter((f) => f.properties.city === selectedCity);
    return feats.length;
  }, [wardData, selectedCity]);

  const avgWbgt = useMemo(() => {
    if (!wardData) return null;
    const vals = wardData.features
      .filter((f) => f.properties.city === selectedCity && f.properties.wbgt != null)
      .map((f) => f.properties.wbgt);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [wardData, selectedCity]);

  const avgUti = useMemo(() => {
    if (!wardData) return null;
    const vals = wardData.features
      .filter((f) => f.properties.city === selectedCity && f.properties.utci != null)
      .map((f) => f.properties.utci);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [wardData, selectedCity]);

  const avgHi = useMemo(() => {
    if (!wardData) return null;
    const vals = wardData.features
      .filter((f) => f.properties.city === selectedCity && f.properties.heat_index != null)
      .map((f) => f.properties.heat_index);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [wardData, selectedCity]);

  const activeAlerts = useMemo(() => {
    if (!wardData) return 0;
    return wardData.features.filter(
      (f) =>
        f.properties.city === selectedCity &&
        (f.properties.risk_band === 'HIGH' || f.properties.risk_band === 'EXTREME')
    ).length;
  }, [wardData, selectedCity]);

  const dataAgeMins = useMemo(() => {
    if (!wardData) return null;
    const times = wardData.features.map((f) => new Date(f.properties.score_time).getTime());
    const max = Math.max(...times);
    return Math.round((Date.now() - max) / 60000);
  }, [wardData]);

  const currentWard = useMemo(() => {
    return wards.find((w) => w.id === Number(selectedWardId)) || wards[0];
  }, [wards, selectedWardId]);

  const summary = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return null;
    const current = forecastData.find((p) => !p.is_forecast) || forecastData[0];
    const peak = [...forecastData].sort((a, b) => b.final_risk_score - a.final_risk_score)[0];
    return {
      currentScore: current.final_risk_score,
      currentBand: getRiskBandInfo(current.final_risk_score),
      peakScore: peak.final_risk_score,
      peakBand: getRiskBandInfo(peak.final_risk_score),
      peakDate: peak.displayDate
    };
  }, [forecastData]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a',
      overflowY: 'auto'
    }}>
      {/* Header Bar */}
      <header style={{
        padding: '14px 24px',
        backgroundColor: '#1e293b',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: '#0284c7',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp size={20} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              ThermaSense — Heat-Risk Forecast Trend
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Ward-Level Multi-Day Thermal Stress & Demographic Vulnerability Trajectory
            </p>
          </div>
        </div>

        {/* Top Controls: City & Ward & Scenario Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} color="#94a3b8" />
            <select
              aria-label="City selector"
              value={selectedCity}
              onChange={handleCityChange}
              style={{
                backgroundColor: '#334155',
                color: '#ffffff',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="New Delhi">New Delhi</option>
              <option value="Nagpur">Nagpur</option>
            </select>
          </div>

          <select
            aria-label="Ward selector"
            value={selectedWardId}
            onChange={(e) => setSelectedWardId(Number(e.target.value))}
            style={{
              backgroundColor: '#334155',
              color: '#ffffff',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
              maxWidth: '220px'
            }}
          >
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Scenario (test) Selector — Required for QA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0f172a',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #38bdf8'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
              Scenario (test):
            </span>
            <select
              aria-label="Scenario test selector"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#ffffff',
                border: '1px solid #475569',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="NORMAL">NORMAL</option>
              <option value="LOW forecast">LOW forecast</option>
              <option value="HIGH forecast">HIGH forecast</option>
              <option value="EXTREME forecast">EXTREME forecast</option>
              <option value="Empty forecast">Empty forecast</option>
              <option value="API failure">API failure</option>
              <option value="Duplicate ingestion (today)">Duplicate ingestion (today)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '20px 24px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Warning Banner */}
        {warningMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef08a',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#b45309',
            fontSize: '13px'
          }}>
            <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontWeight: 700 }}>Ingestion Warning: </strong>
              <span>{warningMessage}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {summary && !loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Current Thermal Risk
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: summary.currentBand.color }}>
                  {summary.currentScore}
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: summary.currentBand.bg,
                  color: summary.currentBand.text
                }}>
                  {summary.currentBand.name}
                </span>
              </div>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                7-Day Peak Risk Expected
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: summary.peakBand.color }}>
                  {summary.peakScore}
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: summary.peakBand.bg,
                  color: summary.peakBand.text
                }}>
                  {summary.peakBand.name}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>
                  on {summary.peakDate}
                </span>
              </div>
            </div>

            {currentWard && (
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                gridColumn: 'span 2'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Ward Vulnerability Profile: {currentWard.name}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#334155' }}>
                  <span>Elderly 60+: <strong>{currentWard.elderly_pct}%</strong></span>
                  <span>Outdoor Workers: <strong>{currentWard.outdoor_worker_pct}%</strong></span>
                  <span>Slum Households: <strong>{currentWard.slum_pct}%</strong></span>
                  <span>Green Cover: <strong>{currentWard.green_pct}%</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart Card */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          minHeight: '440px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                7-Day Heat Risk Score Trajectory (0–100)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Combines Liljegren WBGT, UTCI, Lu-Romps Heat Index & Demographic Vulnerability
              </p>
            </div>

            {/* Legend for Risk Bands */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ef4444' }}></span>
                <span style={{ color: '#64748b' }}>Extreme (80–100)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f97316' }}></span>
                <span style={{ color: '#64748b' }}>High (60–80)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#eab308' }}></span>
                <span style={{ color: '#64748b' }}>Moderate (35–60)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#22c55e' }}></span>
                <span style={{ color: '#64748b' }}>Low (0–35)</span>
              </div>
            </div>
          </div>

          {/* Conditional States */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', minHeight: '340px' }}>
              <RefreshCw size={28} color="#0284c7" />
              <span style={{ fontSize: '14px', color: '#64748b' }}>Loading forecast data...</span>
            </div>
          ) : error ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              minHeight: '340px',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #fee2e2'
            }}>
              <AlertCircle size={36} color="#ef4444" />
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#991b1b' }}>
                  Unable to Load Forecast Data
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', maxWidth: '400px' }}>
                  {error}
                </p>
              </div>
              <button
                onClick={loadForecast}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                }}
              >
                <RefreshCw size={14} /> Retry Request
              </button>
            </div>
          ) : forecastData.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '340px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1'
            }}>
              <Calendar size={36} color="#94a3b8" />
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: '#475569' }}>
                  No Forecast Data Available
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  No active forecast observations found for ward #{selectedWardId} in {selectedCity}.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={forecastData}
                  margin={{ top: 10, right: 30, left: -10, bottom: 20 }}
                >
                  <ReferenceArea y1={80} y2={100} fill="rgba(239, 68, 68, 0.08)" stroke="none" />
                  <ReferenceArea y1={60} y2={80} fill="rgba(249, 115, 22, 0.08)" stroke="none" />
                  <ReferenceArea y1={35} y2={60} fill="rgba(234, 179, 8, 0.08)" stroke="none" />
                  <ReferenceArea y1={0} y2={35} fill="rgba(34, 197, 94, 0.08)" stroke="none" />

                  <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <ReferenceLine y={60} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <ReferenceLine y={35} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.6} />

                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                  <XAxis
                    dataKey="displayDate"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    dy={10}
                  />

                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 35, 60, 80, 100]}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Line
                    type="monotone"
                    dataKey="final_risk_score"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={<CustomizedDot />}
                    activeDot={{ r: 7, stroke: '#0284c7', strokeWidth: 2, fill: '#ffffff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
