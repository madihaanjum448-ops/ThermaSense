/**
 * api.js — Frontend API client for ThermaSense backend.
 */

export async function fetchWardsGeoJSON() {
  try {
    const res = await fetch('/api/wards/geojson');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Live wards geojson fetch failed:', err);
    return null;
  }
}

export async function fetchWardForecast(wardId) {
  try {
    const res = await fetch(`/api/wards/${wardId}/forecast`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.forecasts || [];
  } catch (err) {
    console.warn(`Forecast fetch failed for ward ${wardId}:`, err);
    return null;
  }
}

export async function fetchDataSourcesStatus() {
  try {
    const res = await fetch('/api/wards/data-sources');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.data_sources || [];
  } catch (err) {
    console.warn('Data sources status fetch failed:', err);
    return null;
  }
}

export async function fetchZoneSummary() {
  try {
    const res = await fetch('/api/wards/summary');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Zone summary fetch failed:', err);
    return null;
  }
}
