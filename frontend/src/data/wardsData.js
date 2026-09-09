// Static reference metadata & demographic census data for ThermaSense
// Ministry of Earth Sciences / NDMA, Government of India
// Bengaluru Urban — 8 Monitored Wards (Vulnerability baseline & geometries)

export const WARDS_STATIC_METADATA = [
  {
    id: 1,
    wardNumber: 'Ward 1',
    name: 'Malleshwaram',
    nameHi: 'मल्लेश्वरम',
    zone: 'North-West Zone',
    zoneHi: 'उत्तर-पश्चिम क्षेत्र',
    coordinates: [13.003, 77.570],
    vulnerability: {
      elderlyPct: 14.5,
      outdoorWorkerPct: 19.0,
      informalHousingPct: 12.0,
      greenCoverPct: 24.5,
      compositeScore: 28.5,
    },
  },
  {
    id: 2,
    wardNumber: 'Ward 2',
    name: 'Hebbal',
    nameHi: 'हेब्बाल',
    zone: 'North Zone',
    zoneHi: 'उत्तर क्षेत्र',
    coordinates: [13.035, 77.598],
    vulnerability: {
      elderlyPct: 15.8,
      outdoorWorkerPct: 26.4,
      informalHousingPct: 21.5,
      greenCoverPct: 16.2,
      compositeScore: 48.2,
    },
  },
  {
    id: 3,
    wardNumber: 'Ward 3',
    name: 'Rajajinagar',
    nameHi: 'राजाजीनगर',
    zone: 'West Zone',
    zoneHi: 'पश्चिम क्षेत्र',
    coordinates: [12.990, 77.555],
    vulnerability: {
      elderlyPct: 17.1,
      outdoorWorkerPct: 28.5,
      informalHousingPct: 23.0,
      greenCoverPct: 11.5,
      compositeScore: 56.4,
    },
  },
  {
    id: 4,
    wardNumber: 'Ward 4',
    name: 'Shivajinagar',
    nameHi: 'शिवाजीनगर',
    zone: 'Central Zone',
    zoneHi: 'केंद्रीय क्षेत्र',
    coordinates: [12.985, 77.602],
    vulnerability: {
      elderlyPct: 18.2,
      outdoorWorkerPct: 31.0,
      informalHousingPct: 27.0,
      greenCoverPct: 9.0,
      compositeScore: 78.4,
    },
  },
  {
    id: 5,
    wardNumber: 'Ward 5',
    name: 'Shantinagar',
    nameHi: 'शांतिनगर',
    zone: 'South-Central Zone',
    zoneHi: 'दक्षिण-केंद्रीय क्षेत्र',
    coordinates: [12.955, 77.595],
    vulnerability: {
      elderlyPct: 19.4,
      outdoorWorkerPct: 29.8,
      informalHousingPct: 25.4,
      greenCoverPct: 10.2,
      compositeScore: 74.0,
    },
  },
  {
    id: 6,
    wardNumber: 'Ward 6',
    name: 'Koramangala',
    nameHi: 'कोरमंगला',
    zone: 'South-East Zone',
    zoneHi: 'दक्षिण-पूर्व क्षेत्र',
    coordinates: [12.935, 77.625],
    vulnerability: {
      elderlyPct: 16.0,
      outdoorWorkerPct: 24.2,
      informalHousingPct: 18.5,
      greenCoverPct: 17.8,
      compositeScore: 49.5,
    },
  },
  {
    id: 7,
    wardNumber: 'Ward 7',
    name: 'Indiranagar',
    nameHi: 'इन्दिरा नगर',
    zone: 'East Zone',
    zoneHi: 'पूर्व क्षेत्र',
    coordinates: [12.978, 77.642],
    vulnerability: {
      elderlyPct: 15.2,
      outdoorWorkerPct: 18.6,
      informalHousingPct: 10.4,
      greenCoverPct: 22.0,
      compositeScore: 31.2,
    },
  },
  {
    id: 8,
    wardNumber: 'Ward 8',
    name: 'Jayanagar',
    nameHi: 'जयनगर',
    zone: 'South Zone',
    zoneHi: 'दक्षिण क्षेत्र',
    coordinates: [12.928, 77.583],
    vulnerability: {
      elderlyPct: 21.0,
      outdoorWorkerPct: 32.5,
      informalHousingPct: 28.2,
      greenCoverPct: 8.5,
      compositeScore: 81.0,
    },
  }
];

// Fallback empty data structure for wards
export const WARDS_DATA = WARDS_STATIC_METADATA.map((w) => ({
  ...w,
  riskBand: 'Caution',
  riskLevel: 'caution',
  riskScore: null,
  wbgt: null,
  utci: null,
  heatIndex: null,
  environmental: {
    temperature: null,
    humidity: null,
    windSpeed: null,
    solarRadiation: null,
  },
  forecast: [],
  healthImpact: {
    hospitalizationSpike: null,
    ciLow: null,
    ciHigh: null,
    mortalityRiskIndex: null,
    baselineDiff: null,
    baselineDiffHi: null,
  },
}));

// Realistic Bengaluru Urban ward boundary GeoJSON polygons
export const BENGALURU_WARDS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {
        id: 1,
        wardNumber: 'Ward 1',
        name: 'Malleshwaram',
        nameHi: 'मल्लेश्वरम',
        zone: 'North-West',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 28.5,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.552, 12.990],
          [77.585, 12.990],
          [77.585, 13.022],
          [77.552, 13.022],
          [77.552, 12.990]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 2,
      properties: {
        id: 2,
        wardNumber: 'Ward 2',
        name: 'Hebbal',
        nameHi: 'हेब्बाल',
        zone: 'North',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 48.2,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.585, 13.015],
          [77.625, 13.015],
          [77.625, 13.055],
          [77.585, 13.055],
          [77.585, 13.015]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 3,
      properties: {
        id: 3,
        wardNumber: 'Ward 3',
        name: 'Rajajinagar',
        nameHi: 'राजाजीनगर',
        zone: 'West',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 56.4,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.530, 12.965],
          [77.568, 12.965],
          [77.568, 13.005],
          [77.530, 13.005],
          [77.530, 12.965]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 4,
      properties: {
        id: 4,
        wardNumber: 'Ward 4',
        name: 'Shivajinagar',
        nameHi: 'शिवाजीनगर',
        zone: 'Central',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 78.4,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.585, 12.968],
          [77.622, 12.968],
          [77.622, 13.005],
          [77.585, 13.005],
          [77.585, 12.968]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 5,
      properties: {
        id: 5,
        wardNumber: 'Ward 5',
        name: 'Shantinagar',
        nameHi: 'शांतिनगर',
        zone: 'South-Central',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 74.0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.575, 12.938],
          [77.615, 12.938],
          [77.615, 12.968],
          [77.575, 12.968],
          [77.575, 12.938]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 6,
      properties: {
        id: 6,
        wardNumber: 'Ward 6',
        name: 'Koramangala',
        nameHi: 'कोरमंगला',
        zone: 'South-East',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 49.5,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.612, 12.915],
          [77.652, 12.915],
          [77.652, 12.955],
          [77.612, 12.955],
          [77.612, 12.915]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 7,
      properties: {
        id: 7,
        wardNumber: 'Ward 7',
        name: 'Indiranagar',
        nameHi: 'इन्दिरा नगर',
        zone: 'East',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 31.2,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.622, 12.955],
          [77.668, 12.955],
          [77.668, 12.998],
          [77.622, 12.998],
          [77.622, 12.955]
        ]]
      }
    },
    {
      type: 'Feature',
      id: 8,
      properties: {
        id: 8,
        wardNumber: 'Ward 8',
        name: 'Jayanagar',
        nameHi: 'जयनगर',
        zone: 'South',
        riskBand: 'Caution',
        riskLevel: 'caution',
        wbgt: null,
        utci: null,
        heatIndex: null,
        vulnerabilityScore: 81.0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [77.560, 12.905],
          [77.608, 12.905],
          [77.608, 12.940],
          [77.560, 12.940],
          [77.560, 12.905]
        ]]
      }
    }
  ]
};

// Initial placeholder data sources list (will be populated dynamically from API)
export const DATA_SOURCES = [
  {
    name: 'Open-Meteo (Live NWP)',
    nameHi: 'ओपन-मेतियो (लाइव NWP)',
    status: 'Checking...',
    statusHi: 'जांच हो रही है...',
    type: 'checking',
    latency_ms: null,
    detail: 'Measuring round-trip latency...',
    detailHi: 'विलंबता मापी जा रही है...',
  },
  {
    name: 'NASA POWER (solar)',
    nameHi: 'नासा पावर (सौर विकिरण)',
    status: 'Checking...',
    statusHi: 'जांच हो रही है...',
    type: 'checking',
    latency_ms: null,
    detail: 'Measuring round-trip latency...',
    detailHi: 'विलंबता मापी जा रही है...',
  },
  {
    name: 'WeatherAPI fallback',
    nameHi: 'वेदरएपीआई फॉलबैक',
    status: 'Standby',
    statusHi: 'स्टैंडबाय',
    type: 'standby',
    latency_ms: null,
    detail: 'Automated failover ready (Standby mode)',
    detailHi: 'स्वचालित बैकअप तैयार (स्टैंडबाय मोड)',
  }
];

// Initial alert & dispatch activity records
export const INITIAL_DISPATCH_LOG = [
  {
    id: 1,
    time: '08:10',
    action: 'SMS alert Ward 4,6,12',
    actionHi: 'एसएमएस अलर्ट वार्ड 4,6,12',
    status: 'Delivered',
    statusHi: 'वितरित',
    type: 'alert',
    target: 'Ward 4, 6, 12',
  },
  {
    id: 2,
    time: '07:45',
    action: 'Cooling centre activated Ward 4',
    actionHi: 'शीतलन केंद्र सक्रिय वार्ड 4',
    status: 'Confirmed',
    statusHi: 'पुष्टीकृत',
    type: 'cooling',
    target: 'Ward 4 (Shivajinagar Community Hall)',
  }
];

// Complete bilingual translation dictionary
export const TRANSLATIONS = {
  en: {
    goiStrip: 'Government of India',
    ministry: 'Ministry of Earth Sciences · NDMA',
    appTitle: 'ThermaSense',
    appSubtitle: 'National Heat Stress Early Warning System',
    skipToMain: 'Skip to main content',
    liveDataPrefix: 'Live data — updated',
    minAgo: 'min ago',
    justNow: 'just now',
    refreshData: 'Refresh Data',
    syncing: 'Syncing live telemetry...',
    dataUnavailable: 'Live data unavailable — showing last known reading',
    loadingData: 'Retrieving live meteorological telemetry...',
    
    // Navigation
    navDashboard: 'Dashboard',
    navWardMap: 'Ward Map',
    navForecast: 'Forecast',
    navVulnerability: 'Vulnerability',
    navAlerts: 'Alerts & Dispatch',
    navReports: 'Reports',
    
    // Section 1 — Zone Overview
    zoneHeader: 'Bengaluru Urban — 8 wards monitored',
    zoneSubtitle: 'Real-time urban heat stress surveillance and multi-index physiological monitoring',
    wbgtTitle: 'WBGT (estimated)',
    wbgtDesc: 'Australian BOM / ISO 7243 Heat Stress Standard',
    utciTitle: 'UTCI (modeled)',
    utciDesc: 'Multi-node human energy balance (pythermalcomfort)',
    heatIndexTitle: 'Heat Index',
    heatIndexDesc: 'NOAA Rothfusz apparent temperature',
    activeAlertsTitle: 'Active Alerts',
    activeAlertsDesc: 'Wards requiring immediate intervention',
    wardsCount: 'wards',
    
    // Section 2 — Interactive GIS Map
    gisMapTitle: 'Bengaluru Urban GIS Heat Early Warning Map',
    gisMapSubtitle: 'Ward-level choropleth zone boundaries overlaid on urban infrastructure',
    layerWbgt: 'WBGT layer',
    layerVuln: 'Vulnerability layer',
    layerHeatmap: 'Heatmap overlay',
    basemapStreet: 'Street',
    basemapPositron: 'Clean',
    basemapSatellite: 'Satellite',
    legendTitle: 'Risk Level Legend',
    legendCaution: 'Caution (Green)',
    legendWarning: 'Warning (Orange)',
    legendExtreme: 'Extreme (Red)',
    clickToSelect: 'Click on any ward polygon to inspect real-time indicators',
    selectedBadge: 'SELECTED',
    riskScoreLabel: 'Risk Score',
    
    // Section 3 — Selected Ward Detail
    wardDetailTitle: 'Selected Ward Detail Panel',
    inputDataTitle: 'Input Data',
    inputDataSubtitle: 'Direct in-situ & satellite telemetry',
    dryBulbTemp: 'Dry-bulb temp',
    relativeHumidity: 'Relative humidity',
    windSpeed: 'Wind speed',
    solarRadiation: 'Solar radiation',
    
    vulnSignalsTitle: 'Vulnerability Signals',
    vulnSignalsSubtitle: 'Socio-demographic exposure metrics (Census baseline)',
    elderlyPop: 'Elderly population',
    outdoorWorker: 'Outdoor worker density',
    informalHousing: 'Informal housing',
    greenCover: 'Green cover',
    lowCoverAlert: 'Severe UHI amplification risk due to low vegetative canopy',
    
    // Section 4 — Forecast Strip
    forecastTitle: '5-Day Heat Stress Forecast',
    forecastSubtitle: 'High-resolution meteorological & physiological thermal trajectory (Open-Meteo NWP)',
    dayToday: 'Today',
    dayWed: 'Wed',
    dayThu: 'Thu',
    dayFri: 'Fri',
    daySat: 'Sat',
    
    // Section 5 — Predicted Health Impact
    healthImpactTitle: 'Predicted Health Impact & Clinical Projections',
    hospSpikeTitle: 'Estimated Hospitalisation Spike (72hr)',
    hospSpikeSub: 'Projected acute heat-exhaustion & cardiovascular admissions',
    confBand: 'Confidence band',
    mortalityRiskTitle: 'Mortality Risk Index',
    mortalityRiskSub: 'vs 3-yr ward baseline',
    gaugeScale: 'Risk Gauge (0 - 10)',
    criticalThreshold: 'Critical Threshold: 6.5',
    
    // Section 6 — Data Source Status
    dataSourcesTitle: 'Data Source & Telemetry Status',
    
    // Section 7 — Alert & Intervention Dispatch Panel
    dispatchTitle: 'Alert and Intervention Dispatch',
    actionSms: 'Dispatch SMS/WhatsApp Alert',
    actionCooling: 'Activate Cooling Centre',
    actionWorkShift: 'Trigger Outdoor Work-Hour Shift',
    activityLogTitle: 'Operational Dispatch Activity Log',
    tableTime: 'Time',
    tableAction: 'Action',
    tableStatus: 'Status',
    statusDelivered: 'Delivered',
    statusConfirmed: 'Confirmed',
    
    // Modal / Action feedback
    confirmDispatchTitle: 'Execute Emergency Heat Mitigation Dispatch',
    confirmDispatchMsg: 'You are issuing an authoritative heat mitigation order for',
    targetWard: 'Target Ward',
    actionType: 'Action Type',
    dispatchConfirmBtn: 'Confirm & Dispatch',
    cancelBtn: 'Cancel',
    dispatchSuccessMsg: 'Intervention successfully registered and dispatched to district control center.',
    
    // Footer
    footerAffiliation: 'Ministry of Earth Sciences · National Disaster Management Authority · Content owned by ThermaSense project',
    footerPortals: 'Official Portals: india.gov.in | ndma.gov.in | moes.gov.in | imd.gov.in',
    emergencyHelplines: 'Emergency Helpline: NDMA 1078 | National Heat Health line: 1800-180-1104',
    disclaimer: 'Official Heat Stress Warning System operated in accordance with National Disaster Management Guidelines.',
  },
  hi: {
    goiStrip: 'भारत सरकार',
    ministry: 'पृथ्वी विज्ञान मंत्रालय · राष्ट्रीय आपदा प्रबंधन प्राधिकरण (NDMA)',
    appTitle: 'थर्मासेंस (ThermaSense)',
    appSubtitle: 'राष्ट्रीय ताप तनाव पूर्व चेतावनी प्रणाली',
    skipToMain: 'मुख्य सामग्री पर जाएं',
    liveDataPrefix: 'लाइव डेटा — अद्यतन',
    minAgo: 'मिनट पहले',
    justNow: 'अभी-अभी',
    refreshData: 'डेटा रीफ्रेश करें',
    syncing: 'लाइव टेलीमेट्री सिंक हो रही है...',
    dataUnavailable: 'लाइव डेटा अनुपलब्ध — अंतिम ज्ञात रीडिंग प्रदर्शित',
    loadingData: 'लाइव मौसम डेटा प्राप्त किया जा रहा है...',
    
    // Navigation
    navDashboard: 'डैशबोर्ड',
    navWardMap: 'वार्ड मानचित्र',
    navForecast: 'पूर्वानुमान',
    navVulnerability: 'संवेदनशीलता',
    navAlerts: 'अलर्ट एवं प्रेषण',
    navReports: 'रिपोर्ट',
    
    // Section 1 — Zone Overview
    zoneHeader: 'बेंगलुरु शहरी — 8 वार्ड निगरानी में',
    zoneSubtitle: 'वास्तविक समय में शहरी ताप तनाव निगरानी एवं बहु-सूचकांक शारीरिक थर्मल विश्लेषण',
    wbgtTitle: 'WBGT (अनुमानित)',
    wbgtDesc: 'BOM / ISO 7243 ताप तनाव मानक',
    utciTitle: 'UTCI (मॉडल आधारित)',
    utciDesc: 'मानव ऊर्जा संतुलन सूचकांक (pythermalcomfort)',
    heatIndexTitle: 'ताप सूचकांक (Heat Index)',
    heatIndexDesc: 'NOAA Rothfusz प्रभावी तापमान',
    activeAlertsTitle: 'सक्रिय अलर्ट',
    activeAlertsDesc: 'तत्काल हस्तक्षेप की आवश्यकता वाले वार्ड',
    wardsCount: 'वार्ड',
    
    // Section 2 — Interactive GIS Map
    gisMapTitle: 'बेंगलुरु शहरी GIS ताप पूर्व चेतावनी मानचित्र',
    gisMapSubtitle: 'शहरी बुनियादी ढांचे पर वार्ड-स्तरीय रंग-कोडित जोखिम सीमाएं',
    layerWbgt: 'WBGT परत',
    layerVuln: 'संवेदनशीलता परत',
    layerHeatmap: 'हीटमैप ओवरले',
    basemapStreet: 'सड़क दृश्य',
    basemapPositron: 'स्पष्ट दृश्य',
    basemapSatellite: 'सैटेलाइट',
    legendTitle: 'जोखिम स्तर संकेत',
    legendCaution: 'सावधानी / Caution (हरा)',
    legendWarning: 'चेतावनी / Warning (नारंगी)',
    legendExtreme: 'अत्यधिक / Extreme (लाल)',
    clickToSelect: 'वास्तविक समय के संकेतक देखने हेतु किसी भी वार्ड पर क्लिक करें',
    selectedBadge: 'चयनित',
    riskScoreLabel: 'जोखिम स्कोर',
    
    // Section 3 — Selected Ward Detail
    wardDetailTitle: 'चयनित वार्ड विवरण पैनल',
    inputDataTitle: 'इनपुट डेटा',
    inputDataSubtitle: 'प्रत्यक्ष सेंसर एवं उपग्रह टेलीमेट्री डेटा',
    dryBulbTemp: 'ड्राई-बल्ब तापमान',
    relativeHumidity: 'सापेक्ष आर्द्रता',
    windSpeed: 'हवा की गति',
    solarRadiation: 'सौर विकिरण',
    
    vulnSignalsTitle: 'संवेदनशीलता संकेतक',
    vulnSignalsSubtitle: 'सामाजिक-जनसांख्यिकीय जोखिम पैरामीटर (जनगणना आधार)',
    elderlyPop: 'वरिष्ठ नागरिक जनसंख्या',
    outdoorWorker: 'बाहरी श्रमिक घनत्व',
    informalHousing: 'कच्चे/अनौपचारिक आवास',
    greenCover: 'हरित आवरण',
    lowCoverAlert: 'कम वनस्पति आवरण के कारण तीव्र शहरी ताप द्वीप (UHI) प्रभाव का जोखिम',
    
    // Section 4 — Forecast Strip
    forecastTitle: '5-दिवसीय ताप तनाव पूर्वानुमान',
    forecastSubtitle: 'उच्च-सटीकता मौसम विज्ञान एवं शारीरिक थर्मल प्रक्षेपवक्र (Open-Meteo NWP)',
    dayToday: 'आज',
    dayWed: 'बुध',
    dayThu: 'गुरु',
    dayFri: 'शुक्र',
    daySat: 'शनि',
    
    // Section 5 — Predicted Health Impact
    healthImpactTitle: 'अनुमानित स्वास्थ्य प्रभाव एवं नैदानिक अनुमान',
    hospSpikeTitle: 'अस्पताल में भर्ती में अनुमानित वृद्धि (72 घंटे)',
    hospSpikeSub: 'तीव्र ताप-थकावट एवं हृदय संबंधी रोगियों का अनुमान',
    confBand: 'विश्वास अंतराल (Confidence Band)',
    mortalityRiskTitle: 'मृत्यु दर जोखिम सूचकांक',
    mortalityRiskSub: '3-वर्षीय वार्ड आधार रेखा की तुलना में',
    gaugeScale: 'जोखिम मीटर (0 - 10)',
    criticalThreshold: 'गंभीर सीमा: 6.5',
    
    // Section 6 — Data Source Status
    dataSourcesTitle: 'डेटा स्रोत एवं टेलीमेट्री स्थिति',
    
    // Section 7 — Alert & Intervention Dispatch Panel
    dispatchTitle: 'अलर्ट एवं हस्तक्षेप प्रेषण',
    actionSms: 'एसएमएस/व्हाट्सएप अलर्ट भेजें',
    actionCooling: 'शीतलन केंद्र सक्रिय करें',
    actionWorkShift: 'बाहरी कार्य समय पाली बदलें',
    activityLogTitle: 'परिचालन प्रेषण गतिविधि लॉग',
    tableTime: 'समय',
    tableAction: 'कार्रवाई',
    tableStatus: 'स्थिति',
    statusDelivered: 'वितरित',
    statusConfirmed: 'पुष्टीकृत',
    
    // Modal / Action feedback
    confirmDispatchTitle: 'आपातकालीन ताप शमन प्रेषण निष्पादित करें',
    confirmDispatchMsg: 'आप निम्नलिखित वार्ड के लिए एक आधिकारिक ताप शमन आदेश जारी कर रहे हैं:',
    targetWard: 'लक्षित वार्ड',
    actionType: 'कार्रवाई का प्रकार',
    dispatchConfirmBtn: 'पुष्टि करें एवं भेजें',
    cancelBtn: 'रद्द करें',
    dispatchSuccessMsg: 'हस्तक्षेप सफलतापूर्वक दर्ज किया गया और जिला नियंत्रण केंद्र को भेज दिया गया।',
    
    // Footer
    footerAffiliation: 'पृथ्वी विज्ञान मंत्रालय · राष्ट्रीय आपदा प्रबंधन प्राधिकरण · सामग्री ThermaSense परियोजना के स्वामित्व में',
    footerPortals: 'आधिकारिक पोर्टल: india.gov.in | ndma.gov.in | moes.gov.in | imd.gov.in',
    emergencyHelplines: 'आपातकालीन हेल्पलाइन: NDMA 1078 | राष्ट्रीय ताप स्वास्थ्य लाइन: 1800-180-1104',
    disclaimer: 'राष्ट्रीय आपदा प्रबंधन दिशानिर्देशों के अनुसार संचालित आधिकारिक ताप तनाव पूर्व चेतावनी प्रणाली।',
  }
};
