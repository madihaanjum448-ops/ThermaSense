from fastapi import APIRouter
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


@router.get("/wards/{ward_id}/forecast")
def get_ward_forecast(ward_id: int):
    """
    Return future forecast risk scores for one ward.

    Only rows explicitly marked as forecast are returned.
    Results are ordered chronologically.
    """
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
            final_risk_band
        FROM risk_scores
        WHERE ward_id = :ward_id
          AND is_forecast = TRUE
          AND score_time > NOW()
        ORDER BY score_time ASC, id ASC
    """)

    with engine.connect() as conn:
        rows = conn.execute(
            query,
            {"ward_id": ward_id},
        ).fetchall()

    forecasts = []

    for row in rows:
        forecasts.append({
            "id": row.id,
            "ward_id": row.ward_id,
            "score_time": (
                row.score_time.isoformat()
                if row.score_time
                else None
            ),
            "is_forecast": bool(row.is_forecast),
            "wbgt": _to_float(row.wbgt_c),
            "utci": _to_float(row.utci_c),
            "heat_index": _to_float(row.heat_index_c),
            "risk_score_raw": _to_float(row.risk_score_raw),
            "risk_band": row.risk_band or "unknown",
            "vulnerability_score": _to_float(
                row.vulnerability_score
            ),
            "final_risk_score": _to_float(
                row.final_risk_score
            ),
            "final_risk_band": row.final_risk_band,
        })

    return {
        "ward_id": ward_id,
        "count": len(forecasts),
        "forecasts": forecasts,
    }