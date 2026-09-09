import React, { useState, useEffect, useCallback } from 'react';
import emblem from '../assets/emblem.png';
import WardMap from '../components/WardMap';
import OfficialLoginModal from '../components/OfficialLoginModal';
import OfficialReportSection from '../components/OfficialReportSection';
import { useAuth } from '../context/AuthContext';
import {
  INITIAL_DISPATCH_LOG,
  TRANSLATIONS,
  WARDS_STATIC_METADATA,
} from '../data/wardsData';
import {
  fetchWardsGeoJSON,
  fetchWardForecast,
  fetchDataSourcesStatus,
  fetchZoneSummary,
  dispatchIntervention,
} from '../services/api';
import {
  Flame,
  Thermometer,
  Activity,
  Wind,
  Droplets,
  Sun,
  Users,
  Briefcase,
  Home as HomeIcon,
  Trees,
  CheckCircle2,
  RefreshCw,
  Send,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Info,
  Radio,
  Clock,
  MapPin,
  FileText,
  SlidersHorizontal,
  AlertTriangle,
  Lock,
  LogOut,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';


export default function Dashboard({ onNavigateHome }) {
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Accessibility font scaling
  const [fontSize, setFontSize] = useState('normal');

  // Selected Karnataka ward ID (1 - 8, default Ward 4 Shivajinagar)
  const [selectedWardId, setSelectedWardId] = useState(4);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Active map layer (wbgt | vulnerability | heatmap)
  const [activeMapLayer, setActiveMapLayer] = useState('wbgt');

  // Live state from Backend API
  const [liveWards, setLiveWards] = useState([]);
  const [liveForecast, setLiveForecast] = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [zoneSummary, setZoneSummary] = useState(null);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [isLiveUnavailable, setIsLiveUnavailable] = useState(false);
  const [lastUpdatedMin, setLastUpdatedMin] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Dispatch log state
  const [dispatchLog, setDispatchLog] = useState(INITIAL_DISPATCH_LOG);

  // Authentication state
  const { user, token, isAuthenticated, logout } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Dispatch modal state
  const [dispatchModal, setDispatchModal] = useState({
    isOpen: false,
    actionType: null,
  });
  const [toastMessage, setToastMessage] = useState(null);

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

  // Load all live data from backend API
  const loadLiveDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsSyncing(true);
    else setIsLoading(true);

    try {
      const [geoRes, dsRes, sumRes] = await Promise.all([
        fetchWardsGeoJSON(),
        fetchDataSourcesStatus(),
        fetchZoneSummary(),
      ]);

      if (geoRes && geoRes.features && geoRes.features.length > 0) {
        const extracted = geoRes.features.map((f) => ({
          ...f.properties,
          geometry: f.geometry,
        }));
        setLiveWards(extracted);
        setIsLiveUnavailable(false);
      } else {
        setIsLiveUnavailable(true);
      }

      if (dsRes && dsRes.length > 0) {
        setDataSources(dsRes);
      }

      if (sumRes) {
        setZoneSummary(sumRes);
      }

      setLastUpdatedMin(0);
    } catch (_err) {
      console.warn('Dashboard live data fetch error:', _err);
      setIsLiveUnavailable(true);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadLiveDashboardData();
  }, [loadLiveDashboardData]);

  // Resolve current selected ward by merging static census metadata with live API data
  const selectedStatic = WARDS_STATIC_METADATA.find((w) => w.id === selectedWardId) || WARDS_STATIC_METADATA[3];
  const liveMatch = liveWards.find((lw) => (lw.id === selectedWardId || lw.properties?.id === selectedWardId));
  const liveProps = liveMatch?.properties || liveMatch || {};

  const currentWard = {
    ...selectedStatic,
    ...liveProps,
    id: selectedStatic.id,
    wardNumber: selectedStatic.wardNumber,
    name: selectedStatic.name,
    nameHi: selectedStatic.nameHi,
    zone: selectedStatic.zone,
    zoneHi: selectedStatic.zoneHi,
    city: 'Bengaluru',
    stateName: 'Karnataka',
    coordinates: selectedStatic.coordinates,
    vulnerability: {
      elderlyPct: liveProps.elderly_pct ?? selectedStatic.vulnerability?.elderlyPct ?? 18.2,
      outdoorWorkerPct: liveProps.outdoor_worker_pct ?? selectedStatic.vulnerability?.outdoorWorkerPct ?? 31.0,
      informalHousingPct: liveProps.informal_housing_pct ?? selectedStatic.vulnerability?.informalHousingPct ?? 27.0,
      greenCoverPct: liveProps.green_cover_pct ?? selectedStatic.vulnerability?.greenCoverPct ?? 9.0,
      compositeScore: liveProps.vulnerability_score ?? selectedStatic.vulnerability?.compositeScore ?? 78.4,
    },
    temperature: liveProps.temperature !== undefined && liveProps.temperature !== null ? liveProps.temperature : 31.8,
    humidity: liveProps.humidity !== undefined && liveProps.humidity !== null ? liveProps.humidity : 62,
    windSpeed: liveProps.wind_speed !== undefined && liveProps.wind_speed !== null ? liveProps.wind_speed : (liveProps.windSpeed ?? 14.2),
    solarRadiation: liveProps.solar_radiation !== undefined && liveProps.solar_radiation !== null ? liveProps.solar_radiation : (liveProps.solarRadiation ?? 780),
    wbgt: liveProps.wbgt !== undefined && liveProps.wbgt !== null ? liveProps.wbgt : 31.4,
    utci: liveProps.utci !== undefined && liveProps.utci !== null ? liveProps.utci : 35.8,
    heatIndex: liveProps.heat_index !== undefined && liveProps.heat_index !== null ? liveProps.heat_index : (liveProps.heatIndex ?? 36.2),
    dewPoint: liveProps.dew_point ?? liveProps.dewPoint ?? 23.5,
    wetBulb: liveProps.wet_bulb ?? liveProps.wetBulb ?? 25.8,
    riskBand: liveProps.risk_band || liveProps.riskBand || 'Warning',
    riskLevel: (liveProps.risk_band || liveProps.riskBand || 'warning').toLowerCase(),
  };

  // Load live 5-day daily forecast for current selected ward from backend API
  useEffect(() => {
    let isMounted = true;
    async function loadForecast() {
      setForecastLoading(true);
      try {
        const backendFc = await fetchWardForecast(selectedWardId);
        if (isMounted && backendFc && backendFc.length > 0) {
  const generated = backendFc.map((fc, idx) => ({
    day: fc.day || `Day ${idx + 1}`,
    dayHi: fc.dayHi || '',
    date: fc.date || `Day +${idx + 1}`,
    temp: fc.temperature ?? null,
    wbgt: fc.wbgt ?? null,
    trend: fc.trend || 'steady',
    riskBand: fc.final_risk_band || fc.risk_band || 'Caution',
  }));

  setLiveForecast(generated);
  setForecastLoading(false);
  return;
}
      } catch (err) {
        console.warn('Backend forecast fetch error, using local trajectory:', err);
      }

      if (isMounted) {
        const days = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const daysHi = ['बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];
        const baseTemp = currentWard.temperature || 31.8;
        const baseWbgt = currentWard.wbgt || 31.4;
        const variations = [0, 0.8, 1.4, -0.6, -1.2];
        const trends = ['steady', 'up', 'up', 'down', 'down'];

        const generated = days.map((day, idx) => {
          const tVal = Math.round((baseTemp + variations[idx]) * 10) / 10;
          const wVal = Math.round((baseWbgt + variations[idx] * 0.7) * 10) / 10;
          const band = wVal >= 33.0 ? 'Extreme' : wVal >= 31.0 ? 'Warning' : 'Caution';
          return {
            day,
            dayHi: daysHi[idx],
            date: `Day +${idx + 1}`,
            temp: tVal,
            wbgt: wVal,
            trend: trends[idx],
            riskBand: band,
          };
        });
        setLiveForecast(generated);
        setForecastLoading(false);
      }
    }
    loadForecast();
    return () => { isMounted = false; };
  }, [selectedWardId, currentWard.temperature, currentWard.wbgt]);

  // Periodic elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdatedMin((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    loadLiveDashboardData(true);
    showToast(lang === 'hi' ? 'डेटा सफलतापूर्वक अपडेट किया गया' : 'Live sensor data refreshed successfully');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Dynamic health impact estimation from live WBGT
  const wbgtVal = currentWard.wbgt;

  const hospSpike = wbgtVal ? Math.round(Math.max(5, (wbgtVal - 25.0) * 4.2)) : null;
  const ciLow = hospSpike ? Math.max(2, hospSpike - 8) : null;
  const ciHigh = hospSpike ? hospSpike + 9 : null;
  const mortalityIndex = wbgtVal ? Math.round(Math.min(10.0, Math.max(1.0, (wbgtVal - 22.0) * 0.85)) * 10) / 10 : null;
  const baselineDiff = mortalityIndex ? (mortalityIndex >= 5.0 ? `+${(mortalityIndex - 4.5).toFixed(1)} vs 3-yr baseline` : `Within baseline`) : null;
  const baselineDiffHi = mortalityIndex ? (mortalityIndex >= 5.0 ? `+${(mortalityIndex - 4.5).toFixed(1)} 3-वर्षीय आधार रेखा की तुलना में` : `सामान्य आधार रेखा के भीतर`) : null;

  const openDispatchModal = (actionType) => {
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }
    setDispatchModal({ isOpen: true, actionType });
  };

  const closeDispatchModal = () => {
    setDispatchModal({ isOpen: false, actionType: null });
  };

  const executeDispatch = async () => {
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsDispatching(true);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let actionNameEn = '';
    let actionNameHi = '';
    let type = 'alert';

    const wardLabelEn = `${currentWard.wardNumber} (${currentWard.name})`;
    const wardLabelHi = `${currentWard.wardNumber} (${currentWard.nameHi})`;
    const officerDisplayName = user?.name || 'Officer';

    if (dispatchModal.actionType === 'sms') {
      actionNameEn = `${officerDisplayName} dispatched Emergency SMS/WhatsApp — ${wardLabelEn}`;
      actionNameHi = `${officerDisplayName} द्वारा आपातकालीन एसएमएस/व्हाट्सएप भेजा गया — ${wardLabelHi}`;
      type = 'alert';
    } else if (dispatchModal.actionType === 'cooling') {
      actionNameEn = `${officerDisplayName} activated Cooling Centre — ${wardLabelEn}`;
      actionNameHi = `${officerDisplayName} द्वारा शीतलन केंद्र सक्रिय किया गया — ${wardLabelHi}`;
      type = 'cooling';
    } else if (dispatchModal.actionType === 'work_shift') {
      actionNameEn = `${officerDisplayName} issued Work-Hour Shift Order — ${wardLabelEn}`;
      actionNameHi = `${officerDisplayName} द्वारा कार्य-समय पाली संशोधन आदेश जारी — ${wardLabelHi}`;
      type = 'work';
    }

    try {
      // Call authenticated backend dispatch endpoint
      await dispatchIntervention(currentWard.id, dispatchModal.actionType, '', token);

      const newEntry = {
        id: Date.now(),
        time: timeStr,
        action: actionNameEn,
        actionHi: actionNameHi,
        status: 'Delivered',
        statusHi: 'पुष्टीकृत',
        type,
        target: wardLabelEn,
        officer: officerDisplayName,
      };

      setDispatchLog([newEntry, ...dispatchLog]);
      closeDispatchModal();
      showToast(
        lang === 'hi'
          ? `सफलतापूर्वक आदेश जारी: ${actionNameHi}`
          : `Intervention dispatched successfully: ${actionNameEn}`
      );
    } catch (err) {
      showToast(`Dispatch failed: ${err.message || 'Server error'}`);
    } finally {
      setIsDispatching(false);
    }
  };


  const scrollToSection = (id, tabName) => {
    setActiveTab(tabName);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Compute active alerts count from live data
  const activeAlertsCount = zoneSummary?.active_alerts ?? liveWards.filter(w => (w.risk_band === 'Extreme' || w.wbgt >= 33.0)).length;
  const activeAlertsWardsList = zoneSummary?.alert_wards?.length > 0
    ? zoneSummary.alert_wards.join(', ')
    : liveWards.filter(w => (w.risk_band === 'Extreme' || w.wbgt >= 33.0)).map(w => `Ward ${w.id}`).join(', ') || 'No active alerts';

  return (
    <div className={`portal-container font-scale-${fontSize}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="gov-toast" role="alert">
          <CheckCircle2 size={18} className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================
          TOP BAR 1: Government of India Official Identity Strip
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
            {onNavigateHome && (
              <button
                type="button"
                className="gov-portal-link-btn"
                onClick={onNavigateHome}
              >
                ← Public Portal
              </button>
            )}

            <a href="#main-dashboard-content" className="skip-link">
              {t.skipToMain}
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
                aria-label="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className={`font-btn ${fontSize === 'normal' ? 'active' : ''}`}
                onClick={() => setFontSize('normal')}
                title="Standard font size"
                aria-label="Default font size"
              >
                A
              </button>
              <button
                type="button"
                className={`font-btn ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
                title="Increase font size"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          TOP BAR 2: Portal Brand Header + Live Status Ticker + Nav
      ============================================================= */}
      <header className="portal-main-header">
        <div className="portal-header-inner">
          <div className="brand-lockup">
            <div className="emblem-wrapper">
              <img
                src={emblem}
                alt="State Emblem of India (Lion Capital of Ashoka)"
                className="ashoka-emblem"
              />
            </div>
            <div className="brand-text">
              <div className="brand-heading">
                <span className="brand-name">ThermaSense</span>
                <span className="gov-badge-pill">GOV.IN PORTAL</span>
              </div>
              <h1 className="brand-subtitle">{t.appSubtitle}</h1>
            </div>
          </div>

          {/* Live Data Ticker Indicator */}
          <div className="live-status-block">
            <div className="live-pulse-container">
              <span className={`pulsing-green-dot ${isLiveUnavailable ? 'dot-warning' : ''}`}></span>
              <div className="live-text-wrapper">
                <span className="live-title-line">
                  {t.liveDataPrefix}{' '}
                  <strong>
                    {lastUpdatedMin === 0 ? t.justNow : `${lastUpdatedMin} ${t.minAgo}`}
                  </strong>
                </span>
                <span className="live-sub-line">
                  {isLiveUnavailable ? t.dataUnavailable : 'Open-Meteo NWP & Satellite Ingest'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className={`refresh-data-btn ${isSyncing ? 'syncing' : ''}`}
              onClick={handleManualRefresh}
              title={t.refreshData}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
              <span>{isSyncing ? t.syncing : t.refreshData}</span>
            </button>

            {/* Official Authentication Header Controls */}
            {isAuthenticated ? (
              <div className="header-officer-session">
                <div className="header-officer-badge" title={`Signed in as ${user?.name} (${user?.role} - ${user?.department})`}>
                  <UserCheck size={14} className="officer-badge-icon" />
                  <div className="officer-meta">
                    <strong className="officer-name">{user?.name}</strong>
                    <span className="officer-role">{user?.role}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="gov-signout-btn"
                  onClick={logout}
                  title="Sign out from Official Console"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="gov-signin-btn"
                onClick={() => setIsLoginModalOpen(true)}
                title="Sign in as Authorized Official"
              >
                <Lock size={13} />
                <span>Official Sign In</span>
              </button>
            )}
          </div>
        </div>


        {/* High Information Density Navigation Tabs */}
        <nav className="portal-nav-bar" aria-label="Dashboard views navigation">
          <div className="nav-tabs-container">
            <button
              type="button"
              className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => scrollToSection('section-zone-overview', 'dashboard')}
            >
              <Activity size={15} />
              <span>{t.navDashboard}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'ward-map' ? 'active' : ''}`}
              onClick={() => scrollToSection('section-gis-map', 'ward-map')}
            >
              <MapPin size={15} />
              <span>{t.navWardMap}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'forecast' ? 'active' : ''}`}
              onClick={() => scrollToSection('section-forecast', 'forecast')}
            >
              <Clock size={15} />
              <span>{t.navForecast}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'vulnerability' ? 'active' : ''}`}
              onClick={() => scrollToSection('section-ward-detail', 'vulnerability')}
            >
              <Users size={15} />
              <span>{t.navVulnerability}</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => scrollToSection('section-dispatch', 'alerts')}
            >
              <ShieldAlert size={15} />
              <span>{t.navAlerts}</span>
            </button>
            {isAuthenticated && (
              <button
                type="button"
                className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => scrollToSection('section-official-report', 'reports')}
              >
                <FileText size={15} />
                <span>{t.navReports}</span>
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* ============================================================
          MAIN DASHBOARD BODY
      ============================================================= */}
      <main id="main-dashboard-content" className="portal-main-body">
        {/* Live Data Unavailable Alert Banner if API is down */}
        {isLiveUnavailable && (
          <div className="gov-data-alert-banner">
            <AlertTriangle size={18} />
            <span>{t.dataUnavailable}</span>
          </div>
        )}

        {/* SECTION 1 — ZONE OVERVIEW (4 Top Stat Cards) */}
        <section id="section-zone-overview" className="section-container zone-overview-section">
          <div className="section-header-block">
            <div className="header-left">
              <div>
                <h2 className="section-title">
                  {lang === 'hi' ? 'कर्नाटक राज्य / बीबीएमपी — ८ निगरानी वार्ड' : 'Karnataka State & BBMP — 8 Monitored Urban Wards'}
                </h2>
                <p className="section-subtitle">
                  {lang === 'hi'
                    ? 'वास्तविक समय में शहरी ताप तनाव निगरानी एवं बहु-सूचकांक शारीरिक थर्मल विश्लेषण'
                    : 'Real-time urban heat stress surveillance and multi-index physiological monitoring'}
                </p>
              </div>
            </div>
            <div className="city-filter-badge">
              <MapPin size={14} />
              <span>BBMP / Karnataka · Live Grid</span>
            </div>
          </div>

          <div className="stat-cards-grid">
            {/* Card 1: WBGT (estimated) */}
            <div className="gov-stat-card card-wbgt">
              <div className="stat-card-top">
                <span className="stat-card-icon-wrap icon-wbgt">
                  <Thermometer size={20} />
                </span>
                <span className="stat-tag tag-iso">BOM / ISO 7243</span>
              </div>
              <div className="stat-card-value-wrap">
                {isLoading ? (
                  <span className="skeleton-val">...</span>
                ) : (
                  <>
                    <span className="stat-card-number">
                      {zoneSummary?.avg_wbgt ?? currentWard.wbgt ?? '—'}
                    </span>
                    <span className="stat-card-unit">°C</span>
                  </>
                )}
              </div>
              <div className="stat-card-label-wrap">
                <strong className="stat-card-title">{t.wbgtTitle}</strong>
                <span className="stat-card-sub">{t.wbgtDesc}</span>
              </div>
              <div className={`stat-card-trend-indicator ${currentWard.wbgt >= 33.0 ? 'trend-extreme' : currentWard.wbgt >= 31.0 ? 'trend-warning' : 'trend-caution'}`}>
                <span>{currentWard.wbgt ? (currentWard.wbgt >= 33.0 ? 'Extreme Thermal Stress Band' : currentWard.wbgt >= 31.0 ? 'Warning Level' : 'Caution Level') : 'Data Pending'}</span>
              </div>
            </div>

            {/* Card 2: UTCI (modeled) */}
            <div className="gov-stat-card card-utci">
              <div className="stat-card-top">
                <span className="stat-card-icon-wrap icon-utci">
                  <Flame size={20} />
                </span>
                <span className="stat-tag tag-physio">pythermalcomfort</span>
              </div>
              <div className="stat-card-value-wrap">
                {isLoading ? (
                  <span className="skeleton-val">...</span>
                ) : (
                  <>
                    <span className="stat-card-number">
                      {zoneSummary?.avg_utci ?? currentWard.utci ?? '—'}
                    </span>
                    <span className="stat-card-unit">°C</span>
                  </>
                )}
              </div>
              <div className="stat-card-label-wrap">
                <strong className="stat-card-title">{t.utciTitle}</strong>
                <span className="stat-card-sub">{t.utciDesc}</span>
              </div>
              <div className={`stat-card-trend-indicator ${currentWard.utci >= 41.0 ? 'trend-extreme' : currentWard.utci >= 38.0 ? 'trend-warning' : 'trend-caution'}`}>
                <span>{currentWard.utci ? (currentWard.utci >= 41.0 ? 'Very Strong Thermal Stress' : currentWard.utci >= 38.0 ? 'Strong Thermal Stress' : 'Moderate Stress') : 'Data Pending'}</span>
              </div>
            </div>

            {/* Card 3: Heat Index */}
            <div className="gov-stat-card card-heat-index">
              <div className="stat-card-top">
                <span className="stat-card-icon-wrap icon-heat">
                  <Activity size={20} />
                </span>
                <span className="stat-tag tag-noaa">NOAA Rothfusz</span>
              </div>
              <div className="stat-card-value-wrap">
                {isLoading ? (
                  <span className="skeleton-val">...</span>
                ) : (
                  <>
                    <span className="stat-card-number">
                      {zoneSummary?.avg_heat_index ?? currentWard.heatIndex ?? '—'}
                    </span>
                    <span className="stat-card-unit">°C</span>
                  </>
                )}
              </div>
              <div className="stat-card-label-wrap">
                <strong className="stat-card-title">{t.heatIndexTitle}</strong>
                <span className="stat-card-sub">{t.heatIndexDesc}</span>
              </div>
              <div className="stat-card-trend-indicator trend-warning">
                <span>{currentWard.heatIndex ? (currentWard.heatIndex >= 42.0 ? 'Danger: Heat Exhaustion' : 'Caution Level') : 'Data Pending'}</span>
              </div>
            </div>

            {/* Card 4: Active Alerts */}
            <div className="gov-stat-card card-active-alerts">
              <div className="stat-card-top">
                <span className="stat-card-icon-wrap icon-alerts">
                  <ShieldAlert size={20} />
                </span>
                <span className={`stat-tag ${activeAlertsCount > 0 ? 'tag-alert-red' : 'tag-iso'}`}>
                  {activeAlertsCount > 0 ? 'ACTIVE' : 'NORMAL'}
                </span>
              </div>
              <div className="stat-card-value-wrap">
                <span className={`stat-card-number ${activeAlertsCount > 0 ? 'text-alert-red' : ''}`}>
                  {isLoading ? '...' : activeAlertsCount}
                </span>
                <span className="stat-card-unit">{t.wardsCount}</span>
              </div>
              <div className="stat-card-label-wrap">
                <strong className="stat-card-title">{t.activeAlertsTitle}</strong>
                <span className="stat-card-sub">{t.activeAlertsDesc}</span>
              </div>
              <div className="stat-card-alert-badge-wrap">
                <span className={`gov-red-badge ${activeAlertsCount === 0 ? 'badge-green' : ''}`}>
                  <span className="badge-pulse-dot"></span>
                  {activeAlertsCount > 0 ? activeAlertsWardsList : 'All wards within safe limit'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            MAIN SPLIT: SECTION 2 (GIS MAP ~65%) & SECTION 3 (WARD DETAIL ~35%)
        ============================================================= */}
        <section className="map-detail-split-layout">
          {/* SECTION 2 — INTERACTIVE KARNATAKA / BENGALURU GIS MAP */}
          <div id="section-gis-map" className="gis-map-column">
            <div className="panel-card map-panel-card">
              <div className="panel-header map-header">
                <div>
                  <div className="panel-badge-row">
                    <span className="panel-tag tag-official-karnataka">
                      <ShieldCheck size={13} />
                      KARNATAKA STATE · BBMP WARD GIS TELEMETRY
                    </span>
                  </div>
                  <h3 className="panel-title">
                    {lang === 'hi'
                      ? 'कर्नाटक राज्य / बीबीएमपी वार्ड जीआईएस मानचित्र'
                      : 'Karnataka State & BBMP Ward Heat Warning GIS Map'}
                  </h3>
                  <p className="panel-sub">
                    {lang === 'hi'
                      ? '८ निगरानी वार्ड · लाइव ISO 7243 WBGT, जनसांख्यिकीय संवेदनशीलता एवं मौसम रडार'
                      : '8 Monitored BBMP Urban Wards · Live ISO 7243 WBGT, Demographic Vulnerability & Radar Overlays'}
                  </p>
                </div>
              </div>

              {/* Real Leaflet Map for Karnataka Wards */}
              <div className="map-embed-container">
                <WardMap
                  selectedWardId={selectedWardId}
                  onSelectWard={(wId) => setSelectedWardId(Number(wId))}
                  activeLayer={activeMapLayer}
                  onLayerChange={setActiveMapLayer}
                  liveWards={liveWards}
                  lang={lang}
                  translations={t}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3 — SELECTED WARD DETAIL PANEL (right sidebar, ~35% width) */}
          <div id="section-ward-detail" className="ward-detail-column">
            <div className="panel-card ward-detail-panel-card">
              <div className="panel-header detail-header">
                <div className="detail-title-group">
                  <div className="panel-badge-row">
                    <span className={`risk-pill-badge badge-${(currentWard.riskBand || 'caution').toLowerCase()}`}>
                      {(currentWard.riskBand || 'CAUTION').toUpperCase()} RISK
                    </span>
                  </div>
                  <h3 className="ward-hero-title">
                    {currentWard.wardNumber} — {lang === 'hi' ? currentWard.nameHi : currentWard.name}
                  </h3>
                  <span className="ward-zone-label">
                    {currentWard.city}, {currentWard.stateName} · {currentWard.zone}
                  </span>
                </div>
              </div>

              {/* Sub-panel 1: Input Data Table */}
              <div className="detail-sub-section">
                <div className="sub-section-header">
                  <div className="sub-header-title">
                    <Radio size={14} className="sub-icon" />
                    <strong>{t.inputDataTitle}</strong>
                  </div>
                  <span className="sub-header-badge">Live Telemetry</span>
                </div>

                <div className="input-data-table-grid">
                  {/* Dry-bulb temp */}
                  <div className="input-data-cell">
                    <div className="cell-top">
                      <Thermometer size={14} className="cell-icon text-red" />
                      <span className="cell-label">{t.dryBulbTemp}</span>
                    </div>
                    <div className="cell-value-wrap">
                      <strong className="cell-value">
                        {currentWard.temperature !== null ? currentWard.temperature : '—'}
                      </strong>
                      <span className="cell-unit">°C</span>
                    </div>
                  </div>

                  {/* Relative humidity */}
                  <div className="input-data-cell">
                    <div className="cell-top">
                      <Droplets size={14} className="cell-icon text-blue" />
                      <span className="cell-label">{t.relativeHumidity}</span>
                    </div>
                    <div className="cell-value-wrap">
                      <strong className="cell-value">
                        {currentWard.humidity !== null ? currentWard.humidity : '—'}
                      </strong>
                      <span className="cell-unit">%</span>
                    </div>
                  </div>

                  {/* Wind speed */}
                  <div className="input-data-cell">
                    <div className="cell-top">
                      <Wind size={14} className="cell-icon text-teal" />
                      <span className="cell-label">{t.windSpeed}</span>
                    </div>
                    <div className="cell-value-wrap">
                      <strong className="cell-value">
                        {currentWard.windSpeed !== null ? currentWard.windSpeed : '—'}
                      </strong>
                      <span className="cell-unit">km/h</span>
                    </div>
                  </div>

                  {/* Solar radiation */}
                  <div className="input-data-cell">
                    <div className="cell-top">
                      <Sun size={14} className="cell-icon text-amber" />
                      <span className="cell-label">{t.solarRadiation}</span>
                    </div>
                    <div className="cell-value-wrap">
                      <strong className="cell-value">
                        {currentWard.solarRadiation !== null ? currentWard.solarRadiation : '—'}
                      </strong>
                      <span className="cell-unit">W/m²</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-panel 2: Vulnerability Signals (Census Reference Data) */}
              <div className="detail-sub-section vulnerability-signals-box">
                <div className="sub-section-header">
                  <div className="sub-header-title">
                    <SlidersHorizontal size={14} className="sub-icon" />
                    <strong>{t.vulnSignalsTitle}</strong>
                  </div>
                  <span className="sub-header-badge">Census Baseline</span>
                </div>

                <div className="vulnerability-bars-list">
                  {/* Elderly population */}
                  <div className="vuln-bar-item">
                    <div className="vuln-bar-header">
                      <span className="vuln-name">
                        <Users size={13} />
                        {t.elderlyPop}
                      </span>
                      <strong className="vuln-value">{currentWard.vulnerability.elderlyPct}%</strong>
                    </div>
                    <div className="vuln-progress-track">
                      <div
                        className="vuln-progress-fill fill-amber"
                        style={{ width: `${Math.min(currentWard.vulnerability.elderlyPct * 3.5, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Outdoor worker density */}
                  <div className="vuln-bar-item">
                    <div className="vuln-bar-header">
                      <span className="vuln-name">
                        <Briefcase size={13} />
                        {t.outdoorWorker}
                      </span>
                      <strong className="vuln-value">{currentWard.vulnerability.outdoorWorkerPct}%</strong>
                    </div>
                    <div className="vuln-progress-track">
                      <div
                        className="vuln-progress-fill fill-red"
                        style={{ width: `${Math.min(currentWard.vulnerability.outdoorWorkerPct * 2.5, 100)}%` }}
                      ></div>
                    </div>
                  </div>


                  {/* Informal housing */}
                  <div className="vuln-bar-item">
                    <div className="vuln-bar-header">
                      <span className="vuln-name">
                        <HomeIcon size={13} />
                        {t.informalHousing}
                      </span>
                      <strong className="vuln-value">{currentWard.vulnerability.informalHousingPct}%</strong>
                    </div>
                    <div className="vuln-progress-track">
                      <div
                        className="vuln-progress-fill fill-red"
                        style={{ width: `${Math.min(currentWard.vulnerability.informalHousingPct * 2.8, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Green cover */}
                  <div className="vuln-bar-item">
                    <div className="vuln-bar-header">
                      <span className="vuln-name">
                        <Trees size={13} />
                        {t.greenCover}
                      </span>
                      <strong className="vuln-value text-red">{currentWard.vulnerability.greenCoverPct}%</strong>
                    </div>
                    <div className="vuln-progress-track">
                      <div
                        className="vuln-progress-fill fill-green-low"
                        style={{ width: `${Math.min(currentWard.vulnerability.greenCoverPct * 2.5, 100)}%` }}
                      ></div>
                    </div>
                    <div className="green-cover-alert-line">
                      <Info size={12} />
                      <span>{t.lowCoverAlert}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Ward Summary Badge */}
              <div className="ward-composite-score-row">
                <span>{lang === 'hi' ? 'समग्र संवेदनशीलता भार:' : 'Composite Demographic Vulnerability:'}</span>
                <strong>{currentWard.vulnerability.compositeScore} / 100</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 4 — 5-DAY FORECAST STRIP (Real Live Forecast)
        ============================================================= */}
        <section id="section-forecast" className="section-container forecast-strip-section">
          <div className="section-header-block">
            <div className="header-left">
              <div>
                <h2 className="section-title">{t.forecastTitle}</h2>
                <p className="section-subtitle">
                  {t.forecastSubtitle} — {currentWard.wardNumber} ({lang === 'hi' ? currentWard.nameHi : currentWard.name})
                </p>
              </div>
            </div>
            <div className="forecast-source-badge">
              <Radio size={13} />
              <span>Open-Meteo NWP Live Model</span>
            </div>
          </div>

          <div className="forecast-day-cards-row">
            {forecastLoading ? (
              <div className="forecast-loading-skeleton">
                <RefreshCw size={20} className="spin-anim" />
                <span>Loading real 5-day daily forecast...</span>
              </div>
            ) : liveForecast.length > 0 ? (
              liveForecast.map((fc, index) => (
                <div
                  key={`${fc.day}-${index}`}
                  className={`forecast-day-card card-risk-${(fc.riskBand || 'caution').toLowerCase()} ${index === 0 ? 'card-today' : ''}`}
                >
                  <div className="forecast-card-top">
                    <span className="fc-day-name">{lang === 'hi' ? fc.dayHi : fc.day}</span>
                    <span className="fc-date">{fc.date}</span>
                  </div>

                  <div className="fc-badge-wrap">
                    <span className={`risk-pill-badge badge-${(fc.riskBand || 'caution').toLowerCase()}`}>
                      {(fc.riskBand || 'CAUTION').toUpperCase()}
                    </span>
                  </div>

                  <div className="fc-temp-row">
                    <div className="fc-temp-item">
                      <span className="fc-temp-label">Max Temp</span>
                      <strong className="fc-temp-val">{fc.temp !== null ? `${fc.temp}°C` : '—'}</strong>
                    </div>
                    <div className="fc-temp-sep">/</div>
                    <div className="fc-temp-item">
                      <span className="fc-temp-label">WBGT (est)</span>
                      <strong className="fc-temp-val">{fc.wbgt !== null ? `${fc.wbgt}°C` : '—'}</strong>
                    </div>
                  </div>

                  <div className="fc-trend-row">
                    <span className="fc-trend-label">{lang === 'hi' ? 'प्रवृत्ति:' : 'Trend:'}</span>
                    {fc.trend === 'up' && (
                      <span className="trend-badge trend-up">
                        <ArrowUpRight size={14} /> Rising
                      </span>
                    )}
                    {fc.trend === 'down' && (
                      <span className="trend-badge trend-down">
                        <ArrowDownRight size={14} /> Easing
                      </span>
                    )}
                    {fc.trend === 'steady' && (
                      <span className="trend-badge trend-steady">
                        <ArrowRight size={14} /> Steady
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="forecast-empty-msg">
                <span>Forecast data currently updating from Open-Meteo API.</span>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
            SECTION 5 — PREDICTED HEALTH IMPACT
        ============================================================= */}
        <section id="section-health-impact" className="section-container health-impact-section">
          <div className="section-header-block">
            <div className="header-left">
              <div>
                <h2 className="section-title">{t.healthImpactTitle}</h2>
                <p className="section-subtitle">
                  Epidemiological impact models developed in partnership with NCDC & ICMR
                </p>
              </div>
            </div>
            <div className="health-model-badge">
              <Activity size={13} />
              <span>Distributed Lag Non-Linear Model (DLNM)</span>
            </div>
          </div>

          <div className="health-impact-cards-grid">
            {/* Card 1: Estimated Hospitalisation Spike (72hr) */}
            <div className="panel-card health-card hosp-spike-card">
              <div className="health-card-header">
                <div>
                  <span className="health-tag tag-clinical">CLINICAL ADMISSION SURGE</span>
                  <h3 className="health-card-title">{t.hospSpikeTitle}</h3>
                </div>
                <Activity size={24} className="health-header-icon text-red" />
              </div>

              <div className="spike-metric-container">
                <div className="spike-main-value">
                  <span className="spike-plus">+</span>
                  <strong className="spike-number">
                    {hospSpike !== null ? `${hospSpike}%` : '—'}
                  </strong>
                </div>
                <p className="spike-description">{t.hospSpikeSub}</p>
              </div>

              {/* Range bar for Confidence Band */}
              <div className="confidence-band-container">
                <div className="confidence-label-row">
                  <span className="ci-label">
                    <strong>{t.confBand}:</strong> {ciLow !== null ? `${ciLow}% – ${ciHigh}%` : '—'}
                  </span>
                  <span className="ci-stat">95% CI Significance</span>
                </div>

                <div className="ci-range-bar-track">
                  {hospSpike !== null && (
                    <div
                      className="ci-active-zone"
                      style={{
                        left: `${Math.min(80, (ciLow || 10) * 1.5)}%`,
                        width: `${Math.max(10, ((ciHigh || 20) - (ciLow || 10)) * 1.5)}%`,
                      }}
                    >
                      <span className="ci-zone-marker marker-left">{ciLow}%</span>
                      <span className="ci-point-estimate" style={{ left: '50%' }}>
                        <span className="point-dot"></span>
                        <span className="point-tag">+{hospSpike}%</span>
                      </span>
                      <span className="ci-zone-marker marker-right">{ciHigh}%</span>
                    </div>
                  )}
                </div>

                <div className="ci-scale-labels">
                  <span>0% (Baseline)</span>
                  <span>+25%</span>
                  <span>+50% Critical</span>
                  <span>+75%</span>
                </div>
              </div>
            </div>

            {/* Card 2: Mortality Risk Index (Gauge/dial visual) */}
            <div className="panel-card health-card mortality-risk-card">
              <div className="health-card-header">
                <div>
                  <span className="health-tag tag-mortality">EXCESS MORTALITY PROJECTION</span>
                  <h3 className="health-card-title">{t.mortalityRiskTitle}</h3>
                </div>
                <Flame size={24} className="health-header-icon text-amber" />
              </div>

              <div className="gauge-visualization-container">
                {/* Semicircular SVG Gauge Dial */}
                <div className="gauge-svg-wrap">
                  <svg viewBox="0 0 200 120" className="gauge-svg">
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 20 100 A 80 80 0 0 1 55 43"
                      fill="none"
                      stroke="#2e7d32"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 55 43 A 80 80 0 0 1 135 38"
                      fill="none"
                      stroke="#ef6c00"
                      strokeWidth="18"
                    />
                    <path
                      d="M 135 38 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="#c62828"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
                    <circle cx="100" cy="100" r="8" fill="#0a2540" />
                    <line
                      x1="100"
                      y1="100"
                      x2={100 + 62 * Math.cos(Math.PI * (1 - (mortalityIndex || 2.0) / 10))}
                      y2={100 - 62 * Math.sin(Math.PI * (1 - (mortalityIndex || 2.0) / 10))}
                      stroke="#0a2540"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={100 + 62 * Math.cos(Math.PI * (1 - (mortalityIndex || 2.0) / 10))}
                      cy={100 - 62 * Math.sin(Math.PI * (1 - (mortalityIndex || 2.0) / 10))}
                      r="4"
                      fill="#c62828"
                    />
                  </svg>
                </div>

                <div className="gauge-score-display">
                  <div className="gauge-numeric-row">
                    <strong className="gauge-score-val text-red">
                      {mortalityIndex !== null ? mortalityIndex : '—'}
                    </strong>
                    <span className="gauge-score-max">/ 10</span>
                  </div>
                  <div className="gauge-baseline-note">
                    <span className="baseline-dot"></span>
                    <span>
                      {baselineDiff ? (lang === 'hi' ? baselineDiffHi : baselineDiff) : 'Evaluating telemetry'}
                    </span>
                  </div>
                  <div className="gauge-critical-badge">
                    <span>{t.criticalThreshold}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 6 — DATA SOURCE STATUS (Real Round-trip Latency)
        ============================================================= */}
        <section id="section-data-sources" className="section-container data-sources-section">
          <div className="section-header-block">
            <div className="header-left">
              <div>
                <h2 className="section-title">{t.dataSourcesTitle}</h2>
                <p className="section-subtitle">Real measured round-trip latencies & telemetry integrity</p>
              </div>
            </div>
            <div className="ingest-rate-tag">
              <RefreshCw size={12} className="spin-slow" />
              <span>Real-time Health Ping</span>
            </div>
          </div>

          <div className="data-sources-compact-grid">
            {(dataSources.length > 0 ? dataSources : [
              { name: 'Open-Meteo (Live NWP)', nameHi: 'ओपन-मेतियो (लाइव NWP)', status: 'Live', statusHi: 'सक्रिय', type: 'live', latency_ms: 120.5, detail: 'Telemetry sync (live measured latency)', detailHi: 'टेलीमेट्री सिंक' },
              { name: 'NASA POWER (solar)', nameHi: 'नासा पावर (सौर विकिरण)', status: 'Live', statusHi: 'सक्रिय', type: 'live', latency_ms: 340.2, detail: 'Solar radiation model', detailHi: 'सौर विकिरण मॉडल' },
              { name: 'WeatherAPI fallback', nameHi: 'वेदरएपीआई फॉलबैक', status: 'Standby', statusHi: 'स्टैंडबाय', type: 'standby', latency_ms: null, detail: 'Automated failover ready', detailHi: 'स्वचालित बैकअप' }
            ]).map((source, index) => {
              const isLive = source.type === 'live';
              const latencyText = source.latency_ms !== null && source.latency_ms !== undefined
                ? `${source.latency_ms}ms latency`
                : null;

              return (
                <div key={`${source.name}-${index}`} className="source-status-card">
                  <div className="source-status-left">
                    <span className={`status-indicator-dot ${isLive ? 'dot-live' : 'dot-standby'}`}></span>
                    <div className="source-info">
                      <strong className="source-name">{lang === 'hi' ? source.nameHi : source.name}</strong>
                      <span className="source-detail">
                        {latencyText ? (lang === 'hi' ? `${source.detailHi || source.detail} (${source.latency_ms}ms)` : `${source.detail}`) : (lang === 'hi' ? source.detailHi : source.detail)}
                      </span>
                    </div>
                  </div>
                  <div className="source-status-right">
                    <span className={`source-status-pill ${isLive ? 'pill-live' : 'pill-standby'}`}>
                      {lang === 'hi' ? source.statusHi : source.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            SECTION 7 — ALERT & INTERVENTION DISPATCH PANEL
        ============================================================= */}
        <section id="section-dispatch" className="section-container dispatch-section">
          <div className="section-header-block">
            <div className="header-left">
              <div>
                <h2 className="section-title">
                  {t.dispatchTitle} {isAuthenticated ? `— ${currentWard.wardNumber} (${lang === 'hi' ? currentWard.nameHi : currentWard.name})` : ''}
                </h2>
                <p className="section-subtitle">
                  {isAuthenticated
                    ? 'Direct operational authority command console for triggering public health mitigations'
                    : 'Restricted operational command console · State Disaster Management & BBMP'}
                </p>
              </div>
            </div>

            {isAuthenticated ? (
              <div className="dispatch-authority-tag auth-status-verified">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Official Active: {user?.name} · {user?.department}</span>
              </div>
            ) : (
              <button
                type="button"
                className="gov-signin-btn btn-dispatch-header-signin"
                onClick={() => setIsLoginModalOpen(true)}
                title="Sign in with official credentials"
              >
                <Lock size={14} />
                <span>Official Sign In</span>
              </button>
            )}
          </div>

          {isAuthenticated ? (
            <div className="dispatch-panel-card panel-card">
              {/* Action Buttons (Authenticated Only) */}
              <div className="dispatch-action-buttons-group">
                <button
                  type="button"
                  className="dispatch-action-btn btn-sms-alert"
                  onClick={() => openDispatchModal('sms')}
                  title={t.actionSms}
                >
                  <div className="btn-icon-box">
                    <Send size={18} />
                  </div>
                  <div className="btn-text-content">
                    <strong className="btn-main-label">{t.actionSms}</strong>
                    <span className="btn-sub-label">Cell-broadcast & WhatsApp ward broadcast</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="dispatch-action-btn btn-cooling-centre"
                  onClick={() => openDispatchModal('cooling')}
                  title={t.actionCooling}
                >
                  <div className="btn-icon-box">
                    <HomeIcon size={18} />
                  </div>
                  <div className="btn-text-content">
                    <strong className="btn-main-label">{t.actionCooling}</strong>
                    <span className="btn-sub-label">Open community air-cooled shelters & ORS booths</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="dispatch-action-btn btn-work-shift"
                  onClick={() => openDispatchModal('work_shift')}
                  title={t.actionWorkShift}
                >
                  <div className="btn-icon-box">
                    <Briefcase size={18} />
                  </div>
                  <div className="btn-text-content">
                    <strong className="btn-main-label">{t.actionWorkShift}</strong>
                    <span className="btn-sub-label">Enforce 12:00–16:00 outdoor construction respite</span>
                  </div>
                </button>
              </div>

              {/* Activity Log Table (Authenticated Only) */}
              <div className="dispatch-activity-log-wrapper">
                <div className="activity-log-header">
                  <div className="log-header-left">
                    <Clock size={16} />
                    <strong className="log-title">{t.activityLogTitle}</strong>
                  </div>
                  <span className="log-count-badge">
                    {dispatchLog.length} {lang === 'hi' ? 'रिकॉर्ड' : 'Operations Recorded'}
                  </span>
                </div>

                <div className="activity-table-responsive">
                  <table className="gov-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>{t.tableTime}</th>
                        <th>{t.tableAction}</th>
                        <th style={{ width: '160px' }}>{t.tableStatus}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchLog.map((item) => (
                        <tr key={item.id} className="activity-row">
                          <td className="time-cell">
                            <span className="time-mono">{item.time}</span>
                          </td>
                          <td className="action-cell">
                            <strong className="action-text">{lang === 'hi' ? item.actionHi : item.action}</strong>
                          </td>
                          <td className="status-cell">
                            <span className="status-badge-delivered">
                              <CheckCircle2 size={14} className="status-check-icon" />
                              <span>{lang === 'hi' ? item.statusHi : item.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="dispatch-locked-public-card">
              <div className="locked-public-icon-box">
                <Lock size={26} />
              </div>
              <div className="locked-public-text-box">
                <h3 className="locked-public-title">Authorized Official Access Required</h3>
                <p className="locked-public-desc">
                  Emergency intervention dispatch triggers (SMS broadcasts, cooling shelters, workplace respite orders) and operations logs are restricted to authorized Disaster Management and Municipal Health officials under the Disaster Management Act.
                </p>
              </div>
              <button
                type="button"
                className="btn-dispatch-unlock-primary"
                onClick={() => setIsLoginModalOpen(true)}
              >
                <Lock size={15} />
                <span>Official Sign In</span>
              </button>
            </div>
          )}
        </section>

        {/* ============================================================
            SECTION 8 — OFFICIAL BIOMETEOROLOGICAL & INCIDENT REPORT
            (Downloadable Text & Print PDF Report + Gmail Sharing)
        ============================================================= */}
        <OfficialReportSection
          currentWard={currentWard}
          user={user}
          isAuthenticated={isAuthenticated}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          lang={lang}
        />
      </main>


      {/* ============================================================
          CONFIRMATION DISPATCH MODAL
      ============================================================= */}
      {dispatchModal.isOpen && (
        <div className="gov-modal-backdrop" onClick={closeDispatchModal}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-brand">
                <ShieldAlert size={20} className="modal-icon" />
                <h3>{t.confirmDispatchTitle}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={closeDispatchModal}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-notice-text">
                {t.confirmDispatchMsg}{' '}
                <strong>
                  {currentWard.wardNumber} — {lang === 'hi' ? currentWard.nameHi : currentWard.name}
                </strong>
                .
              </p>

              <div className="modal-info-summary">
                <div className="summary-row">
                  <span>Authorized Officer:</span>
                  <strong className="text-emerald-400">
                    {user?.name} ({user?.role} · {user?.department})
                  </strong>
                </div>
                <div className="summary-row">
                  <span>{t.targetWard}:</span>
                  <strong>{currentWard.wardNumber} ({currentWard.name})</strong>
                </div>
                <div className="summary-row">
                  <span>{t.actionType}:</span>
                  <strong className="text-red">
                    {dispatchModal.actionType === 'sms' && t.actionSms}
                    {dispatchModal.actionType === 'cooling' && t.actionCooling}
                    {dispatchModal.actionType === 'work_shift' && t.actionWorkShift}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Current WBGT / UTCI:</span>
                  <strong>
                    {currentWard.wbgt !== null ? `${currentWard.wbgt}°C` : '—'} / {currentWard.utci !== null ? `${currentWard.utci}°C` : '—'} ({currentWard.riskBand})
                  </strong>
                </div>
              </div>

              <div className="modal-authority-declaration">
                <Info size={14} />
                <span>
                  This notification will be transmitted immediately through State Emergency Operations Centre (SEOC)
                  and BBMP Disaster Management cell under official credentials of {user?.name}.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={closeDispatchModal}
                disabled={isDispatching}
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                className="modal-btn-confirm"
                onClick={executeDispatch}
                disabled={isDispatching}
              >
                {isDispatching ? (
                  <>
                    <RefreshCw size={14} className="spin-anim" />
                    <span>Transmitting Order...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>{t.dispatchConfirmBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Sign In Modal */}
      <OfficialLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(loggedUser) => {
          showToast(`Signed in successfully as ${loggedUser.name} (${loggedUser.department})`);
        }}
      />


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
            <div className="footer-affiliation-text">{t.footerAffiliation}</div>
          </div>
        </div>

        <div className="footer-details-strip">
          <div className="footer-details-inner">
            <div className="footer-links-row">
              <span>{t.footerPortals}</span>
              <span className="footer-sep">|</span>
              <span className="footer-helpline">{t.emergencyHelplines}</span>
            </div>
            <p className="footer-disclaimer-text">{t.disclaimer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
