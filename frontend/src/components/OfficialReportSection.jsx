import React, { useState } from 'react';
import {
  FileText,
  Download,
  Mail,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  User,
  Clock,
  Calendar,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Activity,
  Share2,
} from 'lucide-react';
import emblem from '../assets/emblem.png';

export default function OfficialReportSection({
  currentWard,
  user,
  isAuthenticated,
  onOpenLoginModal,
  lang = 'en',
}) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const reportDate = new Date();
  const reportDateStr = reportDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const reportTimeStr = reportDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const reportId = `NDMA-TS-${currentWard?.id ? currentWard.id.toUpperCase() : 'KAR-04'}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const officerName = user?.name || 'Authorized Disaster Management Officer';
  const officerRole = user?.role || 'Municipal Heat Nodal Officer';
  const officerDept = user?.department || 'State Disaster Management Authority (SDMA)';

  const formatReportText = () => {
    return `================================================================================
GOVERNMENT OF INDIA — NATIONAL HEAT STRESS EARLY WARNING SYSTEM (THERMASENSE)
MINISTRY OF EARTH SCIENCES (MoES) · NATIONAL DISASTER MANAGEMENT AUTHORITY (NDMA)
================================================================================
INCIDENT & BIOMETEOROLOGICAL SITUATION REPORT
Report Reference ID : ${reportId}
Date / Time of Issue: ${reportDateStr} ${reportTimeStr} IST
Issuing Authority   : ${officerName} (${officerRole})
Department / Agency : ${officerDept}

1. TARGET ADMINISTRATIVE JURISDICTION
--------------------------------------------------------------------------------
State / UT          : ${currentWard?.stateName || 'Karnataka'}
City / District     : ${currentWard?.city || 'Bengaluru'}
Ward / Locality     : ${currentWard?.wardNumber} — ${currentWard?.name} (${currentWard?.zone})
Coordinates         : Lat ${currentWard?.coordinates?.[0]?.toFixed(4)}°N, Lon ${currentWard?.coordinates?.[1]?.toFixed(4)}°E

2. REAL-TIME BIOMETEOROLOGICAL TELEMETRY
--------------------------------------------------------------------------------
Dry-Bulb Ambient Temperature : ${currentWard?.temperature}°C
Wet-Bulb Globe Temp (WBGT)   : ${currentWard?.wbgt}°C (ISO 7243 Standard)
Universal Thermal Climate (UTCI): ${currentWard?.utci}°C
Heat Index (Apparent Temp)   : ${currentWard?.heatIndex}°C
Relative Humidity            : ${currentWard?.humidity}%
Dew Point / Wet Bulb         : ${currentWard?.dewPoint}°C / ${currentWard?.wetBulb}°C
Wind Velocity                : ${currentWard?.windSpeed} km/h
Barometric Pressure          : ${currentWard?.pressure} hPa
Solar Radiation Flux         : ${currentWard?.solarRadiation} W/m²
Composite Risk Level         : [ ${currentWard?.riskBand?.toUpperCase()} RISK ]

3. DEMOGRAPHIC & SOCIO-ECONOMIC VULNERABILITY MATRIX
--------------------------------------------------------------------------------
Elderly Population (65+ yrs) : ${currentWard?.vulnerability?.elderlyPct}%
Outdoor / Labor Workforce    : ${currentWard?.vulnerability?.outdoorWorkerPct}%
Informal / Tin-Roof Dwellings: ${currentWard?.vulnerability?.informalHousingPct}%
Vegetative Canopy / Tree Cover: ${currentWard?.vulnerability?.greenCoverPct}%
Composite Vulnerability Score: ${currentWard?.vulnerability?.compositeScore} / 100

4. PROJECTED HEALTH & HOSPITAL SURGE IMPACT
--------------------------------------------------------------------------------
Estimated Hospital Admissions Spike : +${Math.round(Math.max(5, (currentWard?.wbgt - 25.0) * 4.2))}%
Emergency Dehydration / Heat Cramps : HIGH SURVEILLANCE
Mandatory Work-Rest Protocol Status : ACTIVE RESPITE ORDER

5. OFFICIAL MUNICIPAL DIRECTIVES & INTERVENTIONS
--------------------------------------------------------------------------------
[X] Public Alert Broadcast   : SMS & WhatsApp Ward Advisory Dispatched
[X] Cooling Centres          : Municipal Shelters Mobilized with Free Clean Drinking Water
[X] Labor Working Hours      : Work Halt Enforced between 12:00 PM and 04:00 PM
[X] Hospital Surge Beds      : ORS Rehydration Corners & Emergency Wards Activated

================================================================================
Generated via ThermaSense High-Resolution NWP & Biometeorological Telemetry Portal
Official Government Document · Authorized for Municipal & Health Department Use
================================================================================`;
  };

  const handleDownloadTxt = () => {
    setGenerating(true);
    setTimeout(() => {
      const text = formatReportText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ThermaSense_Incident_Report_${currentWard?.city}_${currentWard?.wardNumber}_${reportDateStr.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setGenerating(false);
    }, 250);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleShareGmail = () => {
    const subject = `[OFFICIAL HEAT DIRECTIVE] Biometeorological Incident Report — ${currentWard?.city} (${currentWard?.wardNumber}) [${currentWard?.riskBand?.toUpperCase()} RISK]`;
    const body = formatReportText();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(formatReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isAuthenticated) {
    return (
      <section id="section-official-report" className="section-container official-report-section">
        <div className="section-header-block">
          <div className="header-left">
            <div>
              <h2 className="section-title">
                {lang === 'hi'
                  ? 'अधिकारिक बायोमेटियोरोलॉजिकल रिपोर्ट जनरेटर'
                  : 'Official Biometeorological Incident Report'}
              </h2>
              <p className="section-subtitle">
                {lang === 'hi'
                  ? 'आपदा प्रबंधन एवं स्वास्थ्य अधिकारियों के लिए सुरक्षित रिपोर्टिंग कंसोल'
                  : 'Restricted administrative reporting & executive dossier generation'}
              </p>
            </div>
          </div>
        </div>

        <div className="official-report-auth-gate panel-card">
          <ShieldCheck size={36} className="text-gov-navy-600 mb-2" />
          <h3>{lang === 'hi' ? 'अधिकारिक लॉगिन आवश्यक' : 'Official Authentication Required'}</h3>
          <p>
            {lang === 'hi'
              ? 'आधिकारिक रिपोर्ट डाउनलोड करने, प्रिंट करने एवं जीमेल के माध्यम से साझा करने के लिए कृपया आपदा प्रबंधन क्रेडेंशियल्स के साथ साइन इन करें।'
              : 'Downloadable government reports and executive email dispatch are restricted to verified State Disaster Management & Municipal Health Nodal Officers.'}
          </p>
          <button
            type="button"
            className="gov-signin-btn mt-3"
            onClick={onOpenLoginModal}
          >
            {lang === 'hi' ? 'अधिकारिक साइन इन' : 'Official Sign In to Generate Reports'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="section-official-report" className="section-container official-report-section">
      <div className="section-header-block">
        <div className="header-left">
          <div>
            <h2 className="section-title">
              {lang === 'hi'
                ? `अधिकारिक बायोमेटियोरोलॉजिकल रिपोर्ट — ${currentWard?.wardNumber}`
                : `Official Biometeorological Incident Report — ${currentWard?.wardNumber} (${currentWard?.city})`}
            </h2>
            <p className="section-subtitle">
              {lang === 'hi'
                ? 'राष्ट्रीय आपदा प्रबंधन दिशानिर्देशों के तहत तत्काल डाउनलोड एवं जीमेल डिस्पैच'
                : 'Executive incident dossier for District Magistrates, Health Commissioners & Municipal Command'}
            </p>
          </div>
        </div>

        <div className="report-action-buttons">
          <button
            type="button"
            className="report-btn btn-gmail"
            onClick={handleShareGmail}
            title="Compose and share report directly via Gmail"
          >
            <Mail size={15} className="text-red-500" />
            <span>Share via Gmail</span>
          </button>

          <button
            type="button"
            className="report-btn btn-download-doc"
            onClick={handleDownloadTxt}
            disabled={generating}
            title="Download official text report"
          >
            <Download size={15} />
            <span>{generating ? 'Generating...' : 'Download Report (.txt)'}</span>
          </button>

          <button
            type="button"
            className="report-btn btn-print-doc"
            onClick={handlePrintPdf}
            title="Print or save official report as PDF"
          >
            <Printer size={15} />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            className="report-btn btn-copy-doc"
            onClick={handleCopyClipboard}
            title="Copy report text to clipboard"
          >
            <Share2 size={15} />
            <span>{copied ? 'Copied ✓' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Official Formatted Report Preview Card */}
      <div className="official-report-dossier panel-card">
        {/* Header Strip */}
        <div className="dossier-top-brand">
          <div className="dossier-emblem-lockup">
            <img src={emblem} alt="State Emblem" className="dossier-emblem" />
            <div>
              <strong className="dossier-gov-title">GOVERNMENT OF INDIA</strong>
              <span className="dossier-gov-sub">Ministry of Earth Sciences · National Disaster Management Authority</span>
            </div>
          </div>

          <div className="dossier-meta-badge">
            <span className="dossier-ref-tag">REF: {reportId}</span>
            <span className="dossier-time-tag">
              <Calendar size={12} /> {reportDateStr} · <Clock size={12} /> {reportTimeStr} IST
            </span>
          </div>
        </div>

        <div className="dossier-body">
          {/* Executive Officer Lockup */}
          <div className="dossier-officer-strip">
            <div className="officer-field">
              <span className="field-label">Issuing Authority:</span>
              <strong className="field-val">{officerName}</strong>
            </div>
            <div className="officer-field">
              <span className="field-label">Designation:</span>
              <span className="field-val">{officerRole}</span>
            </div>
            <div className="officer-field">
              <span className="field-label">Department:</span>
              <span className="field-val">{officerDept}</span>
            </div>
            <div className="officer-field">
              <span className="field-label">Target Locality:</span>
              <strong className="field-val text-gov-navy-900">
                {currentWard?.wardNumber} — {currentWard?.name} ({currentWard?.city}, {currentWard?.stateName})
              </strong>
            </div>
          </div>

          {/* Telemetry Summary Grid */}
          <div className="dossier-section">
            <h4 className="dossier-section-title">
              <Activity size={14} className="text-sky-600" />
              <span>1. Validated Biometeorological Readings</span>
            </h4>
            <div className="dossier-metrics-grid">
              <div className="dossier-metric-box">
                <span className="metric-box-label">Dry-Bulb Ambient</span>
                <strong className="metric-box-val text-red-600">{currentWard?.temperature}°C</strong>
              </div>
              <div className="dossier-metric-box">
                <span className="metric-box-label">WBGT Heat Stress</span>
                <strong className="metric-box-val text-amber-600">{currentWard?.wbgt}°C</strong>
              </div>
              <div className="dossier-metric-box">
                <span className="metric-box-label">Heat Index</span>
                <strong className="metric-box-val text-orange-600">{currentWard?.heatIndex}°C</strong>
              </div>
              <div className="dossier-metric-box">
                <span className="metric-box-label">Relative Humidity</span>
                <strong className="metric-box-val text-sky-600">{currentWard?.humidity}%</strong>
              </div>
              <div className="dossier-metric-box">
                <span className="metric-box-label">Wind Velocity</span>
                <strong className="metric-box-val text-indigo-600">{currentWard?.windSpeed} km/h</strong>
              </div>
              <div className="dossier-metric-box">
                <span className="metric-box-label">Solar Radiation</span>
                <strong className="metric-box-val text-yellow-600">{currentWard?.solarRadiation} W/m²</strong>
              </div>
            </div>
          </div>

          {/* Vulnerability & Directives Grid */}
          <div className="dossier-two-col-grid">
            <div className="dossier-col-card">
              <h4 className="dossier-section-title">
                <AlertTriangle size={14} className="text-amber-600" />
                <span>2. Vulnerability & Surge Forecast</span>
              </h4>
              <ul className="dossier-list">
                <li>
                  <span>Elderly Demographics (65+ yrs):</span>
                  <strong>{currentWard?.vulnerability?.elderlyPct}%</strong>
                </li>
                <li>
                  <span>Outdoor & Informal Labor Density:</span>
                  <strong>{currentWard?.vulnerability?.outdoorWorkerPct}%</strong>
                </li>
                <li>
                  <span>Informal / Low-Canopy Dwellings:</span>
                  <strong>{currentWard?.vulnerability?.informalHousingPct}%</strong>
                </li>
                <li>
                  <span>Projected Emergency Hospital Surge:</span>
                  <strong className="text-red-600">
                    +{Math.round(Math.max(5, (currentWard?.wbgt - 25.0) * 4.2))}% admissions
                  </strong>
                </li>
              </ul>
            </div>

            <div className="dossier-col-card">
              <h4 className="dossier-section-title">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>3. Active Executive Directives</span>
              </h4>
              <ul className="dossier-directives-list">
                <li>
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Emergency Cell-Broadcast & WhatsApp advisory issued</span>
                </li>
                <li>
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Municipal Cooling Shelters activated with free clean water</span>
                </li>
                <li>
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Work-rest schedule mandated for construction/outdoor labor</span>
                </li>
                <li>
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>Hospital ORS corners and heat stroke beds prepared</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Dossier Footer */}
        <div className="dossier-footer">
          <span>This electronic incident document is officially signed and generated via ThermaSense Early Warning Engine.</span>
          <div className="dossier-footer-actions">
            <button type="button" className="dossier-quick-share-btn" onClick={handleShareGmail}>
              <Mail size={13} /> Compose in Gmail
            </button>
            <button type="button" className="dossier-quick-download-btn" onClick={handleDownloadTxt}>
              <Download size={13} /> Download .txt
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
