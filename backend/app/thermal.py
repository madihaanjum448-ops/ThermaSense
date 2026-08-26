from fastapi import APIRouter, Query
from pythermalcomfort.models import heat_index_rothfusz, wbgt, utci
import math
from .derivation import derive_thermal_inputs

router = APIRouter()

@router.get("/heat_index")
def get_heat_index(
    tdb: float = Query(..., description="Dry-bulb temperature in °C"),
    rh: float = Query(..., description="Relative humidity in %")
):
    """
    Calculate the Heat Index (Rothfusz).
    Expected parameters:
    - tdb: dry-bulb temperature (°C)
    - rh: relative humidity (%)
    """
    result = heat_index_rothfusz(tdb=tdb, rh=rh)
    return {"heat_index": result.hi}

@router.get("/wbgt")
def get_wbgt(
    twb: float = Query(..., description="Natural wet-bulb temperature in °C"),
    tg: float = Query(..., description="Globe temperature in °C"),
    tdb: float = Query(None, description="Dry-bulb temperature in °C, needed if with_solar_load is True"),
    with_solar_load: bool = Query(False, description="Set to True if calculating with solar load")
):
    """
    Calculate the Wet-Bulb Globe Temperature (WBGT).
    Expected parameters:
    - twb: natural wet-bulb temperature (°C) (must be derived if not available)
    - tg: globe temperature (°C) (must be derived if not available)
    - tdb: dry-bulb temperature (°C) (optional, but required if with_solar_load=True)
    """
    result = wbgt(twb=twb, tg=tg, tdb=tdb, with_solar_load=with_solar_load)
    return {"wbgt": result.wbgt}

@router.get("/utci")
def get_utci(
    tdb: float = Query(..., description="Dry-bulb temperature in °C"),
    tr: float = Query(..., description="Mean radiant temperature in °C"),
    v: float = Query(..., description="Wind speed at 10 m, in m/s"),
    rh: float = Query(..., description="Relative humidity in %")
):
    """
    Calculate the Universal Thermal Climate Index (UTCI).
    Expected parameters:
    - tdb: dry-bulb temperature (°C)
    - tr: mean radiant temperature (°C) (must be derived, do not silently substitute solar radiation)
    - v: wind speed at 10m height (m/s)
    - rh: relative humidity (%)
    """
    result = utci(tdb=tdb, tr=tr, v=v, rh=rh)
    return {
        "utci": result.utci,
        "stress_category": result.stress_category
    }

@router.get("/derive_all")
def get_derive_all(
    temp_c: float = Query(..., description="Air temperature in °C"),
    humidity: float = Query(..., description="Relative humidity in %"),
    wind_ms: float = Query(..., description="Wind speed at 10m in m/s"),
    solar_rad: float = Query(..., description="Global Horizontal Irradiance in W/m2"),
    timestamp: str = Query(..., description="ISO 8601 UTC timestamp"),
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    pressure_hpa: float = Query(None, description="Atmospheric pressure in hPa")
):
    """
    Takes raw weather data, derives Tnwb, Tg, and Tr using the Liljegren (2008) method,
    then calculates Heat Index, WBGT, and UTCI.
    """
    derived = derive_thermal_inputs(
        temp_c=temp_c,
        humidity=humidity,
        wind_ms=wind_ms,
        solar_rad=solar_rad,
        timestamp=timestamp,
        latitude=latitude,
        longitude=longitude,
        pressure_hpa=pressure_hpa
    )

    # Calculate Heat Index
    hi_result = heat_index_rothfusz(tdb=temp_c, rh=humidity)

    # Calculate WBGT
    wbgt_result = wbgt(twb=derived["twb_natural"], tg=derived["tg"], tdb=temp_c, with_solar_load=True)

    # Calculate UTCI
    utci_result = utci(tdb=temp_c, tr=derived["tr"], v=wind_ms, rh=humidity)

    return {
        "raw_inputs": {
            "temp_c": temp_c,
            "humidity": humidity,
            "wind_ms": wind_ms,
            "solar_rad": solar_rad,
            "timestamp": timestamp,
            "latitude": latitude,
            "longitude": longitude,
            "pressure_hpa": pressure_hpa
        },
        "derived_inputs": derived,
        "indices": {
            "heat_index": hi_result.hi,
            "wbgt": wbgt_result.wbgt,
            "utci": utci_result.utci,
            "utci_stress": utci_result.stress_category
        }
    }
