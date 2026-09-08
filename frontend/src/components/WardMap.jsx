import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap
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
        vulnerability_score: 42.1
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.585, 12.975],
            [77.615, 12.975],
            [77.615, 12.995],
            [77.585, 12.995],
            [77.585, 12.975]
          ]
        ]
      }
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
        vulnerability_score: 24.39
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.610, 12.920],
            [77.640, 12.920],
            [77.640, 12.945],
            [77.610, 12.945],
            [77.610, 12.920]
          ]
        ]
      }
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
        vulnerability_score: 20.0
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.555, 12.990],
            [77.580, 12.990],
            [77.580, 13.015],
            [77.555, 13.015],
            [77.555, 12.990]
          ]
        ]
      }
    }
  ]
};
 
const getRiskColor = (riskBand) => {
  switch (riskBand?.toLowerCase()) {
    case 'low':
      return '#22c55e';
    case 'moderate':
      return '#eab308';
    case 'high':
      return '#f97316';
    case 'extreme':
      return '#ef4444';
    default:
      return '#9ca3af';
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
          maxZoom: 13
        });
      }
    }
  }, [geoData, map]);
 
  return null;
}
 
export default function WardMap({ onWardsReady, onWardSelect }) {
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
          setStatusMsg('Displaying live database wards.');
        } else {
          console.warn(
            'API returned empty features, using fallback dummy wards.'
          );
 
          setGeoData(DUMMY_WARDS_GEOJSON);
          setStatusMsg(
            'No live wards found. Displaying fallback demo data.'
          );
        }
      })
      .catch((err) => {
        console.warn(
          'Fetch failed, using fallback dummy wards:',
          err
        );
 
        setGeoData(DUMMY_WARDS_GEOJSON);
        setStatusMsg(
          'Backend unavailable. Displaying fallback demo data.'
        );
      });
  }, []);
 
  // Hand a flattened ward list (with each ward's "current" reading) up
  // to the parent so the ForecastPanel's ward selector and "Now" marker
  // can use it without a second fetch.
  useEffect(() => {
    if (!geoData || !onWardsReady) return;
 
    const list = geoData.features.map((f) => {
      const p = f.properties || {};
      return {
        id: p.id,
        name: p.name,
        city: p.city,
        current: {
          wbgt: p.wbgt,
          utci: p.utci,
          heat_index: p.heat_index,
          risk_band: p.risk_band,
          risk_score_raw: p.risk_score_raw,
          vulnerability_score: p.vulnerability_score,
          final_risk_score: p.final_risk_score,
          final_risk_band: p.final_risk_band,
          score_time: p.score_time
        }
      };
    });
 
    onWardsReady(list);
  }, [geoData, onWardsReady]);
 
  const loadForecast = async (wardId, layer) => {
    if (!wardId) {
      return;
    }
 
    /*
     * Save the current popup content before replacing it
     * temporarily with the forecast popup.
     */
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
        [wardId]: data
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
 
      /*
       * When the forecast popup is closed, restore the
       * original current-risk popup.
       */
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
      weight: 2,
      opacity: 1,
      color: '#ffffff',
      dashArray: '3',
      fillOpacity: 0.65
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
      score_time
    } = properties;
 
    layer._thermaSenseWardName =
      name || 'Unnamed Ward';
 
    const displayRiskBand =
      final_risk_band ||
      risk_band ||
      'unknown';
 
    const riskColor = getRiskColor(displayRiskBand);
 
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
              background: #1e293b;
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
 
    layer.on('click', () => {
      if (onWardSelect) {
        onWardSelect(id);
      }
    });
 
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        flex: 1,
        minWidth: 0
      }}
    >
      <header
        style={{
          padding: '12px 20px',
          backgroundColor: '#1e293b',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1.25rem'
          }}
        >
          ThermaSense — Ward Heat Risk Dashboard
        </h2>
 
        <span
          style={{
            fontSize: '0.85rem',
            color: '#94a3b8'
          }}
        >
          {statusMsg}
        </span>
      </header>
 
      <div
        style={{
          flex: 1,
          position: 'relative'
        }}
      >
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{
            height: '100%',
            width: '100%'
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
 
              {/*
               * Wards with no boundary polygon yet (geometry === null)
               * still have a centroid, so show their current risk as a
               * colored circle marker instead of leaving them invisible.
               */}
              {geoData.features
                .filter((f) => !f.geometry)
                .map((f) => {
                  const p = f.properties || {};
                  if (
                    p.centroid_lat === null ||
                    p.centroid_lat === undefined ||
                    p.centroid_lon === null ||
                    p.centroid_lon === undefined
                  ) {
                    return null;
                  }
 
                  const band = p.final_risk_band || p.risk_band || 'unknown';
 
                  return (
                    <CircleMarker
                      key={`point-${p.id}`}
                      center={[p.centroid_lat, p.centroid_lon]}
                      radius={12}
                      pathOptions={{
                        fillColor: getRiskColor(band),
                        color: '#ffffff',
                        weight: 2,
                        fillOpacity: 0.85
                      }}
                      eventHandlers={{
                        click: () => {
                          if (onWardSelect) {
                            onWardSelect(p.id);
                          }
                        }
                      }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'sans-serif', minWidth: 180 }}>
                          <strong>{p.name || 'Unnamed Ward'}</strong>
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            WBGT: {p.wbgt ?? 'N/A'}°C<br />
                            UTCI: {p.utci ?? 'N/A'}°C<br />
                            Heat Index: {p.heat_index ?? 'N/A'}°C<br />
                            Final Risk Score: {p.final_risk_score ?? 'N/A'}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 6,
                              padding: '2px 8px',
                              borderRadius: 4,
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: 11,
                              textTransform: 'uppercase',
                              backgroundColor: getRiskColor(band)
                            }}
                          >
                            {band}
                          </span>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
            </>
          )}
        </MapContainer>
 
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            backgroundColor:
              'rgba(255, 255, 255, 0.95)',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow:
              '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            fontFamily: 'sans-serif',
            fontSize: '12px'
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#1e293b'
            }}
          >
            Heat Risk Band
          </div>
 
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#ef4444',
                  borderRadius: '3px'
                }}
              />
              Extreme
            </div>
 
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#f97316',
                  borderRadius: '3px'
                }}
              />
              High
            </div>
 
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#eab308',
                  borderRadius: '3px'
                }}
              />
              Moderate
            </div>
 
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#22c55e',
                  borderRadius: '3px'
                }}
              />
              Low
            </div>
 
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#9ca3af',
                  borderRadius: '3px'
                }}
              />
              Unknown
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}