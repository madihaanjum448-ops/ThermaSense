import sys
import os

# Ensure root in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db
from sqlalchemy import text

def update_wards():
    print("Connecting to database...")
    with db.engine.begin() as conn:
        print("Executing wards update query...")
        conn.execute(text("""
            UPDATE wards SET
                population = COALESCE(population, 150000),
                elderly_pct = COALESCE(elderly_pct, 9.20),
                outdoor_worker_pct = COALESCE(outdoor_worker_pct, 18.50),
                slum_household_pct = COALESCE(slum_household_pct, 14.80),
                green_cover_pct = COALESCE(green_cover_pct, 15.60),
                geom = COALESCE(geom, ST_Multi(ST_Buffer(ST_SetSRID(ST_Point(centroid_lon, centroid_lat), 4326), 0.02)))
        """))
        print("Wards updated successfully with geometries and demographics!")

if __name__ == "__main__":
    try:
        update_wards()
    except Exception as e:
        print(f"Error: {e}")
