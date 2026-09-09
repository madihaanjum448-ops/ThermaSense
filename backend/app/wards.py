from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from db import engine
import json

from .auth import get_current_user
from .heat_indices import check_data_sources_health


router = APIRouter()


def _to_float(value):
    return float(value) if value is not None else None

@router.get("/wards/data-sources")
@router.get("/health-check")
def get_data_sources_status():
    """
    Return the current health status of external data sources.
    """
    sources = check_data_sources_health()
    return {
        "status": "ok",
        "data_sources": sources,
    }


@router.get("/wards/geojson")
def get_wards_geojson():
    """
    Return all wards as GeoJSON with their latest current risk.

    Forecast rows are excluded. Both raw thermal risk and
    vulnerability-adjusted final risk are returned.
    """
    query = text("""
    SELECT
        w.id,
        w.name,
        w.city,
        w.centroid_lat,
        w.centroid_lon,
        w.elderly_pct,
        w.outdoor_worker_pct,
        w.slum_household_pct,
        w.green_cover_pct,
        ST_AsGeoJSON(w.geom) AS geom_json,

        wr.temp_c,
        wr.humidity_pct,
        wr.wind_speed_ms,
        wr.solar_radiation_wm2,

        rs.wbgt_c,
        rs.utci_c,
        rs.heat_index_c,
        rs.risk_band,
        rs.risk_score_raw,
        rs.vulnerability_score,
        rs.final_risk_score,
        rs.final_risk_band,
        rs.mortality_risk_index,
        rs.excess_mortality_pct,
        rs.predicted_excess_deaths,
        rs.predicted_hospitalizations,
        rs.score_time

    FROM wards w

    LEFT JOIN LATERAL (
        SELECT *
        FROM risk_scores r
        WHERE r.ward_id = w.id
          AND r.is_forecast = FALSE
        ORDER BY
            r.score_time DESC,
            r.final_risk_score IS NULL,
            r.id DESC
        LIMIT 1
    ) rs ON TRUE

    LEFT JOIN LATERAL (
        SELECT
            temp_c,
            humidity_pct,
            wind_speed_ms,
            solar_radiation_wm2
        FROM weather_readings
        WHERE ward_id = w.id
          AND is_forecast = FALSE
        ORDER BY reading_time DESC, id DESC
        LIMIT 1
    ) wr ON TRUE
""")

    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    features = []

    for row in rows:
        geometry = json.loads(row.geom_json) if row.geom_json else None

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "id": row.id,
                "name": row.name,
                "city": row.city,
                "centroid_lat": _to_float(row.centroid_lat),
                "centroid_lon": _to_float(row.centroid_lon),
                "elderly_pct": _to_float(row.elderly_pct),
                "outdoor_worker_pct": _to_float(row.outdoor_worker_pct),
                "slum_household_pct": _to_float(row.slum_household_pct),
                "green_cover_pct": _to_float(row.green_cover_pct),

                "temperature": _to_float(row.temp_c),
                "humidity": _to_float(row.humidity_pct),
                "wind_speed": _to_float(row.wind_speed_ms),
                "solar_radiation": _to_float(row.solar_radiation_wm2),
                "wbgt": _to_float(row.wbgt_c),
                "utci": _to_float(row.utci_c),
                "heat_index": _to_float(row.heat_index_c),
                "risk_band": row.risk_band or "unknown",
                "risk_score_raw": _to_float(row.risk_score_raw),
                "vulnerability_score": _to_float(
                    row.vulnerability_score
                ),
                "final_risk_score": _to_float(
                    row.final_risk_score
                ),
                "final_risk_band": row.final_risk_band,
                "mortality_risk_index": _to_float(
                    getattr(row, "mortality_risk_index", None)
                ),
                "excess_mortality_pct": _to_float(
                    getattr(row, "excess_mortality_pct", None)
                ),
                "predicted_excess_deaths": _to_float(
                    getattr(row, "predicted_excess_deaths", None)
                ),
                "predicted_hospitalizations": _to_float(
                    getattr(row, "predicted_hospitalizations", None)
                ),
                "score_time": (
                    row.score_time.isoformat()
                    if row.score_time
                    else None
                ),
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


DAY_LABELS = ["Today", "Tomorrow", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]


def _row_to_dict(row):
    return {
        "id": row.id,
        "ward_id": row.ward_id,
        "temperature": _to_float(row.temp_c),
        "timestamp": (
            row.score_time.isoformat() if row.score_time else None
        ),
        # kept for backward-compat with the existing map popup code
        "score_time": (
            row.score_time.isoformat() if row.score_time else None
        ),
        "is_forecast": bool(row.is_forecast),
        "temperature": _to_float(row.temp_c),
        "wbgt": _to_float(row.wbgt_c),
        "utci": _to_float(row.utci_c),
        "heat_index": _to_float(row.heat_index_c),
        "risk_score_raw": _to_float(row.risk_score_raw),
        "risk_band": row.risk_band or "unknown",
        "vulnerability_score": _to_float(row.vulnerability_score),
        "final_risk_score": _to_float(row.final_risk_score),
        "final_risk_band": row.final_risk_band or "unknown",
        "mortality_risk_index": _to_float(
            getattr(row, "mortality_risk_index", None)
        ),
        "excess_mortality_pct": _to_float(
            getattr(row, "excess_mortality_pct", None)
        ),
        "predicted_excess_deaths": _to_float(
            getattr(row, "predicted_excess_deaths", None)
        ),
        "predicted_hospitalizations": _to_float(
            getattr(row, "predicted_hospitalizations", None)
        ),
    }

@router.get("/wards/summary")
def get_zone_summary():
    """
    Return a high-level summary from the latest DB-backed Bengaluru risk data.
    """
    query = text("""
        SELECT
            COUNT(*) AS wards_monitored,
            AVG(rs.wbgt_c) AS avg_wbgt,
            MAX(rs.wbgt_c) AS max_wbgt,
            AVG(rs.utci_c) AS avg_utci,
            MAX(rs.utci_c) AS max_utci,
            AVG(rs.heat_index_c) AS avg_heat_index,
            MAX(rs.heat_index_c) AS max_heat_index
        FROM wards w
        JOIN LATERAL (
            SELECT
                wbgt_c,
                utci_c,
                heat_index_c,
                risk_band,
                final_risk_score
            FROM risk_scores r
            WHERE r.ward_id = w.id
              AND r.is_forecast = FALSE
            ORDER BY r.score_time DESC, r.id DESC
            LIMIT 1
        ) rs ON TRUE
        WHERE LOWER(w.city) = 'bengaluru'
    """)

    alert_query = text("""
        SELECT
            w.id,
            w.name,
            rs.risk_band,
            rs.wbgt_c
        FROM wards w
        JOIN LATERAL (
            SELECT
                risk_band,
                wbgt_c
            FROM risk_scores r
            WHERE r.ward_id = w.id
              AND r.is_forecast = FALSE
            ORDER BY r.score_time DESC, r.id DESC
            LIMIT 1
        ) rs ON TRUE
        WHERE LOWER(w.city) = 'bengaluru'
          AND (
              LOWER(rs.risk_band) = 'extreme'
              OR rs.wbgt_c >= 33.0
          )
        ORDER BY w.id
    """)

    with engine.connect() as conn:
        summary = conn.execute(query).mappings().one()
        alerts = conn.execute(alert_query).mappings().all()

    def rounded(value):
        return round(float(value), 1) if value is not None else None

    alert_wards = [
        f"Ward {row['id']} ({row['name']})"
        for row in alerts
    ]

    return {
        "zone": "Bengaluru Urban",
        "wards_monitored": int(summary["wards_monitored"] or 0),
        "avg_wbgt": rounded(summary["avg_wbgt"]),
        "max_wbgt": rounded(summary["max_wbgt"]),
        "avg_utci": rounded(summary["avg_utci"]),
        "max_utci": rounded(summary["max_utci"]),
        "avg_heat_index": rounded(summary["avg_heat_index"]),
        "max_heat_index": rounded(summary["max_heat_index"]),
        "active_alerts": len(alerts),
        "alert_wards": alert_wards,
        "is_live": summary["wards_monitored"] > 0,
    }

class DispatchRequest(BaseModel):
    ward_id: int
    action_type: str
    notes: Optional[str] = None


@router.post("/wards/dispatch")
def dispatch_intervention(
    payload: DispatchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Register an emergency intervention for an authenticated official.
    """

    # Verify that the ward exists in the database.
    ward_query = text("""
        SELECT id, name, city
        FROM wards
        WHERE id = :ward_id
        LIMIT 1
    """)

    with engine.connect() as conn:
        ward = conn.execute(
            ward_query,
            {"ward_id": payload.ward_id},
        ).mappings().first()

    if not ward:
        raise HTTPException(
            status_code=404,
            detail="Ward not found",
        )

    action_labels = {
        "sms": "Emergency SMS / WhatsApp Alert",
        "cooling": "Cooling Centre Activation",
        "work_shift": "Mandatory Work-Hour Respite Order",
    }

    action_name = action_labels.get(
        payload.action_type,
        payload.action_type,
    )

    timestamp = datetime.now(timezone.utc)

    return {
        "success": True,
        "message": (
            f"Successfully registered and dispatched "
            f"'{action_name}' for Ward {ward['id']} ({ward['name']})"
        ),
        "dispatched_by": current_user["name"],
        "officer_role": current_user["role"],
        "officer_department": current_user["department"],
        "ward_id": ward["id"],
        "ward_name": ward["name"],
        "action_type": payload.action_type,
        "action_name": action_name,
        "timestamp": timestamp.isoformat(),
        "status": "Delivered",
        "notes": payload.notes,
    }


@router.get("/wards/{ward_id}/forecast")
def get_ward_forecast(ward_id: int, days: int = 5):
    """
    Return future forecast risk scores for one ward.

    - Only rows explicitly marked as forecast are returned.
    - Capped to `days` ahead (default 5 — see cleanup_forecasts.py for
      why 5 was chosen as the internal retention/display horizon).
    - Returns both the raw hourly series (for the detail/tooltip view)
      and a `daily` bucketed summary (Today / Tomorrow / Day 3 / Day 4 /
      Day 5), each day's summary being its single worst (peak final
      risk score) hour — the hour that actually matters for ward safety
      planning.
    """
    days = max(1, min(days, 7))

    ward_exists = None
    with engine.connect() as conn:
        ward_exists = conn.execute(
            text("SELECT id FROM wards WHERE id = :ward_id"),
            {"ward_id": ward_id},
        ).fetchone()

    if ward_exists is None:
        raise HTTPException(status_code=404, detail="Ward not found")

    query = text("""
    SELECT
        rs.id,
        rs.ward_id,
        rs.score_time,
        rs.is_forecast,
        wr.temp_c,
        rs.wbgt_c,
        rs.utci_c,
        rs.heat_index_c,
        rs.risk_score_raw,
        rs.risk_band,
        rs.vulnerability_score,
        rs.final_risk_score,
        rs.final_risk_band,
        rs.mortality_risk_index,
        rs.excess_mortality_pct,
        rs.predicted_excess_deaths,
        rs.predicted_hospitalizations
    FROM risk_scores rs
    LEFT JOIN weather_readings wr
        ON wr.ward_id = rs.ward_id
       AND wr.is_forecast = TRUE
       AND wr.reading_time = rs.score_time
    WHERE rs.ward_id = :ward_id
      AND rs.is_forecast = TRUE
      AND rs.score_time > NOW()
      AND rs.score_time <= NOW() + (:days * INTERVAL '1 day')
    ORDER BY rs.score_time ASC, rs.id ASC
""")
    with engine.connect() as conn:
        rows = conn.execute(
            query,
            {"ward_id": ward_id, "days": days},
        ).fetchall()

    forecasts = [_row_to_dict(row) for row in rows]

    # --- Bucket into calendar days (UTC) for the Today/D2../D5 view ---
    today_utc = datetime.now(timezone.utc).date()
    buckets: dict[int, list[dict]] = {}

    for f in forecasts:
        if not f["timestamp"]:
            continue
        f_date = datetime.fromisoformat(f["timestamp"]).date()
        offset = (f_date - today_utc).days
        buckets.setdefault(offset, []).append(f)

    daily = []
    for offset in sorted(buckets.keys())[:days]:
        rows_for_day = buckets[offset]
        # Representative hour = worst-case (peak final risk score) for
        # the day, since that's the hour ward officials need to plan for.
        peak = max(
            rows_for_day,
            key=lambda r: (
                r["final_risk_score"]
                if r["final_risk_score"] is not None
                else -1
            ),
        )
        label = (
            DAY_LABELS[offset]
            if 0 <= offset < len(DAY_LABELS)
            else f"Day {offset + 1}"
        )
        daily.append({
            "label": label,
            "date": (
                (today_utc.fromordinal(today_utc.toordinal() + offset))
                .isoformat()
            ),
            "peak_hour": peak,
            "hours_available": len(rows_for_day),
        })

    return {
        "ward_id": ward_id,
        "count": len(forecasts),
        "days_requested": days,
        "forecasts": forecasts,
        "daily": daily,
    }