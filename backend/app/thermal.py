from fastapi import APIRouter, Query
from pythermalcomfort.models import heat_index_rothfusz, wbgt, utci
import math

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
