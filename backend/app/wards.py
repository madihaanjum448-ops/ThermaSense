from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from db import engine
import json


router = APIRouter()


def _to_float(value):
    return float(value) if value is not None else None


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
            ST_AsGeoJSON(w.geom) AS geom_json,
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
        "timestamp": (
            row.score_time.isoformat() if row.score_time else None
        ),
        # kept for backward-compat with the existing map popup code
        "score_time": (
            row.score_time.isoformat() if row.score_time else None
        ),
        "is_forecast": bool(row.is_forecast),
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
            id,
            ward_id,
            score_time,
            is_forecast,
            wbgt_c,
            utci_c,
            heat_index_c,
            risk_score_raw,
            risk_band,
            vulnerability_score,
            final_risk_score,
            final_risk_band,
            mortality_risk_index,
            excess_mortality_pct,
            predicted_excess_deaths,
            predicted_hospitalizations
        FROM risk_scores
        WHERE ward_id = :ward_id
          AND is_forecast = TRUE
          AND score_time > NOW()
         AND score_time <= NOW() + (:days * INTERVAL '1 day')
        ORDER BY score_time ASC, id ASC
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