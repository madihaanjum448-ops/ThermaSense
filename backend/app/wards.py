from fastapi import APIRouter
from sqlalchemy import text
from db import engine
import json

router = APIRouter()


@router.get("/wards/geojson")
def get_wards_geojson():
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
            rs.score_time
        FROM wards w
        LEFT JOIN LATERAL (
            SELECT *
            FROM risk_scores r
            WHERE r.ward_id = w.id
              AND r.is_forecast = FALSE
            ORDER BY r.score_time DESC
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
                "centroid_lat": float(row.centroid_lat)
                    if row.centroid_lat else None,
                "centroid_lon": float(row.centroid_lon)
                    if row.centroid_lon else None,
                "wbgt": float(row.wbgt_c)
                    if row.wbgt_c is not None else None,
                "utci": float(row.utci_c)
                    if row.utci_c is not None else None,
                "heat_index": float(row.heat_index_c)
                    if row.heat_index_c is not None else None,
                "risk_band": row.risk_band or "unknown",
                "risk_score_raw": float(row.risk_score_raw)
                    if row.risk_score_raw is not None else None,
                "score_time": row.score_time.isoformat()
                    if row.score_time else None,
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }
