from fastapi import APIRouter
from sqlalchemy import text
from db import engine
import json


router = APIRouter()


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
                "centroid_lat": (
                    float(row.centroid_lat)
                    if row.centroid_lat is not None
                    else None
                ),
                "centroid_lon": (
                    float(row.centroid_lon)
                    if row.centroid_lon is not None
                    else None
                ),
                "wbgt": (
                    float(row.wbgt_c)
                    if row.wbgt_c is not None
                    else None
                ),
                "utci": (
                    float(row.utci_c)
                    if row.utci_c is not None
                    else None
                ),
                "heat_index": (
                    float(row.heat_index_c)
                    if row.heat_index_c is not None
                    else None
                ),
                "risk_band": row.risk_band or "unknown",
                "risk_score_raw": (
                    float(row.risk_score_raw)
                    if row.risk_score_raw is not None
                    else None
                ),
                "vulnerability_score": (
                    float(row.vulnerability_score)
                    if row.vulnerability_score is not None
                    else None
                ),
                "final_risk_score": (
                    float(row.final_risk_score)
                    if row.final_risk_score is not None
                    else None
                ),
                "final_risk_band": (
                    row.final_risk_band
                    if row.final_risk_band is not None
                    else None
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