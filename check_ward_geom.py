from db import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("""
        SELECT id, name, city,
               geom IS NOT NULL AS has_polygon,
               centroid_lat, centroid_lon
        FROM wards
        ORDER BY id
    """)).fetchall()

for row in rows:
    print(dict(row._mapping))
