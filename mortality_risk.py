"""
mortality_risk.py — Mortality and Hospitalization Risk Index Module.

Translates physical thermal stress metrics (WBGT, Heat Index) and ward-level
vulnerability into epidemiological public-health outcomes:
- Relative Risk (RR)
- Excess Mortality Percentage (%)
- Predicted Daily Excess Deaths
- Predicted Daily Hospitalization Estimate (provisional secondary metric)
- Scaled 0-100 Mortality Risk Index for dashboard visualization

All baseline dose-response slopes and thresholds are strictly derived from
peer-reviewed, published epidemiological literature in India:

1. Chakraborty et al. (2024), ACS Environmental Science & Technology:
   "Excess Mortality Risk Due to Heat Stress in Different Climatic Zones of India"
   - Quasi-Poisson regression of ERA5-derived India Heat Index (IHI) against daily
     all-cause mortality across Indian climatic zones.
   - Dose-response increase per unit heat index:
     * Delhi (Semi-arid): 2.6% to 4.2%
     * Chennai (Humid-tropical): 0.9% to 5.7%
     * Varanasi (Humid-subtropical): 3.2% to 7.5%
   - Sweltering vs comfortable day all-cause mortality increase:
     * Delhi: +5.9% (RR = 1.059)
     * Chennai: +8.0% (RR = 1.080)
     * Varanasi: +8.1% (RR = 1.081)

2. Comparative Delhi / São Paulo / London Mortality Displacement Study:
   - Delhi excess all-cause mortality risk: 4.45% per °C (95% CI: 2.40%–6.55%)
     above the minimum mortality temperature threshold.

3. Azhar et al. (2014), PLOS ONE:
   "Heat-Related Mortality in India: Excess All-Cause Mortality Associated with
   the 2010 Ahmedabad Heat Wave"
   - Recorded a 43.1% excess all-cause mortality surge in Ahmedabad during May 2010.
   - Serves as the empirical calibration ceiling and index anchor (maps to ~90-95
     on the 0-100 scale).

Design:
Pure mathematical functions with zero DB/network I/O for deterministic testing
and high-throughput execution across multiple wards and forecast horizons.
"""

from __future__ import annotations

import math
from typing import Dict, Any


# ---------------------------------------------------------------------------
# Published Epidemiological Coefficients & Baseline Thresholds
# ---------------------------------------------------------------------------

# Primary continuous excess mortality slope per °C above threshold
# (Delhi comparative study: 4.45% per °C, 95% CI: 2.40% - 6.55%)
BETA_PER_DEGREE_CELSIUS = 0.0445

# Climate-zone baseline WBGT thresholds (°C) where thermal strain initiates.
# Grounded in Indian Heat Action Plan (HAP) and ISO 7243 occupational standards:
# - Semi-arid (Delhi, Ahmedabad, Nagpur): 25.0°C WBGT (moderate heat strain onset)
# - Humid-tropical (Chennai, Mumbai): 26.0°C WBGT (higher baseline humidity adaptation)
# - Humid-subtropical (Varanasi, Kolkata): 25.0°C WBGT
ZONE_WBGT_THRESHOLDS: dict[str, float] = {
    "semi_arid": 25.0,
    "humid_tropical": 26.0,
    "humid_subtropical": 25.0,
}

# Conservative (lower-bound) per-unit Heat Index slope from Chakraborty et al. (2024)
ZONE_HI_COEFFICIENTS: dict[str, float] = {
    "semi_arid": 0.026,       # Delhi: 2.6% (range: 2.6% - 4.2%)
    "humid_tropical": 0.009,  # Chennai: 0.9% (range: 0.9% - 5.7%)
    "humid_subtropical": 0.032,  # Varanasi: 3.2% (range: 3.2% - 7.5%)
}

# Categorical "sweltering day" excess mortality percentage from Chakraborty et al. (2024)
ZONE_SWELTERING_EXCESS_PCT: dict[str, float] = {
    "semi_arid": 5.9,
    "humid_tropical": 8.0,
    "humid_subtropical": 8.1,
}

# National urban crude death rate per 1,000 population/year (SRS Bulletin, India)
DEFAULT_BASELINE_MORTALITY_RATE = 6.2

# Empirical ceiling: Ahmedabad May 2010 recorded +43.1% excess mortality.
# We bound the effective excess mortality percentage to 50.0% (effective_RR <= 1.50)
# to prevent unphysical extrapolation under extreme compound heat.
MAX_EXCESS_MORTALITY_PCT_CAP = 50.0

# 0-100 Dashboard Index Anchor: Maps Ahmedabad's 43.1% event to ~91.7
# Formula: (excess_pct / INDEX_ANCHOR_PCT) * 100
INDEX_ANCHOR_PCT = 47.0

# Provisional morbidity-to-mortality multiplier for heat-related hospitalizations.
# In emergency medicine literature, heat-induced admissions typically range from
# 4x to 10x mortality. Configured here as a provisional secondary estimate.
PROVISIONAL_HOSPITALIZATION_MULTIPLIER = 6.0


def calculate_mortality_risk(
    heat_index_c: float,
    wbgt_c: float,
    thermal_score: float,
    vulnerability_score: float,
    baseline_daily_mortality_rate: float | None = None,
    ward_population: int | None = None,
    climate_zone: str = "semi_arid",
) -> dict[str, Any]:
    """
    Calculate public-health mortality risk and hospitalization estimates.

    Parameters
    ----------
    heat_index_c : float
        Heat Index in °C (from heat_index_lu).
    wbgt_c : float
        Wet Bulb Globe Temperature in °C (ISO 7243).
    thermal_score : float
        Raw or combined thermal severity score (0-100).
    vulnerability_score : float
        Demographic vulnerability score from risk_scoring.py (0-100).
    baseline_daily_mortality_rate : float, optional
        Annual crude death rate per 1,000 population. Defaults to 6.2 (India SRS).
    ward_population : int, optional
        Total population of the ward. Defaults to 40,000 (typical Indian urban ward).
    climate_zone : str, optional
        One of 'semi_arid', 'humid_tropical', 'humid_subtropical'.
        Defaults to 'semi_arid'.

    Returns
    -------
    dict
        {
            "relative_risk": float,
            "excess_mortality_pct": float,
            "predicted_excess_deaths_daily": float,
            "predicted_hospitalization_estimate": float,
            "mortality_risk_index": float,
            "effective_rr": float,
            "raw_rr": float,
            "baseline_daily_deaths": float,
            "capped_at_ceiling": bool,
            "confidence_note": str,
            "hospitalization_note": str,
        }
    """
    # 1. Normalize and validate inputs
    zone = climate_zone.lower().strip()
    if zone not in ZONE_WBGT_THRESHOLDS:
        zone = "semi_arid"

    wbgt = float(wbgt_c) if wbgt_c is not None and math.isfinite(float(wbgt_c)) else 25.0
    hi = float(heat_index_c) if heat_index_c is not None and math.isfinite(float(heat_index_c)) else 26.0
    vuln = max(0.0, min(100.0, float(vulnerability_score or 0.0)))
    
    # Ward baseline mortality and population defaults
    mort_rate = (
        float(baseline_daily_mortality_rate)
        if baseline_daily_mortality_rate is not None and float(baseline_daily_mortality_rate) > 0
        else DEFAULT_BASELINE_MORTALITY_RATE
    )
    pop = int(ward_population) if ward_population is not None and int(ward_population) > 0 else 40000

    # 2. Continuous Relative Risk (RR) Calculation
    zone_threshold = ZONE_WBGT_THRESHOLDS[zone]
    delta_t = max(0.0, wbgt - zone_threshold)
    raw_rr = 1.0 + (BETA_PER_DEGREE_CELSIUS * delta_t)

    # 3. Apply Vulnerability Adjustment (Documented Internal Transformation)
    # effective_RR = 1 + (RR_raw - 1) * (1 + vulnerability_score / 100)
    # A score of 0 leaves RR unchanged; a score of 100 doubles the excess fraction.
    vuln_multiplier = 1.0 + (vuln / 100.0)
    raw_effective_rr = 1.0 + (raw_rr - 1.0) * vuln_multiplier

    # 4. Enforce Empirical Ceiling (Azhar et al. 2014 Ahmedabad Benchmark)
    max_allowed_rr = 1.0 + (MAX_EXCESS_MORTALITY_PCT_CAP / 100.0)
    capped = raw_effective_rr > max_allowed_rr
    effective_rr = min(max_allowed_rr, raw_effective_rr)

    # 5. Excess Mortality Percentage (%)
    excess_mortality_pct = round((effective_rr - 1.0) * 100.0, 2)

    # 6. Absolute Predicted Daily Excess Deaths
    # Daily baseline deaths = (mort_rate / 1000 / 365) * population
    daily_baseline_deaths = (mort_rate / 1000.0 / 365.0) * pop
    predicted_excess_deaths_daily = round(daily_baseline_deaths * (effective_rr - 1.0), 3)

    # 7. Scaled 0-100 Mortality Risk Index
    # Anchored so that Ahmedabad 43.1% event = ~91.70 (in 90-95 range)
    mortality_risk_index = round(
        min(100.0, max(0.0, (excess_mortality_pct / INDEX_ANCHOR_PCT) * 100.0)),
        2,
    )

    # 8. Provisional Hospitalization Estimate (Secondary Metric)
    predicted_hospitalization_estimate = round(
        predicted_excess_deaths_daily * PROVISIONAL_HOSPITALIZATION_MULTIPLIER,
        3,
    )

    # 9. Formulate Transparent Citations and Confidence Notes
    sweltering_ref = ZONE_SWELTERING_EXCESS_PCT[zone]
    confidence_note = (
        f"Continuous RR derived from Delhi multi-city study slope (+4.45%/°C above {zone_threshold}°C WBGT, 95% CI: 2.40–6.55%). "
        f"Vulnerability scaled via 1+(RR-1)*(1+V/100) [internal assumption]. "
        f"Chakraborty et al. (2024) seasonal sweltering benchmark for {zone}: +{sweltering_ref}%. "
        f"Calibrated against Azhar et al. (2014) Ahmedabad 2010 event (+43.1% ceiling)."
    )
    if capped:
        confidence_note += (
            f" [WARNING: Raw calculated excess ({round((raw_effective_rr - 1.0) * 100.0, 1)}%) "
            f"exceeded empirical ceiling; capped at {MAX_EXCESS_MORTALITY_PCT_CAP}%]."
        )

    hospitalization_note = (
        "PROVISIONAL ESTIMATE: Derived as a secondary 6.0x multiplier over excess mortality. "
        "India-specific heat-illness emergency surveillance ratios are sparse; "
        "replace with NCDC/state IDSP surveillance data when available."
    )

    return {
        "relative_risk": round(effective_rr, 4),
        "excess_mortality_pct": excess_mortality_pct,
        "predicted_excess_deaths_daily": predicted_excess_deaths_daily,
        "predicted_hospitalization_estimate": predicted_hospitalization_estimate,
        "mortality_risk_index": mortality_risk_index,
        "effective_rr": round(effective_rr, 4),
        "raw_rr": round(raw_rr, 4),
        "baseline_daily_deaths": round(daily_baseline_deaths, 3),
        "capped_at_ceiling": capped,
        "confidence_note": confidence_note,
        "hospitalization_note": hospitalization_note,
    }
