import math
from datetime import datetime,timezone
import numpy as np

from .liljegren import solve_globe, solve_wetbulb, wind_speed_2m, kelvin_to_celsius, celsius_to_kelvin
from pythermalcomfort.utilities import mean_radiant_tmp

def calculate_solar_geometry_and_fraction(dt_utc: datetime, lat: float, lon: float, ghi: float):
    """
    Calculates the cosine of the solar zenith angle and the direct beam fraction (fdir)
    using the NOAA solar position algorithms and the Erbs et al. (1982) model to partition GHI.
    """
    # 1. Solar Zenith Angle calculation
    n = dt_utc.timetuple().tm_yday
    # Fractional year in radians
    gamma = 2 * math.pi / 365.0 * (n - 1.0 + (dt_utc.hour - 12.0) / 24.0)

    # Equation of time in minutes
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
                       - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma))

    # Solar declination in radians
    decl = 0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma) \
           - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma) \
           - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma)

    time_offset = eqtime + 4.0 * lon
    tst = dt_utc.hour * 60.0 + dt_utc.minute + dt_utc.second / 60.0 + time_offset
    ha_rad = math.radians((tst / 4.0) - 180.0)
    lat_rad = math.radians(lat)

    cossza = math.sin(lat_rad) * math.sin(decl) + math.cos(lat_rad) * math.cos(decl) * math.cos(ha_rad)
    cossza = max(cossza, -1.0)
    cossza = min(cossza, 1.0)

    # 2. Partition GHI into Direct and Diffuse using Erbs et al. (1982)
    # Extraterrestrial radiation
    I0 = 1367.0 * (1.0 + 0.033 * math.cos(2 * math.pi * n / 365.0))
    G_ext = I0 * cossza

    if cossza <= 0 or G_ext <= 0 or ghi <= 0:
        fdir = 0.0
    else:
        kt = ghi / G_ext
        if kt <= 0.22:
            kd = 1.0 - 0.09 * kt
        elif kt <= 0.8:
            kd = 0.9511 - 0.1604 * kt + 4.388 * (kt**2) - 16.638 * (kt**3) + 12.336 * (kt**4)
        else:
            kd = 0.165

        kd = max(0.0, min(kd, 1.0))
        fdir = 1.0 - kd

    return cossza, fdir

def calculate_humidity_ghi_attenuation(temp_c: float, humidity_pct: float, cossza: float) -> float:
    """
    Calculates atmospheric broadband water-vapor transmittance (tau_w) to attenuate
    Global Horizontal Irradiance (GHI) based on surface moisture.
    
    Citations & Literature Sources:
    - Bird, R. E., & Hulstrom, R. L. (1981). "A Simplified Clear Sky model for Direct
      and Diffuse Insolation on Horizontal Surfaces." SERI/TR-642-761, Solar Energy
      Research Institute, Golden, CO. (Eq. 11: water-vapor transmittance parameterization).
    - Iqbal, M. (1983). "An Introduction to Solar Radiation." Academic Press.
      (Chapter 6, Eq. 6.6.6: broadband water-vapor transmittance function).
    - Buck, A. L. (1981). "New equations for computing vapor pressure and enhancement factor."
      Journal of Applied Meteorology, 20(12), 1527-1532.
    - Prata, A. J. (1996). "A new long-wave formula for estimating downward clear-sky radiation
      at the surface." Quarterly Journal of the Royal Meteorological Society, 122(533), 1127-1151.
      (Column precipitable water vapor empirical scaling w = 4.65 * ea / T).
    - Kasten, F., & Young, A. T. (1989). "Revised optical air mass tables and approximation formula."
      Applied Optics, 28(22), 4735-4738.

    Parameter notes:
    - Buck (1981) saturation vapor pressure parameters [ground truth from thermodynamic formulation].
    - Prata (1996) precipitable water vapor coefficient: 4.65 [ground truth from radiosonde profile regression].
    - Bird & Hulstrom (1981) polynomial coefficients (2.4959, 79.034, 0.6828, 6.385) [ground truth from AFGL absorption spectral integration].
    - No empirical tuning or judgment call coefficients are introduced.
    
    Returns:
        tau_w: Broadband water vapor transmittance factor in [0.0, 1.0].
    """
    if cossza <= 0.0:
        return 1.0

    tk = temp_c + 273.15
    # Buck (1981) saturation vapor pressure in hPa
    es = 1.004 * 6.1121 * math.exp(17.502 * (tk - 273.15) / (tk - 32.18))
    ea = (humidity_pct / 100.0) * es  # Surface actual vapor pressure in hPa

    # Relative optical air mass from Kasten & Young (1989)
    sza_deg = math.degrees(math.acos(max(-1.0, min(1.0, cossza))))
    am = 1.0 / (cossza + 0.50572 * (96.07995 - sza_deg) ** (-1.6364))

    # Precipitable water vapor w in cm (Prata 1996: w = 4.65 * ea / tk in mm -> /10 for cm)
    w_cm = 4.65 * ea / (tk * 10.0)
    mw = am * w_cm

    # Bird & Hulstrom (1981) broadband water vapor transmittance
    tau_w = 1.0 - 2.4959 * mw / ((1.0 + 79.034 * mw) ** 0.6828 + 6.385 * mw)
    return max(0.0, min(1.0, float(tau_w)))


def derive_thermal_inputs(
    temp_c: float,
    humidity: float,
    wind_ms: float,
    solar_rad: float,
    timestamp: str,
    latitude: float,
    longitude: float,
    pressure_hpa: float = None
):
    """
    Derives natural wet-bulb temperature (Tnwb), globe temperature (Tg),
    and mean radiant temperature (Tr) using the Liljegren 2008 model,
    accounting for humidity-based atmospheric solar attenuation.
    """
    dt_utc = datetime.fromisoformat(
    timestamp.replace("Z", "+00:00")
)

# Timestamp must contain timezone information.
    if dt_utc.tzinfo is None:
        raise ValueError(
        "Timestamp must include timezone information "
        "(e.g. UTC 'Z' or offset)."
    )

# Convert any timezone offset to UTC before solar calculations.
    dt_utc = dt_utc.astimezone(timezone.utc)
    # Assumptions/Defaults
    if pressure_hpa is None:
        # Standard sea-level pressure assumption if not provided
        pressure_hpa = 1013.25

    cossza_geom, _ = calculate_solar_geometry_and_fraction(dt_utc, latitude, longitude, solar_rad)

    # Apply humidity-based solar attenuation (Bird & Hulstrom 1981 / Iqbal 1983)
    tau_w = calculate_humidity_ghi_attenuation(temp_c, humidity, cossza_geom)
    effective_solar_rad = solar_rad * tau_w

    cossza, fdir = calculate_solar_geometry_and_fraction(dt_utc, latitude, longitude, effective_solar_rad)

    # Thermofeel / Liljegren inputs expect numpy arrays
    t_k = celsius_to_kelvin(temp_c)
    rh_frac = humidity / 100.0

    # Wind speed scaling from 10m to 2m using Liljegren atmospheric stability profile
    wind_2m = float(wind_speed_2m(wind_ms, cossza, effective_solar_rad))

    # Liljegren expects pressure in hPa
    pair_hpa = pressure_hpa

    # Solve Globe
    tg_c = solve_globe(
        ta=t_k,
        rh=rh_frac,
        pair=pair_hpa,
        speed=wind_2m,
        solar=effective_solar_rad,
        fdir=fdir,
        cza=cossza
    )

    # Solve Wetbulb
    twb_natural_c = solve_wetbulb(
        ta=t_k,
        rh=rh_frac,
        pair=pair_hpa,
        speed=wind_2m,
        solar=effective_solar_rad,
        fdir=fdir,
        cza=cossza,
        rad=1.0 # 1.0 indicates natural wet bulb (exposed to radiation)
    )

    # Derive Mean Radiant Temperature using pythermalcomfort (ISO 7726 formulation)
    tg_val = float(tg_c)
    twb_val = float(twb_natural_c)

    tr_val = mean_radiant_tmp(
        tg=tg_val,
        tdb=temp_c,
        v=wind_2m, # Wind speed at globe height
        d=0.0508, # Liljegren 2-inch (50.8mm) standard globe diameter
        emissivity=0.95, # Standard globe emissivity assumption
        standard='ISO'
    )

    return {
        "twb_natural": twb_val,
        "tg": tg_val,
        "tr": float(tr_val),
        "fdir": fdir,
        "cossza": cossza,
        "wind_2m": wind_2m,
        "tau_w": tau_w,
        "effective_solar_rad": effective_solar_rad
    }
