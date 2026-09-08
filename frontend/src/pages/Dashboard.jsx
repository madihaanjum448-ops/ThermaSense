import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import emblem from '../assets/emblem.png';
import WardMap from '../components/WardMap';

function Dashboard() {
  const [selectedWard, setSelectedWard] = useState(null);
  const [wards, setWards] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(false);
  const [dataStatus, setDataStatus] = useState('CHECKING DATA');

  useEffect(() => {
    const loadWards = async () => {
      try {
        const response = await fetch('/api/wards/geojson');

        if (!response.ok) {
          throw new Error('Ward API unavailable');
        }

        const data = await response.json();
        const features = Array.isArray(data?.features)
          ? data.features
          : [];

        setWards(features);
        setDataStatus(
          features.length > 0 ? 'LIVE DATA' : 'NO LIVE DATA'
        );
      } catch (error) {
        console.warn('Could not load ward data:', error);
        setWards([]);
        setDataStatus('NO LIVE DATA');
      }
    };

    loadWards();
  }, []);

  useEffect(() => {
    if (!selectedWard?.id) {
      setForecast([]);
      setForecastError(false);
      return;
    }

    const loadForecast = async () => {
      setForecastLoading(true);
      setForecastError(false);

      try {
        const response = await fetch(
          `/api/wards/${selectedWard.id}/forecast`
        );

        if (!response.ok) {
          throw new Error('Forecast unavailable');
        }

        const data = await response.json();

        const points =
          Array.isArray(data)
            ? data
            : Array.isArray(data?.forecast)
              ? data.forecast
              : Array.isArray(data?.data)
                ? data.data
                : [];

        setForecast(points);
      } catch (error) {
        console.warn('Could not load forecast:', error);
        setForecast([]);
        setForecastError(true);
      } finally {
        setForecastLoading(false);
      }
    };

    loadForecast();
  }, [selectedWard]);

  const riskScore =
    selectedWard?.final_risk_score ??
    selectedWard?.risk_score_raw ??
    null;

  const riskBand =
    selectedWard?.final_risk_band ??
    selectedWard?.risk_band ??
    null;

  const formattedRiskScore =
    typeof riskScore === 'number'
      ? riskScore.toFixed(1)
      : '—';

  const activeAlerts = '—';

  const rankedWards = useMemo(() => {
    return wards
      .map((feature) => {
        const p = feature?.properties || {};

        const score =
          p.final_risk_score ??
          p.risk_score_raw ??
          null;

        return {
          id: p.id,
          name: p.name || 'Unnamed Ward',
          score:
            typeof score === 'number'
              ? score
              : Number(score),
          band:
            p.final_risk_band ??
            p.risk_band ??
            null,
        };
      })
      .filter((ward) => Number.isFinite(ward.score))
      .sort((a, b) => b.score - a.score);
  }, [wards]);

  const formatNumber = (value, suffix = '') => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return '—';
    }

    return `${number.toFixed(1)}${suffix}`;
  };

  const getForecastValue = (point, keys) => {
    for (const key of keys) {
      if (
        point &&
        point[key] !== undefined &&
        point[key] !== null
      ) {
        return point[key];
      }
    }

    return null;
  };

  return (
    <div className="dashboard-page">

      {/* =====================================================
          GOVERNMENT / ACCESSIBILITY BAR
      ====================================================== */}

      <div className="gov-strip">
        <div className="gov-strip-inner">

          <div className="gov-identity">
            <span>Government of India</span>
            <span className="gov-divider">|</span>
            <span>भारत सरकार</span>
          </div>

          <div className="accessibility-links">
            <a href="#dashboard-main">
              Skip to main content
            </a>

            <span>English</span>
            <span>हिंदी</span>

            <button type="button">A-</button>
            <button type="button">A</button>
            <button type="button">A+</button>
          </div>

        </div>
      </div>


      {/* =====================================================
          DASHBOARD HEADER
      ====================================================== */}

      <header className="dashboard-site-header">

        <div className="dashboard-site-header-inner">

          <Link to="/" className="dashboard-site-brand">

            <div className="dashboard-emblem">
              <img
                src={emblem}
                alt="Indian National Emblem"
              />
            </div>

            <div>
              <div className="dashboard-brand-name">
                ThermaSense
              </div>

              <div className="dashboard-brand-subtitle">
                National Heat Stress Early Warning System
              </div>
            </div>

          </Link>


          <nav className="dashboard-navigation">

            <Link
              to="/dashboard"
              className="dashboard-nav-link active"
            >
              Dashboard
            </Link>

            <a href="#ward-map" className="dashboard-nav-link">
              Ward map
            </a>

            <a href="#forecast" className="dashboard-nav-link">
              Forecast
            </a>

            <a
              href="#vulnerability"
              className="dashboard-nav-link"
            >
              Vulnerability
            </a>

            <a href="#alerts" className="dashboard-nav-link">
              Alerts and dispatch
            </a>

            <a href="#reports" className="dashboard-nav-link">
              Reports
            </a>

          </nav>


          <Link to="/" className="dashboard-public-link">
            Public Portal →
          </Link>

        </div>

      </header>


      {/* =====================================================
          MAIN
      ====================================================== */}

      <main
        id="dashboard-main"
        className="dashboard-main"
      >

        {/* ===================================================
            DASHBOARD INTRO
        ==================================================== */}

        <section className="dashboard-overview-header">

          <div>

            <div className="dashboard-breadcrumb">
              Dashboard / Zone overview
            </div>

            <h1>
              Urban Heat Risk
            </h1>

            <p>
              Ward-level thermal conditions, vulnerability,
              forecast risk and early-warning intelligence.
            </p>

          </div>


          <div className="dashboard-data-status">

            <span
              className={
                dataStatus === 'LIVE DATA'
                  ? 'status-live-dot'
                  : 'status-neutral-dot'
              }
            />

            <div>
              <strong>{dataStatus}</strong>
              <small>
                Values are sourced from the connected data system.
              </small>
            </div>

          </div>

        </section>


        {/* ===================================================
            WARD SELECTOR
        ==================================================== */}

        <section className="dashboard-control-bar">

          <div className="dashboard-control">

            <label htmlFor="ward-display">
              SELECTED WARD
            </label>

            <div
              id="ward-display"
              className="ward-selector-display"
            >
              {selectedWard?.name || 'Select a ward on the map'}
            </div>

          </div>


          <div className="dashboard-control-meta">

            <span>
              DATA STATUS
            </span>

            <strong>
              {dataStatus}
            </strong>

          </div>

        </section>


        {/* ===================================================
            KEY THERMAL INDICATORS
        ==================================================== */}

        <section className="dashboard-metrics-section">

          <div className="dashboard-section-heading">

            <div>
              <span>01</span>
              <h2>Thermal indicators</h2>
            </div>

            <p>
              Current values for the selected ward.
            </p>

          </div>


          <div className="dashboard-metrics-grid">

            <article className="dashboard-metric-card risk-card">

              <span>FINAL RISK SCORE</span>

              <strong>
                {formattedRiskScore}
              </strong>

              <small>
                {riskBand
                  ? String(riskBand).toUpperCase()
                  : '—'}
              </small>

            </article>


            <article className="dashboard-metric-card">

              <span>WBGT</span>

              <strong>
                {formatNumber(
                  selectedWard?.wbgt,
                  '°C'
                )}
              </strong>

              <small>
                WET BULB GLOBE TEMPERATURE
              </small>

            </article>


            <article className="dashboard-metric-card">

              <span>UTCI</span>

              <strong>
                {formatNumber(
                  selectedWard?.utci,
                  '°C'
                )}
              </strong>

              <small>
                UNIVERSAL THERMAL CLIMATE INDEX
              </small>

            </article>


            <article className="dashboard-metric-card">

              <span>HEAT INDEX</span>

              <strong>
                {formatNumber(
                  selectedWard?.heat_index,
                  '°C'
                )}
              </strong>

              <small>
                APPARENT TEMPERATURE
              </small>

            </article>


            <article className="dashboard-metric-card alert-card">

              <span>ACTIVE ALERTS</span>

              <strong>
                {activeAlerts}
              </strong>

              <small>
                CURRENT DISPATCH STATUS
              </small>

            </article>

          </div>

        </section>


        {/* ===================================================
            GIS MAP
        ==================================================== */}

        <section
          id="ward-map"
          className="dashboard-map-section-full"
        >

          <div className="dashboard-section-heading">

            <div>
              <span>02</span>
              <h2>Ward-level thermal risk</h2>
            </div>

            <p>
              GIS view of available ward-level risk assessments.
            </p>

          </div>


          <div className="dashboard-map-card">

            <div className="dashboard-map-toolbar">

              <div>
                <strong>THERMAL RISK MAP</strong>
                <span>
                  Select a ward to inspect details
                </span>
              </div>

              <div className="dashboard-layer-controls">

                <button
                  type="button"
                  className="map-layer-button active"
                >
                  WBGT layer
                </button>

                <button
                  type="button"
                  className="map-layer-button"
                >
                  Vulnerability layer
                </button>

              </div>

            </div>


            <div className="dashboard-map">

              <WardMap
                onWardSelect={setSelectedWard}
              />

            </div>

          </div>


          {/* Ward ranking strip */}

          <div className="dashboard-ward-list">

            <div className="ward-list-header">

              <strong>
                WARD RISK OVERVIEW
              </strong>

              <span>
                {rankedWards.length > 0
                  ? `${rankedWards.length} wards available`
                  : 'NO LIVE DATA'}
              </span>

            </div>


            {rankedWards.length > 0 ? (
              rankedWards.slice(0, 5).map((ward, index) => (
                <button
                  type="button"
                  key={ward.id ?? ward.name}
                  className="ward-list-row"
                  onClick={() => {
                    const feature = wards.find(
                      (item) =>
                        item?.properties?.id === ward.id
                    );

                    if (feature?.properties) {
                      setSelectedWard({
                        id: feature.properties.id,
                        name:
                          feature.properties.name ||
                          'Unnamed Ward',
                        wbgt: feature.properties.wbgt,
                        utci: feature.properties.utci,
                        heat_index:
                          feature.properties.heat_index,
                        risk_band:
                          feature.properties.risk_band,
                        risk_score_raw:
                          feature.properties.risk_score_raw,
                        vulnerability_score:
                          feature.properties.vulnerability_score,
                        final_risk_score:
                          feature.properties.final_risk_score,
                        final_risk_band:
                          feature.properties.final_risk_band,
                        score_time:
                          feature.properties.score_time,
                      });
                    }
                  }}
                >

                  <span className="ward-rank">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <strong>
                    {ward.name}
                  </strong>

                  <span className="ward-band">
                    {ward.band
                      ? String(ward.band).toUpperCase()
                      : '—'}
                  </span>

                  <b>
                    {ward.score.toFixed(1)}
                  </b>

                  <span className="ward-arrow">
                    →
                  </span>

                </button>
              ))
            ) : (
              <div className="no-data-row">
                No live ward ranking data available.
              </div>
            )}

          </div>

        </section>


        {/* ===================================================
            SELECTED WARD DETAILS
        ==================================================== */}

        <section className="selected-ward-details">

          <div className="dashboard-section-heading">

            <div>
              <span>03</span>

              <h2>
                {selectedWard?.name || 'Selected ward'}
              </h2>
            </div>

            <p>
              Ward-level environmental and vulnerability signals.
            </p>

          </div>


          <div className="selected-ward-columns">


            {/* Environmental inputs */}

            <article className="detail-panel">

              <div className="detail-panel-header">

                <div>
                  <span>INPUT DATA</span>
                  <strong>Environmental conditions</strong>
                </div>

                <small>
                  Current reading
                </small>

              </div>


              <div className="detail-data-grid">

                <div>
                  <span>DRY-BULB TEMPERATURE</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.temperature,
                      '°C'
                    )}
                  </strong>
                </div>

                <div>
                  <span>RELATIVE HUMIDITY</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.humidity,
                      '%'
                    )}
                  </strong>
                </div>

                <div>
                  <span>WIND SPEED</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.wind_speed,
                      ' m/s'
                    )}
                  </strong>
                </div>

                <div>
                  <span>SOLAR RADIATION</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.solar_radiation,
                      ' W/m²'
                    )}
                  </strong>
                </div>

              </div>

            </article>


            {/* Vulnerability */}

            <article
              id="vulnerability"
              className="detail-panel"
            >

              <div className="detail-panel-header">

                <div>
                  <span>VULNERABILITY</span>
                  <strong>Community signals</strong>
                </div>

                <small>
                  Ward profile
                </small>

              </div>


              <div className="detail-data-grid">

                <div>
                  <span>ELDERLY POPULATION</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.elderly_pct,
                      '%'
                    )}
                  </strong>
                </div>

                <div>
                  <span>OUTDOOR WORKER DENSITY</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.outdoor_worker_pct,
                      '%'
                    )}
                  </strong>
                </div>

                <div>
                  <span>INFORMAL HOUSING</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.slum_household_pct,
                      '%'
                    )}
                  </strong>
                </div>

                <div>
                  <span>GREEN COVER</span>
                  <strong>
                    {formatNumber(
                      selectedWard?.green_cover_pct,
                      '%'
                    )}
                  </strong>
                </div>

              </div>

            </article>

          </div>

        </section>


        {/* ===================================================
            FORECAST
        ==================================================== */}

        <section
          id="forecast"
          className="forecast-section"
        >

          <div className="dashboard-section-heading">

            <div>
              <span>04</span>
              <h2>Five-day forecast</h2>
            </div>

            <p>
              Forecast information for the selected ward.
            </p>

          </div>


          <div className="forecast-panel">

            {!selectedWard ? (
              <div className="forecast-empty">
                <strong>Select a ward to view its forecast.</strong>
                <span>
                  Forecast data will appear here when available.
                </span>
              </div>
            ) : forecastLoading ? (
              <div className="forecast-empty">
                <strong>Loading forecast...</strong>
                <span>
                  Retrieving forecast information for this ward.
                </span>
              </div>
            ) : forecastError ? (
              <div className="forecast-empty">
                <strong>Forecast unavailable</strong>
                <span>
                  No forecast data could be loaded for this ward.
                </span>
              </div>
            ) : forecast.length === 0 ? (
              <div className="forecast-empty">
                <strong>—</strong>
                <span>
                  No forecast data available.
                </span>
              </div>
            ) : (
              <div className="forecast-table">

                <div className="forecast-table-header">
                  <span>TIME</span>
                  <span>TEMPERATURE</span>
                  <span>WBGT</span>
                  <span>UTCI</span>
                  <span>HEAT INDEX</span>
                </div>

                {forecast.slice(0, 5).map((point, index) => {

                  const time =
                    getForecastValue(point, [
                      'time',
                      'timestamp',
                      'datetime',
                      'forecast_time',
                    ]);

                  const temperature =
                    getForecastValue(point, [
                      'temperature',
                      'temperature_2m',
                      'temp',
                    ]);

                  const wbgt =
                    getForecastValue(point, [
                      'wbgt',
                    ]);

                  const utci =
                    getForecastValue(point, [
                      'utci',
                    ]);

                  const heatIndex =
                    getForecastValue(point, [
                      'heat_index',
                      'heatIndex',
                    ]);

                  return (
                    <div
                      className="forecast-table-row"
                      key={`${time ?? 'point'}-${index}`}
                    >
                      <span>
                        {time || '—'}
                      </span>

                      <span>
                        {formatNumber(
                          temperature,
                          '°C'
                        )}
                      </span>

                      <span>
                        {formatNumber(
                          wbgt,
                          '°C'
                        )}
                      </span>

                      <span>
                        {formatNumber(
                          utci,
                          '°C'
                        )}
                      </span>

                      <span>
                        {formatNumber(
                          heatIndex,
                          '°C'
                        )}
                      </span>
                    </div>
                  );
                })}

              </div>
            )}

          </div>

        </section>


        {/* ===================================================
            HEALTH IMPACT
        ==================================================== */}

        <section className="health-impact-section">

          <div>

            <div className="dashboard-section-heading">

              <div>
                <span>05</span>
                <h2>Predicted health impact</h2>
              </div>

              <p>
                Risk interpretation based on available thermal
                intelligence.
              </p>

            </div>

          </div>


          <div className="health-impact-card">

            <div className="health-impact-status">
              <span>
                CURRENT ASSESSMENT
              </span>

              <strong>
                {riskBand
                  ? String(riskBand).toUpperCase()
                  : '—'}
              </strong>
            </div>

            <p>
              {riskBand
                ? `The selected ward is currently classified in the ${String(
                    riskBand
                  ).toLowerCase()} thermal risk band.`
                : 'Select a ward with available risk data to view the current assessment.'}
            </p>

            <small>
              This platform provides risk intelligence and does not
              replace medical advice or emergency services.
            </small>

          </div>

        </section>


        {/* ===================================================
            ALERTS AND DISPATCH
        ==================================================== */}

        <section
          id="alerts"
          className="dispatch-section"
        >

          <div className="dashboard-section-heading">

            <div>
              <span>06</span>
              <h2>Alerts and intervention dispatch</h2>
            </div>

            <p>
              Operational area for reviewing and dispatching
              heat-risk interventions.
            </p>

          </div>


          <div className="dispatch-layout">

            <div className="dispatch-action-panel">

              <div>
                <span>SELECTED WARD</span>

                <strong>
                  {selectedWard?.name || '—'}
                </strong>
              </div>


              <div>
                <span>RISK LEVEL</span>

                <strong>
                  {riskBand
                    ? String(riskBand).toUpperCase()
                    : '—'}
                </strong>
              </div>


              <div className="dispatch-buttons">

                <button type="button">
                  Dispatch Alert
                </button>

                <button
                  type="button"
                  className="dispatch-secondary"
                >
                  Record Intervention
                </button>

              </div>

            </div>


            <div className="dispatch-activity">

              <div className="dispatch-activity-header">

                <strong>
                  DISPATCH ACTIVITY
                </strong>

                <span>
                  Recent activity
                </span>

              </div>


              <div className="dispatch-table">

                <div className="dispatch-row dispatch-row-heading">
                  <span>TIME</span>
                  <span>WARD</span>
                  <span>ACTION</span>
                  <span>STATUS</span>
                </div>

                <div className="dispatch-row">
                  <span>—</span>
                  <span>—</span>
                  <span>—</span>
                  <span>—</span>
                </div>

              </div>

            </div>

          </div>

        </section>


        {/* ===================================================
            REPORTS
        ==================================================== */}

        <section
          id="reports"
          className="reports-section"
        >

          <div className="dashboard-section-heading">

            <div>
              <span>07</span>
              <h2>Reports</h2>
            </div>

            <p>
              Summary reports and historical heat-risk information.
            </p>

          </div>


          <div className="reports-grid">

            <div className="report-card">
              <span>01</span>
              <strong>Ward risk report</strong>
              <p>
                Current ward-level risk summary.
              </p>
              <b>—</b>
            </div>

            <div className="report-card">
              <span>02</span>
              <strong>Heat event report</strong>
              <p>
                Historical heat-event information.
              </p>
              <b>—</b>
            </div>

            <div className="report-card">
              <span>03</span>
              <strong>Intervention report</strong>
              <p>
                Alert and intervention activity.
              </p>
              <b>—</b>
            </div>

          </div>

        </section>

      </main>


      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="dashboard-footer">

        <div className="dashboard-footer-main">

          <div className="dashboard-footer-brand">

            <img
              src={emblem}
              alt="Indian National Emblem"
            />

            <div>
              <strong>ThermaSense</strong>
              <span>
                Heat-Resilient Cities, Healthier Lives
              </span>
            </div>

          </div>


          <div className="dashboard-footer-note">

            <p>
              Urban heat intelligence platform for ward-level
              thermal risk assessment and early warning support.
            </p>

            <span>
              Data sources and methodology are available through
              the platform.
            </span>

          </div>

        </div>


        <div className="dashboard-footer-bottom">

          <span>
            © 2026 ThermaSense
          </span>

          <span>
            Civic technology for heat resilience
          </span>

        </div>

      </footer>

    </div>
  );
}

export default Dashboard;