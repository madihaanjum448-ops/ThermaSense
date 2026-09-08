import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import emblem from '../assets/emblem.png';
import WardMap from '../components/WardMap';

function Home() {
  const [selectedWard, setSelectedWard] = useState(null);

  const riskBand = selectedWard?.final_band
    ? selectedWard.final_band.toUpperCase()
    : '—';

  const riskScore =
    selectedWard?.final_risk_score ??
    selectedWard?.risk_score_raw ??
    null;

  const formattedRiskScore =
    typeof riskScore === 'number' ? riskScore.toFixed(1) : '—';

  return (
    <div className="home-page">

      {/* =====================================================
          TOP GOVERNMENT / ACCESSIBILITY BAR
      ====================================================== */}
      <div className="gov-strip">
        <div className="gov-strip-inner">
          <div className="gov-identity">
            <span>Government of India</span>
            <span className="gov-divider">|</span>
            <span>भारत सरकार</span>
          </div>

          <div className="accessibility-links">
            <a href="#main-content">Skip to main content</a>
            <span>English</span>
            <span>हिंदी</span>
            <button type="button">A-</button>
            <button type="button">A</button>
            <button type="button">A+</button>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN HEADER
      ====================================================== */}
      <header className="site-header">
        <div className="site-header-inner">

          <Link to="/" className="site-brand">
            <div className="government-emblem">
              <img
                src={emblem}
                alt="Indian National Emblem"
                className="emblem-image"
              />
            </div>

            <div className="brand-copy">
              <div className="brand-title">ThermaSense</div>
              <div className="brand-tagline">
                Heat-Resilient Cities, Healthier Lives
              </div>
            </div>
          </Link>

          <nav className="main-navigation" aria-label="Main navigation">
            <Link to="/" className="nav-link active">
              Home
            </Link>

            <a href="#about" className="nav-link">
              About
            </a>

            <Link to="/dashboard" className="nav-link">
              Live Dashboard
            </Link>

            <a href="#awareness" className="nav-link">
              Awareness
            </a>

            <a href="#resources" className="nav-link">
              Resources
            </a>
          </nav>

          <Link to="/dashboard" className="header-dashboard-button">
            Go to Dashboard
            <span>→</span>
          </Link>

        </div>
      </header>

      <main id="main-content">

        {/* =====================================================
            HERO
        ====================================================== */}
        <section className="home-hero">

          <div className="hero-image">
            <img
              src="/src/assets/india-heat-hero.png"
              alt="Urban India during summer heat"
            />
            <div className="hero-image-overlay" />
          </div>

          <div className="hero-content">

            <div className="hero-eyebrow">
              <span />
              INDIA'S URBAN HEAT INTELLIGENCE PLATFORM
            </div>

            <h1>
              A Cooler,
              <br />
              <strong>Safer Tomorrow.</strong>
            </h1>

            <h2>
              Real-time heat risk insights for Indian cities.
            </h2>

            <p>
              ThermaSense combines weather observations, thermal models,
              urban vulnerability and forecasting to help cities understand
              heat risk and support timely action.
            </p>

            <div className="hero-actions">
              <Link to="/dashboard" className="primary-button">
                Explore Live Dashboard
                <span>→</span>
              </Link>

              <a href="#about" className="secondary-button">
                Learn More
              </a>
            </div>

          </div>
        </section>

        {/* =====================================================
            FEATURE STRIP
        ====================================================== */}
        <section className="feature-strip">

          <div className="feature-item">
            <div className="feature-icon feature-icon-thermo">
              +
            </div>
            <div>
              <strong>Real-time</strong>
              <span>Heat Monitoring</span>
            </div>
          </div>

          <div className="feature-divider" />

          <div className="feature-item">
            <div className="feature-icon">
              ↗
            </div>
            <div>
              <strong>Ward-level</strong>
              <span>Risk Analysis</span>
            </div>
          </div>

          <div className="feature-divider" />

          <div className="feature-item">
            <div className="feature-icon">
              ◇
            </div>
            <div>
              <strong>Support for</strong>
              <span>Vulnerable Communities</span>
            </div>
          </div>

          <div className="feature-divider" />

          <div className="feature-item">
            <div className="feature-icon">
              +
            </div>
            <div>
              <strong>Towards</strong>
              <span>Heat-Resilient Cities</span>
            </div>
          </div>

        </section>

        {/* =====================================================
            ABOUT / OUR GOAL
        ====================================================== */}
        <section id="about" className="goal-section">

          <div className="goal-container">

            <div className="goal-content">

              <div className="section-label">
                OUR GOAL
              </div>

              <h2>
                Data for a Healthier,
                <br />
                More Resilient India
              </h2>

              <div className="section-line" />

              <p>
                ThermaSense supports urban local bodies with timely,
                location-specific heat risk information. By bringing
                environmental conditions and community vulnerability
                together, the platform helps cities prepare for periods
                of extreme heat.
              </p>

              <div className="goal-quote">
                <div className="quote-mark">“</div>

                <div>
                  <strong>
                    Prepared cities save lives.
                  </strong>

                  <div className="quote-line" />

                  <span>
                    Better information enables earlier planning,
                    targeted warnings and stronger heat preparedness.
                  </span>
                </div>
              </div>

            </div>

            <div className="why-matters">

              <div className="why-content">

                <div className="section-label">
                  WHY IT MATTERS
                </div>

                <div className="matter-item">
                  <div className="matter-icon">
                    01
                  </div>

                  <div>
                    <strong>
                      Extreme heat is a growing climate risk.
                    </strong>

                    <p>
                      Rising temperatures can affect public health,
                      infrastructure and everyday life across cities.
                    </p>
                  </div>
                </div>

                <div className="matter-item">
                  <div className="matter-icon">
                    02
                  </div>

                  <div>
                    <strong>
                      Exposure is not the same for everyone.
                    </strong>

                    <p>
                      Outdoor workers, elderly people and communities
                      living in vulnerable conditions can face greater
                      heat stress.
                    </p>
                  </div>
                </div>

                <div className="matter-item">
                  <div className="matter-icon">
                    03
                  </div>

                  <div>
                    <strong>
                      Early action can reduce risk.
                    </strong>

                    <p>
                      Localised information can support cooling measures,
                      public warnings and targeted interventions.
                    </p>
                  </div>
                </div>

              </div>

              <div className="city-illustration">
                <div className="city-sun" />
                <div className="city-horizon" />

                <div className="city-buildings">
                  <span className="building-one" />
                  <span className="building-two" />
                  <span className="building-three" />
                  <span className="building-four" />
                  <span className="building-five" />
                </div>

                <div className="city-road">
                  <div className="road-line" />
                </div>

                <div className="city-tree tree-one" />
                <div className="city-tree tree-two" />
              </div>

            </div>

          </div>
        </section>

        {/* =====================================================
            HOW THERMASENSE WORKS
        ====================================================== */}
        <section className="how-it-works-section">

          <div className="how-it-works-container">

            <div className="section-label centered">
              HOW THERMASENSE WORKS
            </div>

            <h2>
              From Data to Action
            </h2>

            <p className="how-subtitle">
              Multiple environmental and vulnerability signals are brought
              together to understand heat stress at the ward level and
              support early, targeted action.
            </p>

            <div className="how-steps">

              <div className="step-card">
                <div className="step-number">01</div>
                <h3>Weather Data</h3>
                <p>
                  Temperature, humidity, wind and other atmospheric
                  conditions are collected for the selected area.
                </p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">02</div>
                <h3>Solar Radiation</h3>
                <p>
                  Solar radiation information helps represent the
                  environmental heat load.
                </p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">03</div>
                <h3>Thermal Models</h3>
                <p>
                  Thermal indicators such as WBGT, UTCI and Heat Index
                  are calculated from available observations.
                </p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">04</div>
                <h3>Vulnerability</h3>
                <p>
                  Population and urban vulnerability signals help
                  identify communities that may face greater exposure.
                </p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">05</div>
                <h3>Risk Score</h3>
                <p>
                  Exposure and vulnerability are combined into a
                  ward-level thermal risk assessment.
                </p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">06</div>
                <h3>Forecast</h3>
                <p>
                  Forecast information helps identify upcoming periods
                  of elevated heat stress.
                </p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">07</div>
                <h3>Early Warning</h3>
                <p>
                  Risk information can support alerts and interventions
                  by responsible authorities.
                </p>
              </div>

            </div>

            <div className="how-cta">
              <Link to="/dashboard" className="primary-button">
                Explore the Platform
                <span>→</span>
              </Link>
            </div>

          </div>
        </section>

        {/* =====================================================
            LIVE HEAT SITUATION
        ====================================================== */}
        <section id="awareness" className="live-situation-section">

          <div className="live-situation-container">

            <div className="live-section-heading">
              <div>
                <div className="section-label">
                  LIVE HEAT SITUATION
                </div>

                <h2>
                  Ward-level Thermal Risk
                </h2>

                <p>
                  Explore available ward-level risk information on the
                  map. Select a ward to view its current assessment.
                </p>
              </div>

              <Link to="/dashboard" className="text-link">
                Open Full Dashboard →
              </Link>
            </div>

            <div className="home-map-wrapper">

              <div className="home-map-header">

                <div>
                  <strong>Thermal Risk Map</strong>
                  <span>GIS view</span>
                </div>

                <div className="home-map-status">
                  Ward data
                </div>

              </div>

              <div className="home-map">
                <WardMap onWardSelect={setSelectedWard} />
              </div>

            </div>

            {selectedWard && (
              <div className="home-selected-ward">

                <div className="selected-ward-heading">
                  <span>SELECTED WARD</span>
                  <strong>
                    {selectedWard.name || '—'}
                  </strong>
                </div>

                <div className="selected-ward-metric">
                  <span>RISK LEVEL</span>
                  <strong className={`risk-${riskBand.toLowerCase()}`}>
                    {riskBand}
                  </strong>
                </div>

                <div className="selected-ward-metric">
                  <span>RISK SCORE</span>
                  <strong>
                    {formattedRiskScore}
                  </strong>
                </div>

                <Link
                  to="/dashboard"
                  className="selected-ward-link"
                >
                  View Ward Details →
                </Link>

              </div>
            )}

          </div>
        </section>

        {/* =====================================================
            PUBLIC AWARENESS
        ====================================================== */}
        <section className="awareness-section">

          <div className="awareness-container">

            <div className="section-label centered">
              HEAT AWARENESS
            </div>

            <h2>
              Stay Safe During Extreme Heat
            </h2>

            <p className="awareness-intro">
              Simple precautions can help reduce the health risks
              associated with prolonged exposure to high temperatures.
            </p>

            <div className="awareness-grid">

              <article className="awareness-card">
                <div className="awareness-number">01</div>
                <h3>Stay Hydrated</h3>
                <p>
                  Drink water regularly and avoid waiting until you
                  feel thirsty, especially during hot periods.
                </p>
              </article>

              <article className="awareness-card">
                <div className="awareness-number">02</div>
                <h3>Limit Peak Exposure</h3>
                <p>
                  Where possible, reduce strenuous outdoor activity
                  during the hottest part of the day.
                </p>
              </article>

              <article className="awareness-card">
                <div className="awareness-number">03</div>
                <h3>Look Out for Others</h3>
                <p>
                  Check on elderly people, children, outdoor workers
                  and others who may be more vulnerable to heat.
                </p>
              </article>

              <article className="awareness-card">
                <div className="awareness-number">04</div>
                <h3>Recognise Heat Stress</h3>
                <p>
                  Take symptoms such as dizziness, weakness, confusion
                  or unusual fatigue seriously and seek appropriate help.
                </p>
              </article>

            </div>

          </div>
        </section>

        {/* =====================================================
            RESOURCES
        ====================================================== */}
        <section id="resources" className="resources-section">

          <div className="resources-container">

            <div className="resources-heading">
              <div>
                <div className="section-label">
                  RESOURCES
                </div>

                <h2>
                  Heat Preparedness Resources
                </h2>
              </div>

              <p>
                Information and platform tools for understanding,
                preparing for and responding to urban heat.
              </p>
            </div>

            <div className="resources-list">

              <Link to="/dashboard" className="resource-row">
                <div>
                  <span>01</span>
                  <strong>Live Dashboard</strong>
                  <p>
                    Explore ward-level thermal risk information.
                  </p>
                </div>
                <b>→</b>
              </Link>

              <div className="resource-row">
                <div>
                  <span>02</span>
                  <strong>Heat Risk Indicators</strong>
                  <p>
                    Understand thermal indicators including WBGT,
                    UTCI and Heat Index.
                  </p>
                </div>
                <b>→</b>
              </div>

              <div className="resource-row">
                <div>
                  <span>03</span>
                  <strong>Heat Preparedness</strong>
                  <p>
                    Learn practical measures for reducing heat exposure
                    and supporting vulnerable communities.
                  </p>
                </div>
                <b>→</b>
              </div>

            </div>

          </div>
        </section>

      </main>

      {/* =====================================================
          FOOTER
      ====================================================== */}
      <footer className="site-footer">

        <div className="footer-main">

          <div className="footer-brand">

            <div className="footer-brand-top">
              <img
                src={emblem}
                alt="Indian National Emblem"
                className="footer-emblem"
              />

              <div>
                <strong>ThermaSense</strong>
                <span>
                  Heat-Resilient Cities, Healthier Lives
                </span>
              </div>
            </div>

            <p>
              An urban heat intelligence platform designed to support
              timely, location-specific understanding of thermal risk.
            </p>

          </div>

          <div className="footer-links">

            <div>
              <strong>Platform</strong>
              <Link to="/dashboard">Dashboard</Link>
              <a href="#about">About</a>
              <a href="#awareness">Awareness</a>
              <a href="#resources">Resources</a>
            </div>

            <div>
              <strong>Information</strong>
              <span>Heat Risk</span>
              <span>Forecasting</span>
              <span>Vulnerability</span>
              <span>Early Warning</span>
            </div>

          </div>

        </div>

        <div className="footer-bottom">

          <span>
            © 2026 ThermaSense. Civic technology for heat resilience.
          </span>

          <span>
            Data sources and methodology available through the platform.
          </span>

        </div>

      </footer>

    </div>
  );
}

export default Home;