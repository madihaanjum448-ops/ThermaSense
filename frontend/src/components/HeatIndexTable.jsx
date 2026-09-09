import React from 'react';
import { Info } from 'lucide-react';

const TEMPERATURES = [26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46];
const HUMIDITIES = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

// Exact JS port of NOAA Rothfusz regression equation
function calculateHeatIndexC(tempC, rh) {
  const T = (tempC * 9.0) / 5.0 + 32.0;
  const R = rh;
  const hiSimple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + R * 0.094);
  let hiF;

  if ((hiSimple + T) / 2.0 < 80.0) {
    hiF = (hiSimple + T) / 2.0;
  } else {
    hiF =
      -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      0.00683783 * T * T -
      0.05481717 * R * R +
      0.00122874 * T * T * R +
      0.00085282 * T * R * R -
      0.00000199 * T * T * R * R;

    if (R < 13 && T >= 80.0 && T <= 112.0) {
      hiF -= ((13.0 - R) / 4.0) * Math.sqrt((17.0 - Math.abs(T - 95.0)) / 17.0);
    } else if (R > 85 && T >= 80.0 && T <= 87.0) {
      hiF += ((R - 85.0) / 10.0) * ((87.0 - T) / 5.0);
    }
  }

  const hiC = ((hiF - 32.0) * 5.0) / 9.0;
  return Math.round(hiC);
}

function getHeatIndexCellStyle(hi) {
  if (hi < 32) {
    return {
      bg: '#e8f5e9',
      color: '#1b5e20',
      border: '#c8e6c9',
      category: 'Caution',
    };
  } else if (hi < 39) {
    return {
      bg: '#fff3e0',
      color: '#e65100',
      border: '#ffe0b2',
      category: 'Extreme Caution',
    };
  } else if (hi < 46) {
    return {
      bg: '#ffebee',
      color: '#c62828',
      border: '#ffcdd2',
      category: 'Danger',
    };
  } else {
    return {
      bg: '#fce7f3',
      color: '#881337',
      border: '#fbcfe8',
      category: 'Extreme Danger',
    };
  }
}

export default function HeatIndexTable() {
  return (
    <div className="heat-index-table-section">
      <div className="map-section-header">
        <div className="header-badge-row">
          <span className="gov-section-pill">REFERENCE METRIC</span>
          <span className="source-tag">NOAA Rothfusz Standard</span>
        </div>
        <h3 className="section-main-heading">Heat Index Reference Chart</h3>
        <p className="section-lead-text">
          The Heat Index measures how hot it actually feels outside when humidity is factored in with air temperature.
        </p>
      </div>

      <div className="heat-index-table-card">
        {/* Scrollable Table Container */}
        <div className="heat-index-scroll-wrapper">
          <table className="heat-index-grid-table">
            <thead>
              <tr>
                <th className="corner-header-cell">
                  <span className="th-sub">RH (%) ↓</span>
                  <span className="th-main">Temp (°C) →</span>
                </th>
                {TEMPERATURES.map((temp) => (
                  <th key={temp} className="temp-col-header">
                    {temp}°C
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HUMIDITIES.map((rh) => (
                <tr key={rh}>
                  <th className="humidity-row-header">{rh}%</th>
                  {TEMPERATURES.map((temp) => {
                    const hi = calculateHeatIndexC(temp, rh);
                    const style = getHeatIndexCellStyle(hi);

                    return (
                      <td
                        key={`${temp}-${rh}`}
                        className="heat-index-cell"
                        style={{
                          backgroundColor: style.bg,
                          color: style.color,
                          borderColor: style.border,
                        }}
                        title={`Air Temp: ${temp}°C | Humidity: ${rh}% → Heat Index: ${hi}°C (${style.category})`}
                      >
                        {hi}°
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend for Heat Index Categories */}
        <div className="hi-categories-legend">
          <div className="hi-legend-item">
            <span className="hi-swatch" style={{ backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7' }}></span>
            <div className="hi-legend-text">
              <strong>Caution (&lt; 32°C)</strong>
              <span>Fatigue possible with prolonged exposure</span>
            </div>
          </div>

          <div className="hi-legend-item">
            <span className="hi-swatch" style={{ backgroundColor: '#fff3e0', border: '1px solid #ffcc80' }}></span>
            <div className="hi-legend-text">
              <strong>Extreme Caution (32°C – 39°C)</strong>
              <span>Heat cramps & heat exhaustion possible</span>
            </div>
          </div>

          <div className="hi-legend-item">
            <span className="hi-swatch" style={{ backgroundColor: '#ffebee', border: '1px solid #ef9a9a' }}></span>
            <div className="hi-legend-text">
              <strong>Danger (39°C – 46°C)</strong>
              <span>Heat cramps likely; heat exhaustion likely</span>
            </div>
          </div>

          <div className="hi-legend-item">
            <span className="hi-swatch" style={{ backgroundColor: '#fce7f3', border: '1px solid #f472b6' }}></span>
            <div className="hi-legend-text">
              <strong>Extreme Danger (&gt; 46°C)</strong>
              <span>Heat stroke highly likely with continued exposure</span>
            </div>
          </div>
        </div>

        <div className="map-caption-note">
          <Info size={13} />
          <span>Calculated using the standard NOAA Rothfusz regression equation. Numbers represent apparent temperature in shade with light wind.</span>
        </div>
      </div>
    </div>
  );
}
