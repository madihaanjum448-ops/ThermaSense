import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';

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
        risk_band: 'extreme'
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
        risk_band: 'high'
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
        risk_band: 'moderate'
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
      return '#22c55e'; // green
    case 'moderate':
      return '#eab308'; // yellow
    case 'high':
      return '#f97316'; // orange
    case 'extreme':
      return '#ef4444'; // red
    default:
      return '#9ca3af'; // grey / unknown
  }
};

export default function WardMap() {
  const [geoData, setGeoData] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Loading ward risk data...');

  useEffect(() => {
    fetch('/api/wards/geojson')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.features && data.features.length > 0) {
          setGeoData(data);
          setStatusMsg('Displaying live database wards.');
        } else {
          console.warn('API returned empty features, using fallback dummy wards.');
          setGeoData(DUMMY_WARDS_GEOJSON);
          setStatusMsg('No live wards found. Displaying fallback demo data.');
        }
      })
      .catch((err) => {
        console.warn('Fetch failed, using fallback dummy wards:', err);
        setGeoData(DUMMY_WARDS_GEOJSON);
        setStatusMsg('Backend unavailable. Displaying fallback demo data.');
      });
  }, []);

  const styleFeature = (feature) => {
    const riskBand = feature.properties?.risk_band;
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
    const { name, wbgt, utci, risk_band } = feature.properties || {};
    const riskColor = getRiskColor(risk_band);

    const popupContent = `
      <div style="font-family: sans-serif; min-width: 170px; line-height: 1.4;">
        <h4 style="margin: 0 0 6px 0; font-size: 15px; color: #111;">${name || 'Unnamed Ward'}</h4>
        <div style="font-size: 13px; color: #444;">
          <p style="margin: 3px 0;"><strong>WBGT:</strong> ${wbgt !== null && wbgt !== undefined ? `${wbgt}°C` : 'N/A'}</p>
          <p style="margin: 3px 0;"><strong>UTCI:</strong> ${utci !== null && utci !== undefined ? `${utci}°C` : 'N/A'}</p>
          <p style="margin: 6px 0 0 0;">
            <strong>Risk Band:</strong> 
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; color: #fff; background-color: ${riskColor};">
              ${risk_band || 'unknown'}
            </span>
          </p>
        </div>
      </div>
    `;

    layer.bindPopup(popupContent);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <header style={{
        padding: '12px 20px',
        backgroundColor: '#1e293b',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>ThermaSense — Ward Heat Risk Dashboard</h2>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{statusMsg}</span>
      </header>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[12.9716, 77.5946]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <GeoJSON
              key={JSON.stringify(geoData)}
              data={geoData}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          fontFamily: 'sans-serif',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>Heat Risk Band</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', backgroundColor: '#ef4444', borderRadius: '3px' }}></span> Extreme
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', backgroundColor: '#f97316', borderRadius: '3px' }}></span> High
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', backgroundColor: '#eab308', borderRadius: '3px' }}></span> Moderate
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', backgroundColor: '#22c55e', borderRadius: '3px' }}></span> Low
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', backgroundColor: '#9ca3af', borderRadius: '3px' }}></span> Unknown
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
