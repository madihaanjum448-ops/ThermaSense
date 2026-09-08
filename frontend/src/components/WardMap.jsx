import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from 'react-leaflet';

const DUMMY_WARDS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 1,
        name: 'Shivajinagar (Central)',
        wbgt: 33.4,
        utci: 39.8,
        risk_band: 'extreme',
        final_risk_band: 'extreme',
        final_risk_score: 85.2,
        vulnerability_score: 42.1,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.585, 12.975],
          [77.615, 12.975],
          [77.615, 12.995],
          [77.585, 12.995],
          [77.585, 12.975],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 2,
        name: 'Koramangala (South-East)',
        wbgt: 30.8,
        utci: 35.2,
        risk_band: 'high',
        final_risk_band: 'high',
        final_risk_score: 61.393,
        vulnerability_score: 24.39,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.610, 12.920],
          [77.640, 12.920],
          [77.640, 12.945],
          [77.610, 12.945],
          [77.610, 12.920],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 3,
        name: 'Malleshwaram (North-West)',
        wbgt: 27.5,
        utci: 31.0,
        risk_band: 'moderate',
        final_risk_band: 'moderate',
        final_risk_score: 38.5,
        vulnerability_score: 20.0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.555, 12.990],
          [77.580, 12.990],
          [77.580, 13.015],
          [77.555, 13.015],
          [77.555, 12.990],
        ]],
      },
    },
  ],
};

const getRiskColor = (riskBand) => {
  switch (riskBand?.toLowerCase()) {
    case 'low':
      return '#5f806d';
    case 'moderate':
      return '#b88945';
    case 'high':
      return '#c9633f';
    case 'extreme':
      return '#963d2f';
    default:
      return '#8b8982';
  }
};

function FitMapToGeoJSON({ geoData }) {
  const map = useMap();

  useEffect(() => {
    if (
      geoData &&
      geoData.features &&
      geoData.features.length > 0
    ) {
      const geoJsonLayer = new window.L.GeoJSON(geoData);
      const bounds = geoJsonLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 13,
        });
      }
    }
  }, [geoData, map]);

  return null;
}

export default function WardMap({ onWardSelect }) {
  const [geoData, setGeoData] = useState(null);
  const [statusMsg, setStatusMsg] = useState(
    'Loading ward risk data...'
  );

  const [forecastByWard, setForecastByWard] = useState({});
  const [forecastLoadingWard, setForecastLoadingWard] =
    useState(null);

  useEffect(() => {
    fetch('/api/wards/geojson')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        if (
          data &&
          data.features &&
          data.features.length > 0
        ) {
          setGeoData(data);
          setStatusMsg('LIVE • Database wards');
        } else {
          console.warn(
            'API returned empty features, using fallback dummy wards.'
          );

          setGeoData(DUMMY_WARDS_GEOJSON);
          setStatusMsg('DEMO DATA • No live wards found');
        }
      })
      .catch((err) => {
        console.warn(
          'Fetch failed, using fallback dummy wards:',
          err
        );

        setGeoData(DUMMY_WARDS_GEOJSON);
        setStatusMsg('DEMO DATA • Backend unavailable');
      });
  }, []);

  const loadForecast = async (wardId, layer) => {
    if (!wardId) {
      return;
    }

    const currentPopupContent =
      layer.getPopup()?.getContent();

    setForecastLoadingWard(wardId);

    try {
      const response = await fetch(
        `/api/wards/${wardId}/forecast`
      );

      if (!response.ok) {
        throw new Error(
          `Forecast server returned ${response.status}`
        );
      }

      const data = await response.json();

      setForecastByWard((previous) => ({
        ...previous,
        [wardId]: data,
      }));

      const forecastRows = data?.forecasts || [];

      if (forecastRows.length === 0) {
        layer.bindPopup(`
          <div style="
            font-family: sans-serif;
            min-width: 220px;
          ">
            <strong>
              No future forecast data available.
            </strong>
          </div>
        `);

        layer.openPopup();

        layer.once('popupclose', () => {
          if (currentPopupContent) {
            layer.bindPopup(currentPopupContent);
          }
        });

        return;
      }

      const forecastHtml = forecastRows
        .slice(0, 6)
        .map((forecast) => {
          const time = forecast.score_time
            ? new Date(
                forecast.score_time
              ).toLocaleString()
            : 'Unknown time';

          const riskBand =
            forecast.final_risk_band ||
            forecast.risk_band ||
            'unknown';

          const riskColor = getRiskColor(riskBand);

          return `
            <div style="
              border-top: 1px solid #ddd;
              padding: 7px 0;
              margin-top: 5px;
            ">
              <div style="
                font-size: 11px;
                color: #666;
                margin-bottom: 3px;
              ">
                ${time}
              </div>

              <div style="font-size: 12px;">
                <strong>WBGT:</strong>
                ${
                  forecast.wbgt !== null &&
                  forecast.wbgt !== undefined
                    ? `${forecast.wbgt}°C`
                    : 'N/A'
                }
              </div>

              <div style="font-size: 12px;">
                <strong>UTCI:</strong>
                ${
                  forecast.utci !== null &&
                  forecast.utci !== undefined
                    ? `${forecast.utci}°C`
                    : 'N/A'
                }
              </div>

              <div style="font-size: 12px;">
                <strong>Heat Index:</strong>
                ${
                  forecast.heat_index !== null &&
                  forecast.heat_index !== undefined
                    ? `${forecast.heat_index}°C`
                    : 'N/A'
                }
              </div>

              <div style="margin-top: 3px;">
                <strong style="font-size: 12px;">
                  Risk:
                </strong>

                <span style="
                  display: inline-block;
                  margin-left: 4px;
                  padding: 2px 6px;
                  border-radius: 4px;
                  color: #fff;
                  background-color: ${riskColor};
                  font-size: 11px;
                  font-weight: bold;
                  text-transform: uppercase;
                ">
                  ${riskBand}
                </span>
              </div>

              <div style="font-size: 12px;">
                <strong>Risk Score:</strong>
                ${
                  forecast.final_risk_score ??
                  forecast.risk_score_raw ??
                  'N/A'
                }
              </div>
            </div>
          `;
        })
        .join('');

      const remaining =
        forecastRows.length > 6
          ? `
            <div style="
              font-size: 11px;
              color: #777;
              margin-top: 6px;
            ">
              Showing next 6 of
              ${forecastRows.length}
              forecast points.
            </div>
          `
          : '';

      layer.bindPopup(`
        <div style="
          font-family: sans-serif;
          min-width: 250px;
          max-width: 320px;
          line-height: 1.4;
        ">
          <h4 style="
            margin: 0 0 8px 0;
            font-size: 15px;
            color: #111;
          ">
            ${layer._thermaSenseWardName || 'Ward'}
            — Forecast
          </h4>

          ${forecastHtml}

          ${remaining}
        </div>
      `);

      layer.once('popupclose', () => {
        if (currentPopupContent) {
          layer.bindPopup(currentPopupContent);
        }
      });

      layer.openPopup();
    } catch (error) {
      console.warn(
        `Failed to load forecast for ward ${wardId}:`,
        error
      );

      layer.bindPopup(`
        <div style="
          font-family: sans-serif;
          min-width: 220px;
          color: #991b1b;
        ">
          <strong>Forecast unavailable</strong>

          <p style="
            margin: 6px 0 0 0;
            font-size: 12px;
          ">
            Could not load forecast data for this ward.
          </p>
        </div>
      `);

      layer.once('popupclose', () => {
        if (currentPopupContent) {
          layer.bindPopup(currentPopupContent);
        }
      });

      layer.openPopup();
    } finally {
      setForecastLoadingWard(null);
    }
  };

  const styleFeature = (feature) => {
    const properties = feature.properties || {};

    const riskBand =
      properties.final_risk_band ||
      properties.risk_band ||
      'unknown';

    return {
      fillColor: getRiskColor(riskBand),
      weight: 1.5,
      opacity: 1,
      color: '#f8f4ec',
      fillOpacity: 0.62,
    };
  };

  const onEachFeature = (feature, layer) => {
    const properties = feature.properties || {};

    const {
      id,
      name,
      wbgt,
      utci,
      heat_index,
      risk_band,
      risk_score_raw,
      vulnerability_score,
      final_risk_score,
      final_risk_band,
      score_time,
    } = properties;

    layer._thermaSenseWardName =
      name || 'Unnamed Ward';

    const displayRiskBand =
      final_risk_band ||
      risk_band ||
      'unknown';

    const riskColor = getRiskColor(displayRiskBand);

    const selectedWard = {
      id,
      name: name || 'Unnamed Ward',
      wbgt,
      utci,
      heat_index,
      risk_band,
      risk_score_raw,
      vulnerability_score,
      final_risk_score,
      final_risk_band,
      score_time,
    };

    layer.on('click', () => {
      if (onWardSelect) {
        onWardSelect(selectedWard);
      }
    });

    const forecastButtonId =
      `forecast-button-${id}`;

    const popupContent = `
      <div style="
        font-family: sans-serif;
        min-width: 230px;
        line-height: 1.4;
      ">
        <h4 style="
          margin: 0 0 8px 0;
          font-size: 15px;
          color: #111;
        ">
          ${name || 'Unnamed Ward'}
        </h4>

        <div style="
          font-size: 13px;
          color: #444;
        ">
          <p style="margin: 3px 0;">
            <strong>WBGT:</strong>
            ${
              wbgt !== null &&
              wbgt !== undefined
                ? `${wbgt}°C`
                : 'N/A'
            }
          </p>

          <p style="margin: 3px 0;">
            <strong>UTCI:</strong>
            ${
              utci !== null &&
              utci !== undefined
                ? `${utci}°C`
                : 'N/A'
            }
          </p>

          <p style="margin: 3px 0;">
            <strong>Heat Index:</strong>
            ${
              heat_index !== null &&
              heat_index !== undefined
                ? `${heat_index}°C`
                : 'N/A'
            }
          </p>

          <hr style="
            border: 0;
            border-top: 1px solid #ddd;
            margin: 8px 0;
          " />

          <p style="margin: 3px 0;">
            <strong>Thermal Risk:</strong>
            ${
              risk_score_raw !== null &&
              risk_score_raw !== undefined
                ? risk_score_raw
                : 'N/A'
            }
          </p>

          <p style="margin: 3px 0;">
            <strong>Vulnerability:</strong>
            ${
              vulnerability_score !== null &&
              vulnerability_score !== undefined
                ? vulnerability_score
                : 'N/A'
            }
          </p>

          <p style="margin: 3px 0;">
            <strong>Final Risk Score:</strong>
            ${
              final_risk_score !== null &&
              final_risk_score !== undefined
                ? final_risk_score
                : 'N/A'
            }
          </p>

          <p style="margin: 6px 0 0 0;">
            <strong>Final Risk Band:</strong>

            <span style="
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-weight: bold;
              text-transform: uppercase;
              color: #fff;
              background-color: ${riskColor};
            ">
              ${displayRiskBand}
            </span>
          </p>

          ${
            score_time
              ? `
                <p style="
                  margin: 8px 0 0 0;
                  font-size: 11px;
                  color: #777;
                ">
                  Updated: ${score_time}
                </p>
              `
              : ''
          }

          <button
            id="${forecastButtonId}"
            style="
              width: 100%;
              margin-top: 12px;
              padding: 8px 10px;
              border: 0;
              border-radius: 5px;
              background: #814330;
              color: white;
              cursor: pointer;
              font-size: 12px;
              font-weight: 600;
            "
          >
            ${
              forecastLoadingWard === id
                ? 'Loading forecast...'
                : 'View Forecast'
            }
          </button>

          ${
            forecastByWard[id]
              ? `
                <p style="
                  margin: 6px 0 0 0;
                  font-size: 10px;
                  color: #777;
                  text-align: center;
                ">
                  Forecast loaded:
                  ${
                    forecastByWard[id].count || 0
                  }
                  points
                </p>
              `
              : ''
          }
        </div>
      </div>
    `;

    layer.bindPopup(popupContent);

    layer.on('popupopen', () => {
      const button = document.getElementById(
        forecastButtonId
      );

      if (button) {
        button.onclick = () => {
          loadForecast(id, layer);
        };
      }
    });
  };

  return (
    <div
      className="thermasense-map-shell"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '520px',
      }}
    >
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{
          height: '100%',
          width: '100%',
          minHeight: '520px',
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geoData && (
          <>
            <FitMapToGeoJSON
              geoData={geoData}
            />

            <GeoJSON
              key={JSON.stringify(geoData)}
              data={geoData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          </>
        )}
      </MapContainer>

      <div
        style={{
          position: 'absolute',
          top: '18px',
          left: '18px',
          zIndex: 1000,
          padding: '8px 12px',
          background: 'rgba(250, 247, 241, 0.94)',
          border: '1px solid rgba(23, 23, 20, 0.12)',
          fontFamily: 'monospace',
          fontSize: '10px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#3f3d38',
        }}
      >
        {statusMsg}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '18px',
          right: '18px',
          zIndex: 1000,
          background: 'rgba(250, 247, 241, 0.96)',
          border: '1px solid rgba(23, 23, 20, 0.12)',
          padding: '12px 14px',
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: '#282621',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '9px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '9px',
            color: '#706e67',
          }}
        >
          Thermal risk
        </div>

        {[
          ['extreme', 'Extreme'],
          ['high', 'High'],
          ['moderate', 'Moderate'],
          ['low', 'Low'],
          ['unknown', 'Unknown'],
        ].map(([band, label]) => (
          <div
            key={band}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              marginBottom: '5px',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                display: 'inline-block',
                background: getRiskColor(band),
              }}
            />

            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}