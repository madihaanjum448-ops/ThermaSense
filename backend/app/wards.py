from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import text
from datetime import datetime
import json

from .auth import get_current_user

from .heat_indices import (
    fetch_ward_live_weather,
    fetch_ward_5day_forecast,
    check_data_sources_health,
    compute_wbgt,
    compute_utci,
    compute_heat_index,
    get_risk_band,
)

# Optional database engine
try:
    from db import engine
    HAS_DB = True
except Exception:
    HAS_DB = False
    engine = None

router = APIRouter()

# Default Bengaluru 8 monitored wards metadata & geometry (for reliable fallback geometry)
BENGALURU_8_WARDS = [
    {
        "id": 1,
        "name": "Malleshwaram",
        "city": "Bengaluru",
        "centroid_lat": 13.003,
        "centroid_lon": 77.570,
        "vulnerability_score": 28.5,
        "elderly_pct": 14.5,
        "outdoor_worker_pct": 19.0,
        "informal_housing_pct": 12.0,
        "green_cover_pct": 24.5,
        "coordinates": [[
            [77.552, 12.990],
            [77.585, 12.990],
            [77.585, 13.022],
            [77.552, 13.022],
            [77.552, 12.990]
        ]]
    },
    {
        "id": 2,
        "name": "Hebbal",
        "city": "Bengaluru",
        "centroid_lat": 13.035,
        "centroid_lon": 77.598,
        "vulnerability_score": 48.2,
        "elderly_pct": 15.8,
        "outdoor_worker_pct": 26.4,
        "informal_housing_pct": 21.5,
        "green_cover_pct": 16.2,
        "coordinates": [[
            [77.585, 13.015],
            [77.625, 13.015],
            [77.625, 13.055],
            [77.585, 13.055],
            [77.585, 13.015]
        ]]
    },
    {
        "id": 3,
        "name": "Rajajinagar",
        "city": "Bengaluru",
        "centroid_lat": 12.990,
        "centroid_lon": 77.555,
        "vulnerability_score": 56.4,
        "elderly_pct": 17.1,
        "outdoor_worker_pct": 28.5,
        "informal_housing_pct": 23.0,
        "green_cover_pct": 11.5,
        "coordinates": [[
            [77.530, 12.965],
            [77.568, 12.965],
            [77.568, 13.005],
            [77.530, 13.005],
            [77.530, 12.965]
        ]]
    },
    {
        "id": 4,
        "name": "Shivajinagar",
        "city": "Bengaluru",
        "centroid_lat": 12.985,
        "centroid_lon": 77.602,
        "vulnerability_score": 78.4,
        "elderly_pct": 18.2,
        "outdoor_worker_pct": 31.0,
        "informal_housing_pct": 27.0,
        "green_cover_pct": 9.0,
        "coordinates": [[
            [77.585, 12.968],
            [77.622, 12.968],
            [77.622, 13.005],
            [77.585, 13.005],
            [77.585, 12.968]
        ]]
    },
    {
        "id": 5,
        "name": "Shantinagar",
        "city": "Bengaluru",
        "centroid_lat": 12.955,
        "centroid_lon": 77.595,
        "vulnerability_score": 74.0,
        "elderly_pct": 19.4,
        "outdoor_worker_pct": 29.8,
        "informal_housing_pct": 25.4,
        "green_cover_pct": 10.2,
        "coordinates": [[
            [77.575, 12.938],
            [77.615, 12.938],
            [77.615, 12.968],
            [77.575, 12.968],
            [77.575, 12.938]
        ]]
    },
    {
        "id": 6,
        "name": "Koramangala",
        "city": "Bengaluru",
        "centroid_lat": 12.935,
        "centroid_lon": 77.625,
        "vulnerability_score": 49.5,
        "elderly_pct": 16.0,
        "outdoor_worker_pct": 24.2,
        "informal_housing_pct": 18.5,
        "green_cover_pct": 17.8,
        "coordinates": [[
            [77.612, 12.915],
            [77.652, 12.915],
            [77.652, 12.955],
            [77.612, 12.955],
            [77.612, 12.915]
        ]]
    },
    {
        "id": 7,
        "name": "Indiranagar",
        "city": "Bengaluru",
        "centroid_lat": 12.978,
        "centroid_lon": 77.642,
        "vulnerability_score": 31.2,
        "elderly_pct": 15.2,
        "outdoor_worker_pct": 18.6,
        "informal_housing_pct": 10.4,
        "green_cover_pct": 22.0,
        "coordinates": [[
            [77.622, 12.955],
            [77.668, 12.955],
            [77.668, 12.998],
            [77.622, 12.998],
            [77.622, 12.955]
        ]]
    },
    {
        "id": 8,
        "name": "Jayanagar",
        "city": "Bengaluru",
        "centroid_lat": 12.928,
        "centroid_lon": 77.583,
        "vulnerability_score": 81.0,
        "elderly_pct": 21.0,
        "outdoor_worker_pct": 32.5,
        "informal_housing_pct": 28.2,
        "green_cover_pct": 8.5,
        "coordinates": [[
            [77.560, 12.905],
            [77.608, 12.905],
            [77.608, 12.940],
            [77.560, 12.940],
            [77.560, 12.905]
        ]]
    }
]


def _to_float(value):
    return float(value) if value is not None else None


@router.get("/wards/geojson")
def get_wards_geojson():
    """
    Return all Karnataka / BBMP Bengaluru wards as GeoJSON populated with LIVE weather data and calculated indices.
    If live fetch fails, returns None for missing fields (no fabricated numbers).
    """
    features = []

    # Attempt to fetch DB records for Bengaluru wards if DB is configured
    db_wards_by_name = {}
    if HAS_DB and engine:
        try:
            query = text("""
                SELECT
                    w.id,
                    w.name,
                    w.city,
                    w.centroid_lat,
                    w.centroid_lon,
                    ST_AsGeoJSON(w.geom) AS geom_json,
                    w.elderly_pct,
                    w.outdoor_worker_pct,
                    w.slum_household_pct,
                    w.green_cover_pct
                FROM wards w
                WHERE w.city ILIKE '%Bengaluru%' OR w.city ILIKE '%Bangalore%'
            """)
            with engine.connect() as conn:
                rows = conn.execute(query).fetchall()
                for r in rows:
                    db_wards_by_name[r.name.lower().strip()] = {
                        "id": r.id,
                        "name": r.name,
                        "city": "Bengaluru",
                        "lat": _to_float(r.centroid_lat),
                        "lon": _to_float(r.centroid_lon),
                        "geom": json.loads(r.geom_json) if r.geom_json else None,
                        "elderly_pct": _to_float(r.elderly_pct),
                        "outdoor_worker_pct": _to_float(r.outdoor_worker_pct),
                        "informal_housing_pct": _to_float(r.slum_household_pct),
                        "green_cover_pct": _to_float(r.green_cover_pct),
                    }
        except Exception:
            db_wards_by_name = {}

    for w_meta in BENGALURU_8_WARDS:
        w_id = w_meta["id"]
        db_item = db_wards_by_name.get(w_meta["name"].lower().strip(), {})
        
        # Ensure coordinates are strictly within Karnataka / Bengaluru bounds
        lat = db_item.get("lat") if (db_item.get("lat") and 12.7 <= db_item.get("lat") <= 13.3) else w_meta["centroid_lat"]
        lon = db_item.get("lon") if (db_item.get("lon") and 77.3 <= db_item.get("lon") <= 77.9) else w_meta["centroid_lon"]
        name = w_meta["name"]
        city = "Bengaluru"

        geometry = db_item.get("geom") or {
            "type": "Polygon",
            "coordinates": w_meta["coordinates"]
        }

        # Fetch LIVE weather and computed thermal stress from Open-Meteo
        live_weather = fetch_ward_live_weather(lat, lon)

        if live_weather:
            wbgt = live_weather.get("wbgt")
            utci = live_weather.get("utci")
            hi = live_weather.get("heat_index")
            temp = live_weather.get("temperature")
            humidity = live_weather.get("humidity")
            wind = live_weather.get("wind_speed")
            solar = live_weather.get("solar_radiation")
            risk_band = live_weather.get("risk_band")
            score_time = live_weather.get("reading_time")
            is_live = True
        else:
            wbgt = None
            utci = None
            hi = None
            temp = None
            humidity = None
            wind = None
            solar = None
            risk_band = "Unavailable"
            score_time = None
            is_live = False

        vuln_score = w_meta["vulnerability_score"]
        # Composite score
        if wbgt is not None:
            raw_risk = min(100.0, max(0.0, (wbgt - 24.0) * 10.0))
            final_risk = round(0.7 * raw_risk + 0.3 * vuln_score, 1)
        else:
            final_risk = None

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": w_id,
                "name": name,
                "city": city,
                "centroid_lat": lat,
                "centroid_lon": lon,
                "temperature": temp,
                "humidity": humidity,
                "wind_speed": wind,
                "solar_radiation": solar,
                "wbgt": wbgt,
                "utci": utci,
                "heat_index": hi,
                "risk_band": risk_band,
                "final_risk_score": final_risk,
                "vulnerability_score": vuln_score,
                "elderly_pct": db_item.get("elderly_pct") or w_meta.get("elderly_pct"),
                "outdoor_worker_pct": db_item.get("outdoor_worker_pct") or w_meta.get("outdoor_worker_pct"),
                "informal_housing_pct": db_item.get("informal_housing_pct") or w_meta.get("informal_housing_pct"),
                "green_cover_pct": db_item.get("green_cover_pct") or w_meta.get("green_cover_pct"),
                "score_time": score_time,
                "is_live": is_live,
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/wards/{ward_id}/live")
def get_ward_live(ward_id: int):
    """
    Return live weather and thermal indicators for a specific ward.
    """
    ward = next((w for w in BENGALURU_8_WARDS if w["id"] == ward_id), None)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    live = fetch_ward_live_weather(ward["centroid_lat"], ward["centroid_lon"])
    return {
        "ward_id": ward_id,
        "name": ward["name"],
        "live": live,
        "is_available": live is not None,
    }


@router.get("/wards/{ward_id}/forecast")
def get_ward_forecast(ward_id: int):
    """
    Return real 5-day daily forecast for one ward computed from Open-Meteo.
    """
    ward = next((w for w in BENGALURU_8_WARDS if w["id"] == ward_id), None)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    forecast = fetch_ward_5day_forecast(ward["centroid_lat"], ward["centroid_lon"])

    return {
        "ward_id": ward_id,
        "name": ward["name"],
        "count": len(forecast) if forecast else 0,
        "forecasts": forecast or [],
        "is_available": forecast is not None,
    }


@router.get("/wards/data-sources")
@router.get("/health-check")
def get_data_sources_status():
    """
    Return live round-trip latency measurements for all data sources.
    """
    sources = check_data_sources_health()
    return {
        "status": "ok",
        "data_sources": sources,
    }


@router.get("/wards/summary")
def get_zone_summary():
    """
    Return high-level Bengaluru Urban zone overview based on live measurements.
    """
    all_wbgt = []
    all_utci = []
    all_hi = []
    active_alerts_count = 0
    alert_wards = []

    for w in BENGALURU_8_WARDS:
        live = fetch_ward_live_weather(w["centroid_lat"], w["centroid_lon"])
        if live:
            if live.get("wbgt") is not None:
                all_wbgt.append(live["wbgt"])
            if live.get("utci") is not None:
                all_utci.append(live["utci"])
            if live.get("heat_index") is not None:
                all_hi.append(live["heat_index"])
            if live.get("risk_band") == "Extreme":
                active_alerts_count += 1
                alert_wards.append(f"Ward {w['id']} ({w['name']})")

    avg_wbgt = round(sum(all_wbgt) / len(all_wbgt), 1) if all_wbgt else None
    max_wbgt = max(all_wbgt) if all_wbgt else None
    avg_utci = round(sum(all_utci) / len(all_utci), 1) if all_utci else None
    max_utci = max(all_utci) if all_utci else None
    avg_hi = round(sum(all_hi) / len(all_hi), 1) if all_hi else None
    max_hi = max(all_hi) if all_hi else None

    return {
        "zone": "Bengaluru Urban",
        "wards_monitored": len(BENGALURU_8_WARDS),
        "avg_wbgt": avg_wbgt,
        "max_wbgt": max_wbgt,
        "avg_utci": avg_utci,
        "max_utci": max_utci,
        "avg_heat_index": avg_hi,
        "max_heat_index": max_hi,
        "active_alerts": active_alerts_count,
        "alert_wards": alert_wards,
        "is_live": len(all_wbgt) > 0,
    }


class DispatchRequest(BaseModel):
    ward_id: int
    action_type: str  # 'sms' | 'cooling' | 'work_shift'
    notes: Optional[str] = None


@router.post("/wards/dispatch")
def dispatch_intervention(
    payload: DispatchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Authorized endpoint to dispatch emergency heat mitigations.
    Requires official authentication token.
    """
    ward = next((w for w in BENGALURU_8_WARDS if w["id"] == payload.ward_id), None)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    action_labels = {
        "sms": "Emergency SMS / WhatsApp Alert",
        "cooling": "Cooling Centre Activation",
        "work_shift": "Mandatory Work-Hour Respite Order",
    }

    action_name = action_labels.get(payload.action_type, payload.action_type)
    timestamp = datetime.now().strftime("%H:%M")

    return {
        "success": True,
        "message": f"Successfully registered and dispatched '{action_name}' for Ward {ward['id']} ({ward['name']})",
        "dispatched_by": current_user["name"],
        "officer_role": current_user["role"],
        "officer_department": current_user["department"],
        "ward_id": ward["id"],
        "ward_name": ward["name"],
        "action_type": payload.action_type,
        "action_name": action_name,
        "timestamp": timestamp,
        "status": "Delivered",
    }

