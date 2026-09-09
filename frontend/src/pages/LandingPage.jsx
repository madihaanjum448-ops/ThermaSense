import React, { useState, useEffect } from 'react';
import emblem from '../assets/emblem.png';
import { fetchZoneSummary } from '../services/api';
import HeatInfoCarousel from '../components/HeatInfoCarousel';
import {
  Thermometer,
  ShieldAlert,
  Activity,
  Flame,
  Droplets,
  HeartPulse,
  PhoneCall,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  AlertOctagon,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function LandingPage({ onNavigateDashboard }) {
  const [lang, setLang] = useState('en');
  const [fontSize, setFontSize] = useState('normal');
  const [activeTab, setActiveTab] = useState('safety');
  const [liveSummary, setLiveSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Apply font size scale
  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === 'small') {
      root.style.fontSize = '14px';
    } else if (fontSize === 'large') {
      root.style.fontSize = '17.5px';
    } else {
      root.style.fontSize = '15.5px';
    }
  }, [fontSize]);

  // Fetch real live zone summary for current WBGT & alerts badge
  useEffect(() => {
    let isMounted = true;
    async function loadSummary() {
      setLoadingSummary(true);
      try {
        const sum = await fetchZoneSummary();
        if (isMounted && sum) {
          setLiveSummary(sum);
        }
      } catch (err) {
        console.warn('Failed to load live summary for landing page:', err);
      } finally {
        if (isMounted) setLoadingSummary(false);
      }
    }
    loadSummary();
    return () => { isMounted = false; };
  }, []);

  const liveWbgt = liveSummary?.avg_wbgt ?? liveSummary?.max_wbgt ?? null;
  const liveActiveAlerts = liveSummary?.active_alerts ?? 0;

  return (
    <div className={`portal-container font-scale-${fontSize}`}>
      {/* ============================================================
          TOP GOVERNMENT IDENTITY STRIP
      ============================================================= */}
      <div className="top-gov-identity-strip">
        <div className="top-gov-strip-inner">
          <div className="gov-brand-titles">
            <span className="gov-india-text">GOVERNMENT OF INDIA</span>
            <span className="gov-strip-sep">|</span>
            <span className="gov-hindi-text">भारत सरकार</span>
            <span className="gov-strip-sep">·</span>
            <span className="gov-ministry-text">Ministry of Earth Sciences / NDMA</span>
          </div>

          <div className="top-gov-accessibility-controls">
            <a href="#landing-main-content" className="skip-link">
              {lang === 'hi' ? 'मुख्य सामग्री पर जाएं' : 'Skip to main content'}
            </a>

            {/* Language Toggle */}
            <div className="bilingual-toggle" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                English
              </button>
              <span className="lang-sep">/</span>
              <button
                type="button"
                className={`lang-btn ${lang === 'hi' ? 'active' : ''}`}
                onClick={() => setLang('hi')}
                aria-pressed={lang === 'hi'}
              >
                हिंदी
              </button>
            </div>

            {/* Font Size Accessibility Controls */}
            <div className="font-size-controls" role="group" aria-label="Font size controls">
              <button
                type="button"
                className={`font-btn ${fontSize === 'small' ? 'active' : ''}`}
                onClick={() => setFontSize('small')}
                title="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className={`font-btn ${fontSize === 'normal' ? 'active' : ''}`}
                onClick={() => setFontSize('normal')}
                title="Default font size"
              >
                A
              </button>
              <button
                type="button"
                className={`font-btn ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
                title="Increase font size"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          MAIN HEADER LOCKUP
      ============================================================= */}
      <header className="portal-main-header">
        <div className="portal-header-inner">
          <div className="brand-lockup">
            <div className="emblem-wrapper">
              <img
                src={emblem}
                alt="State Emblem of India"
                className="ashoka-emblem"
              />
            </div>
            <div className="brand-text">
              <div className="brand-heading">
                <span className="brand-name">ThermaSense</span>
                <span className="gov-badge-pill">PUBLIC SAFETY PORTAL</span>
              </div>
              <h1 className="brand-subtitle">
                {lang === 'hi'
                  ? 'राष्ट्रीय ताप तनाव पूर्व चेतावनी एवं सुरक्षा प्रणाली'
                  : 'National Heat Stress Early Warning & Public Safety Portal'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            className="landing-header-cta-btn"
            onClick={onNavigateDashboard}
          >
            <Activity size={16} />
            <span>{lang === 'hi' ? 'लाइव अर्बन डैशबोर्ड →' : 'Open Live Dashboard →'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================
          LIVE ALERT BANNER (REAL DATA)
      ============================================================= */}
      <div className={`landing-alert-strip ${liveActiveAlerts > 0 ? 'strip-active-alert' : 'strip-normal'}`}>
        <div className="landing-alert-inner">
          <div className="alert-strip-left">
            {liveActiveAlerts > 0 ? (
              <>
                <Flame size={18} className="flame-icon-pulse" />
                <strong>
                  {lang === 'hi'
                    ? `सक्रिय तापवेव चेतावनी: ${liveActiveAlerts} वार्डों में अत्यधिक ताप तनाव दर्ज`
                    : `ACTIVE HEAT ADVISORY: ${liveActiveAlerts} Monitored Wards Currently in Extreme Stress`}
                </strong>
              </>
            ) : (
              <>
                <ShieldAlert size={18} />
                <strong>
                  {lang === 'hi'
                    ? 'वर्तमान स्थिति: सभी मॉनिटर किए गए वार्ड सुरक्षित सीमा के भीतर हैं'
                    : 'CURRENT STATUS: All Monitored Urban Zones Operating Within Safe Baseline'}
                </strong>
              </>
            )}
          </div>
          <button
            type="button"
            className="alert-strip-action-btn"
            onClick={onNavigateDashboard}
          >
            {lang === 'hi' ? 'वार्ड मानचित्र देखें' : 'View Ward Risk Map'} →
          </button>
        </div>
      </div>

      {/* ============================================================
          HERO SECTION
      ============================================================= */}
      <main id="landing-main-content" className="landing-main-container">
        <section className="landing-hero-card">
          <div className="hero-content-col">
            <div className="hero-badge">
              <Sparkles size={14} />
              <span>Ministry of Earth Sciences · NDMA Heat Health Initiative</span>
            </div>

            <h2 className="hero-headline">
              {lang === 'hi'
                ? 'मौसम क्या करेगा — केवल यह नहीं कि वह क्या होगा'
                : 'What the weather will do — not just what it will be.'}
            </h2>

            <p className="hero-description">
              {lang === 'hi'
                ? 'पारंपरिक मौसम पूर्वानुमान केवल तापमान बताते हैं। थर्मासेंस आर्द्रता, सौर विकिरण, और मानव शरीर पर शारीरिक तनाव (WBGT एवं UTCI) का वास्तविक समय में आकलन कर समय से पहले जीवन रक्षक चेतावनियाँ प्रदान करता है।'
                : 'Traditional forecasts only report ambient temperature. ThermaSense translates biometeorological conditions, relative humidity, and solar radiation into physiological thermal stress (WBGT & UTCI) to protect citizens, outdoor workers, and healthcare infrastructure.'}
            </p>

            <div className="hero-actions-row">
              <button
                type="button"
                className="hero-primary-btn"
                onClick={onNavigateDashboard}
              >
                <Activity size={18} />
                <span>{lang === 'hi' ? 'लाइव मॉनिटरिंग डैशबोर्ड खोलें' : 'Access Live Early Warning Dashboard'}</span>
              </button>

              <a href="#plain-language-explainer" className="hero-secondary-btn">
                <Info size={16} />
                <span>{lang === 'hi' ? 'सूचकांक समझें' : 'Understand Thermal Indices'}</span>
              </a>
            </div>
          </div>

          {/* Live Current WBGT Badge Card */}
          <div className="hero-wbgt-badge-card">
            <div className="badge-card-top">
              <span className="badge-card-label">
                {lang === 'hi' ? 'लाइव निगरानी (बेंगलुरु)' : 'LIVE MONITORING (BENGALURU)'}
              </span>
              <span className="live-dot-pulse"></span>
            </div>

            <div className="badge-wbgt-display">
              <span className="wbgt-badge-val">
                {loadingSummary ? '...' : (liveWbgt !== null ? `${liveWbgt}°C` : 'Live')}
              </span>
              <span className="wbgt-badge-title">
                {lang === 'hi' ? 'वर्तमान औसत WBGT' : 'Current Average WBGT'}
              </span>
            </div>

            <div className="badge-metrics-grid">
              <div className="badge-mini-stat">
                <span>UTCI (Modeled)</span>
                <strong>{liveSummary?.avg_utci !== null && liveSummary?.avg_utci !== undefined ? `${liveSummary.avg_utci}°C` : '—'}</strong>
              </div>
              <div className="badge-mini-stat">
                <span>Active Alerts</span>
                <strong className={liveActiveAlerts > 0 ? 'text-red' : 'text-green'}>
                  {liveActiveAlerts} {lang === 'hi' ? 'वार्ड' : 'Wards'}
                </strong>
              </div>
            </div>

            <div className="badge-card-footer">
              <Clock size={12} />
              <span>Sourced live from Open-Meteo & NASA POWER</span>
            </div>
          </div>
        </section>

        {/* ============================================================
            HEAT FORECAST & RISK TOOLS CAROUSEL (WEATHER.GOV STYLE)
        ============================================================= */}
        <section className="landing-carousel-section">
          <HeatInfoCarousel onNavigateDashboard={onNavigateDashboard} />
        </section>

        {/* ============================================================
            TABBED GUIDES & SIDEBAR
        ============================================================= */}
        <div className="landing-content-layout">
          {/* Main Column: Tabbed Safety Information */}
          <div className="landing-tabs-column">
            {/* Tabbed Navigation */}
            <div className="safety-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'safety'}
                className={`safety-tab-btn ${activeTab === 'safety' ? 'active' : ''}`}
                onClick={() => setActiveTab('safety')}
              >
                <HeartPulse size={16} />
                <span>{lang === 'hi' ? 'ताप सुरक्षा' : 'Heat Safety'}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'warnings'}
                className={`safety-tab-btn ${activeTab === 'warnings' ? 'active' : ''}`}
                onClick={() => setActiveTab('warnings')}
              >
                <AlertOctagon size={16} />
                <span>{lang === 'hi' ? 'सतर्कता एवं चेतावनी' : 'Watches & Warnings'}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tools'}
                className={`safety-tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
                onClick={() => setActiveTab('tools')}
              >
                <Layers size={16} />
                <span>{lang === 'hi' ? 'पूर्वानुमान उपकरण' : 'Forecast Tools'}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'during'}
                className={`safety-tab-btn ${activeTab === 'during' ? 'active' : ''}`}
                onClick={() => setActiveTab('during')}
              >
                <Thermometer size={16} />
                <span>{lang === 'hi' ? 'हीटवेव के दौरान' : 'During a Heatwave'}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'illness'}
                className={`safety-tab-btn ${activeTab === 'illness' ? 'active' : ''}`}
                onClick={() => setActiveTab('illness')}
              >
                <Activity size={16} />
                <span>{lang === 'hi' ? 'गर्मी जनित बीमारियाँ' : 'Heat-Related Illness'}</span>
              </button>
            </div>

            {/* Tab 1: Heat Safety */}
            {activeTab === 'safety' && (
              <div className="tab-content-panel">
                <h3 className="tab-panel-title">Essential Heat Safety Guidelines</h3>
                <p className="tab-panel-intro">
                  High thermal stress compromises the body's ability to regulate core temperature. Follow these evidence-based safety measures:
                </p>

                <div className="safety-cards-grid">
                  <div className="safety-info-card">
                    <div className="card-icon-header text-blue">
                      <Droplets size={22} />
                      <strong>Hydration Protocol</strong>
                    </div>
                    <p>Drink 250ml water every 20-30 minutes even if not feeling thirsty. Avoid caffeinated and alcoholic beverages which accelerate dehydration.</p>
                  </div>

                  <div className="safety-info-card">
                    <div className="card-icon-header text-amber">
                      <Clock size={22} />
                      <strong>Peak Sun Respite</strong>
                    </div>
                    <p>Limit strenuous outdoor physical labor and construction work between 12:00 PM and 4:00 PM when solar radiation peaks above 750 W/m².</p>
                  </div>

                  <div className="safety-info-card">
                    <div className="card-icon-header text-red">
                      <HeartPulse size={22} />
                      <strong>Protect Vulnerable Groups</strong>
                    </div>
                    <p>Monitor children under 5, adults over 60, pregnant women, and outdoor gig workers. Ensure access to ventilated cool rest areas.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Watches & Warnings */}
            {activeTab === 'warnings' && (
              <div className="tab-content-panel">
                <h3 className="tab-panel-title">National Warning Tiers & Trigger Criteria</h3>
                <p className="tab-panel-intro">
                  IMD and NDMA categorize heat severity through four operational warning tiers:
                </p>

                <div className="warning-levels-table">
                  <div className="warning-row row-green">
                    <div className="tier-tag">GREEN / CAUTION</div>
                    <div className="tier-desc">
                      <strong>Normal / Comfortable (WBGT &lt; 31.0°C)</strong>
                      <span>Standard public advisory. No immediate administrative intervention required.</span>
                    </div>
                  </div>

                  <div className="warning-row row-yellow">
                    <div className="tier-tag">YELLOW / WATCH</div>
                    <div className="tier-desc">
                      <strong>Moderate Heat Stress (WBGT 31.0°C - 32.2°C)</strong>
                      <span>Public health units put on alert. Hydration reminders issued to outdoor workers.</span>
                    </div>
                  </div>

                  <div className="warning-row row-orange">
                    <div className="tier-tag">ORANGE / WARNING</div>
                    <div className="tier-desc">
                      <strong>Severe Heat Stress (WBGT 32.2°C - 33.0°C)</strong>
                      <span>Cooling shelters prepared. Work-hour respite advisory issued for construction sectors.</span>
                    </div>
                  </div>

                  <div className="warning-row row-red">
                    <div className="tier-tag">RED / EXTREME</div>
                    <div className="tier-desc">
                      <strong>Critical Thermal Emergency (WBGT &gt; 33.0°C)</strong>
                      <span>Mandatory work halt, cooling centre activation, hospital surge beds mobilized.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Forecast Tools */}
            {activeTab === 'tools' && (
              <div className="tab-content-panel">
                <h3 className="tab-panel-title">Numerical Early Warning Modeling</h3>
                <p className="tab-panel-intro">
                  ThermaSense couples high-resolution meteorological models with biophysical heat balance calculations:
                </p>

                <div className="tools-features-list">
                  <div className="tool-feature-item">
                    <strong>1. Open-Meteo High-Resolution NWP</strong>
                    <p>Ingests real-time hourly temperature, humidity, wind velocity, and solar radiation fields for urban ward centroids.</p>
                  </div>
                  <div className="tool-feature-item">
                    <strong>2. ISO 7243 WBGT & pythermalcomfort UTCI</strong>
                    <p>Calculates outdoor environmental heat stress accounting for mean radiant temperature and evaporative cooling limits.</p>
                  </div>
                  <div className="tool-feature-item">
                    <strong>3. Census Demographic Vulnerability Overlay</strong>
                    <p>Adjusts meteorological exposure using local ward-level elderly percentages, informal housing, and tree canopy coverage.</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="tab-action-btn"
                  onClick={onNavigateDashboard}
                >
                  Explore Interactive Ward Map →
                </button>
              </div>
            )}

            {/* Tab 4: During a Heatwave */}
            {activeTab === 'during' && (
              <div className="tab-content-panel">
                <h3 className="tab-panel-title">Citizen Action Matrix During Heatwaves</h3>
                <div className="during-heatwave-grid">
                  <div className="do-dont-card card-do">
                    <h4>✓ Recommended Actions (DOs)</h4>
                    <ul>
                      <li>Keep windows and curtains closed during the day; open at night for ventilation.</li>
                      <li>Wear light-colored, loose, breathable cotton clothes.</li>
                      <li>Carry water, umbrella, and a wet towel when stepping outside.</li>
                      <li>Consume homemade rehydration drinks (ORS, buttermilk, lemon water, coconut water).</li>
                      <li>Ensure pets and cattle have shade and plenty of clean drinking water.</li>
                    </ul>
                  </div>

                  <div className="do-dont-card card-dont">
                    <h4>✕ Prohibited Actions (DON'Ts)</h4>
                    <ul>
                      <li>Do not leave children or pets inside locked parked vehicles, even for a few minutes.</li>
                      <li>Avoid heavy, high-protein, and spicy foods that increase metabolic heat.</li>
                      <li>Do not engage in strenuous physical exercise during the hottest afternoon hours.</li>
                      <li>Avoid direct sunlight exposure on bare head and neck.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Heat-Related Illness */}
            {activeTab === 'illness' && (
              <div className="tab-content-panel">
                <h3 className="tab-panel-title">Recognizing Symptoms & First Aid</h3>
                <div className="illness-comparison-grid">
                  <div className="illness-card">
                    <div className="illness-header header-exhaustion">
                      <strong>Heat Exhaustion</strong>
                      <span>Moderate Severity</span>
                    </div>
                    <div className="illness-body">
                      <p><strong>Symptoms:</strong> Heavy sweating, cold pale skin, dizziness, nausea, headache, muscle cramps, weak rapid pulse.</p>
                      <p><strong>First Aid:</strong> Move to a cool shaded place, loosen clothing, sip cool water, apply cold wet cloths to neck and forehead.</p>
                    </div>
                  </div>

                  <div className="illness-card">
                    <div className="illness-header header-stroke">
                      <strong>Heat Stroke (Medical Emergency)</strong>
                      <span>Life-Threatening</span>
                    </div>
                    <div className="illness-body">
                      <p><strong>Symptoms:</strong> Core body temperature &gt;40°C (104°F), hot red dry skin or heavy sweating, confusion, slurred speech, seizures, unconsciousness.</p>
                      <p><strong>First Aid:</strong> <strong>Call 108 immediately!</strong> Move person to shade, immerse in cool water or sponge with ice water. Do not give fluids if unconscious.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                PLAIN LANGUAGE EXPLAINER (WBGT, UTCI, HEAT INDEX)
            ============================================================= */}
            <section id="plain-language-explainer" className="plain-explainer-section">
              <div className="explainer-header">
                <Info size={18} className="explainer-icon" />
                <div>
                  <h3 className="explainer-title">Understanding Thermal Indices in Plain Language</h3>
                  <p className="explainer-sub">Why ambient thermometer readings alone don't tell the whole story</p>
                </div>
              </div>

              <div className="explainer-cards-grid">
                {/* WBGT Explainer */}
                <div className="explainer-card card-border-wbgt">
                  <div className="explainer-card-top">
                    <span className="explainer-tag">OUTDOOR WORKERS & ATHLETES</span>
                    <h4>WBGT (Wet-Bulb Globe Temp)</h4>
                  </div>
                  <p>
                    Combines air temperature, humidity, wind, and direct solar irradiance into a single measure of human heat load under sunlight. Indicates whether sweat can evaporate effectively.
                  </p>
                  <div className="explainer-threshold">
                    <strong>Critical:</strong> &gt;33.0°C requires mandatory work-rest cycles.
                  </div>
                </div>

                {/* UTCI Explainer */}
                <div className="explainer-card card-border-utci">
                  <div className="explainer-card-top">
                    <span className="explainer-tag">HUMAN ENERGY BALANCE</span>
                    <h4>UTCI (Universal Thermal Climate Index)</h4>
                  </div>
                  <p>
                    Multi-node biometeorological thermoregulation model describing total physiological stress felt across microclimates and radiation environments.
                  </p>
                  <div className="explainer-threshold">
                    <strong>Critical:</strong> &gt;38.0°C indicates strong to extreme thermal stress.
                  </div>
                </div>

                {/* Heat Index Explainer */}
                <div className="explainer-card card-border-hi">
                  <div className="explainer-card-top">
                    <span className="explainer-tag">PERCEIVED IN-SHADE HEAT</span>
                    <h4>Heat Index (Apparent Temp)</h4>
                  </div>
                  <p>
                    Standard NOAA formula measuring apparent temperature in shade by coupling humidity with dry-bulb temperature. High humidity prevents evaporative cooling.
                  </p>
                  <div className="explainer-threshold">
                    <strong>Critical:</strong> &gt;42.0°C represents dangerous heat illness risk.
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar: Emergency Helplines & Official Resources */}
          <aside className="landing-sidebar">
            {/* Emergency Helplines */}
            <div className="sidebar-card helpline-card">
              <div className="sidebar-card-header">
                <PhoneCall size={16} className="helpline-icon" />
                <h3>Emergency Helplines</h3>
              </div>
              <div className="helpline-items">
                <div className="helpline-item">
                  <span className="helpline-label">National Disaster Management (NDMA)</span>
                  <strong className="helpline-number">1078</strong>
                </div>
                <div className="helpline-item">
                  <span className="helpline-label">National Health Helpline / Heatline</span>
                  <strong className="helpline-number">1800-180-1104</strong>
                </div>
                <div className="helpline-item">
                  <span className="helpline-label">Emergency Medical Ambulance</span>
                  <strong className="helpline-number">108 / 112</strong>
                </div>
                <div className="helpline-item">
                  <span className="helpline-label">BBMP Control Room (Bengaluru)</span>
                  <strong className="helpline-number">080-22221188</strong>
                </div>
              </div>
            </div>

            {/* Official Institutional Portals */}
            <div className="sidebar-card resources-card">
              <div className="sidebar-card-header">
                <ExternalLink size={16} />
                <h3>Official Institutional Portals</h3>
              </div>
              <ul className="resource-links-list">
                <li>
                  <a href="https://ndma.gov.in" target="_blank" rel="noopener noreferrer">
                    <span>National Disaster Management Authority</span>
                    <ChevronRight size={13} />
                  </a>
                </li>
                <li>
                  <a href="https://moes.gov.in" target="_blank" rel="noopener noreferrer">
                    <span>Ministry of Earth Sciences (MoES)</span>
                    <ChevronRight size={13} />
                  </a>
                </li>
                <li>
                  <a href="https://mausam.imd.gov.in" target="_blank" rel="noopener noreferrer">
                    <span>India Meteorological Department (IMD)</span>
                    <ChevronRight size={13} />
                  </a>
                </li>
                <li>
                  <a href="https://ncdc.mohfw.gov.in" target="_blank" rel="noopener noreferrer">
                    <span>National Centre for Disease Control</span>
                    <ChevronRight size={13} />
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* ============================================================
          FOOTER
      ============================================================= */}
      <footer className="portal-main-footer">
        <div className="footer-top-strip">
          <div className="footer-strip-inner">
            <div className="footer-brand-block">
              <img src={emblem} alt="Indian Emblem" className="footer-emblem" />
              <div>
                <strong className="footer-app-name">ThermaSense</strong>
                <span className="footer-app-sub">National Heat Stress Early Warning System</span>
              </div>
            </div>
            <div className="footer-affiliation-text">
              Ministry of Earth Sciences · National Disaster Management Authority · Content owned by ThermaSense project
            </div>
          </div>
        </div>

        <div className="footer-details-strip">
          <div className="footer-details-inner">
            <div className="footer-links-row">
              <span>Official Portals: india.gov.in | ndma.gov.in | moes.gov.in | imd.gov.in</span>
              <span className="footer-sep">|</span>
              <span className="footer-helpline">Emergency Helpline: NDMA 1078 | Heat Health: 1800-180-1104</span>
            </div>
            <p className="footer-disclaimer-text">
              Official Heat Stress Warning System operated in accordance with National Disaster Management Guidelines.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
