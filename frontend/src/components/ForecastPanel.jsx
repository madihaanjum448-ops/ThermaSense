import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';

const RISK_COLORS = {
  low: '#22c55e',
  moderate: '#eab308',
  high: '#f97316',
  extreme: '#ef4444',
  unknown: '#9ca3af'
};

const bandColor = (band) => RISK_COLORS[band?.toLowerCase()] || RISK_COLORS.unknown;

function fmtHour(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Colors each point by its own risk band, regardless of which line it belongs to. */
function BandDot(props) {
  const { cx, cy, payload, dataKey } = props;
  const value = payload[dataKey];
  if (value === null || value === undefined || cx === undefined) return null;

  const band = dataKey === 'current' ? payload.currentBand : payload.band;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={dataKey === 'current' ? 7 : 5}
      fill={bandColor(band)}
      stroke="#fff"
      strokeWidth={dataKey === 'current' ? 2 : 1.5}
    />
  );
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload.find((p) => p.value !== null && p.value !== undefined);
  if (!point) return null;

  const d = point.payload;
  const isCurrent = point.dataKey === 'current';
  const band = isCurrent ? d.currentBand : d.band;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        fontFamily: 'sans-serif',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
        minWidth: 180
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {label} {isCurrent ? '(current reading)' : '(forecast)'}
      </div>
      {d.timestamp && (
        <div style={{ color: '#64748b', marginBottom: 6 }}>
          {fmtHour(d.timestamp)}
        </div>
      )}
      <div>WBGT: <strong>{d.wbgt ?? 'N/A'}°C</strong></div>
      <div>UTCI: <strong>{d.utci ?? 'N/A'}°C</strong></div>
      <div>Heat Index: <strong>{d.heat_index ?? 'N/A'}°C</strong></div>
      <div>Final Risk Score: <strong>{d.finalScoreRaw ?? 'N/A'}</strong></div>
      <div style={{ marginTop: 6 }}>
        <span
          style={{
            background: bandColor(band),
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 4,
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: 10
          }}
        >
          {band || 'unknown'}
        </span>
      </div>
    </div>
  );
}

export default function ForecastPanel({ wards, selectedWardId, onSelectWard }) {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const selectedWard = wards.find((w) => String(w.id) === String(selectedWardId));

  const loadForecast = useCallback(async (wardId) => {
    if (!wardId) return;

    setLoading(true);
    setError(null);
    setForecastData(null);

    try {
      const res = await fetch(`/api/wards/${wardId}/forecast?days=5`);

      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? 'Ward not found.'
            : `Forecast API failed (status ${res.status}).`
        );
      }

      const data = await res.json();
      setForecastData(data);
      setSelectedDayIdx(0);
    } catch (err) {
      setError(err.message || 'Could not reach the forecast API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWardId) {
      const timer = setTimeout(() => loadForecast(selectedWardId), 0);
      return () => clearTimeout(timer);
    }
  }, [selectedWardId, loadForecast]);

  // Build the "Now, Today, Tomorrow, Day3, Day4, Day5" chart series
  const chartData = useMemo(() => {
    const points = [];

    if (selectedWard?.current) {
      points.push({
        x: 'Now',
        current: selectedWard.current.final_risk_score ?? selectedWard.current.risk_score_raw,
        currentBand: selectedWard.current.final_risk_band || selectedWard.current.risk_band,
        forecast: null,
        wbgt: selectedWard.current.wbgt,
        utci: selectedWard.current.utci,
        heat_index: selectedWard.current.heat_index,
        finalScoreRaw: selectedWard.current.final_risk_score,
        timestamp: selectedWard.current.score_time
      });
    }

    (forecastData?.daily || []).forEach((day) => {
      const peak = day.peak_hour || {};
      points.push({
        x: day.label,
        current: null,
        forecast: peak.final_risk_score ?? peak.risk_score_raw,
        band: peak.final_risk_band || peak.risk_band,
        wbgt: peak.wbgt,
        utci: peak.utci,
        heat_index: peak.heat_index,
        finalScoreRaw: peak.final_risk_score,
        timestamp: peak.timestamp,
        dayIndex: forecastData.daily.indexOf(day)
      });
    });

    return points;
  }, [forecastData, selectedWard]);

  const selectedDayLabel = forecastData?.daily?.[selectedDayIdx]?.label;

  const hourlyForSelectedDay = useMemo(() => {
    if (!forecastData?.daily?.[selectedDayIdx]) return [];
    const targetDate = forecastData.daily[selectedDayIdx].date;
    return (forecastData.forecasts || []).filter(
      (f) => f.timestamp && f.timestamp.slice(0, 10) === targetDate
    );
  }, [forecastData, selectedDayIdx]);

  return (
    <div
      style={{
        width: 420,
        minWidth: 420,
        background: '#fff',
        borderLeft: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'sans-serif',
        overflowY: 'auto'
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 8 }}>
          Ward Forecast
        </div>

        {/* Ward selector */}
        <select
          value={selectedWardId || ''}
          onChange={(e) => onSelectWard(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 13
          }}
        >
          <option value="" disabled>
            Select a ward...
          </option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.city})
            </option>
          ))}
        </select>
      </div>

      <div style={{ padding: 16, flex: 1 }}>
        {!selectedWardId && (
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Pick a ward above, or click one on the map, to see its 5-day forecast.
          </div>
        )}

        {loading && (
          <div style={{ color: '#64748b', fontSize: 13 }}>Loading forecast…</div>
        )}

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 13
            }}
          >
            <strong>Forecast unavailable.</strong>
            <div style={{ marginTop: 4 }}>{error}</div>
            <button
              onClick={() => loadForecast(selectedWardId)}
              style={{
                marginTop: 8,
                padding: '6px 10px',
                fontSize: 12,
                border: 0,
                borderRadius: 4,
                background: '#991b1b',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && forecastData && forecastData.count === 0 && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 6,
              padding: '14px',
              fontSize: 13,
              color: '#64748b',
              textAlign: 'center'
            }}
          >
            No forecast data available for this ward yet. Run the ingestion
            pipeline to populate it.
          </div>
        )}

        {!loading && !error && forecastData && forecastData.count > 0 && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<ForecastTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />

                {/* risk-band reference bands, purely visual context */}
                <ReferenceArea y1={80} y2={100} fill={RISK_COLORS.extreme} fillOpacity={0.06} />
                <ReferenceArea y1={60} y2={80} fill={RISK_COLORS.high} fillOpacity={0.06} />
                <ReferenceArea y1={35} y2={60} fill={RISK_COLORS.moderate} fillOpacity={0.06} />
                <ReferenceArea y1={0} y2={35} fill={RISK_COLORS.low} fillOpacity={0.06} />

                <Line
                  type="monotone"
                  dataKey="current"
                  name="Current (actual)"
                  stroke="#1e293b"
                  strokeWidth={0}
                  dot={<BandDot dataKey="current" />}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast (peak hour/day)"
                  stroke="#334155"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={<BandDot dataKey="forecast" />}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Date selector: pick a forecast day to drill into hourly detail */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {(forecastData.daily || []).map((day, idx) => (
                <button
                  key={day.label}
                  onClick={() => setSelectedDayIdx(idx)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    border:
                      idx === selectedDayIdx
                        ? '2px solid #1e293b'
                        : '1px solid #cbd5e1',
                    background:
                      idx === selectedDayIdx ? '#1e293b' : '#fff',
                    color: idx === selectedDayIdx ? '#fff' : '#334155',
                    cursor: 'pointer'
                  }}
                >
                  {day.label}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      marginLeft: 6,
                      background: bandColor(
                        day.peak_hour?.final_risk_band || day.peak_hour?.risk_band
                      )
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Hourly / time selector for the chosen day */}
            {selectedDayLabel && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  {selectedDayLabel} — hourly detail ({hourlyForSelectedDay.length} readings)
                </div>

                {hourlyForSelectedDay.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    No hourly readings stored for this day.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      overflowX: 'auto',
                      paddingBottom: 6
                    }}
                  >
                    {hourlyForSelectedDay.map((hr) => (
                      <div
                        key={hr.id}
                        title={`${hr.risk_band} · WBGT ${hr.wbgt}°C`}
                        style={{
                          minWidth: 52,
                          textAlign: 'center',
                          fontSize: 10,
                          padding: '6px 4px',
                          borderRadius: 6,
                          background: bandColor(hr.final_risk_band || hr.risk_band) + '22',
                          border: `1px solid ${bandColor(hr.final_risk_band || hr.risk_band)}`
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {new Date(hr.timestamp).toLocaleTimeString(undefined, {
                            hour: '2-digit'
                          })}
                        </div>
                        <div>{hr.final_risk_score ?? hr.risk_score_raw}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}