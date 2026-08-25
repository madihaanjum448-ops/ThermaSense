"""
db.py — connection + helper functions for the 4 core tables.

Uses SQLAlchemy Core (not the full ORM) — simpler to reason about for a
hackathon, and Pair B's FastAPI service can import these same helpers
directly instead of writing its own DB layer.
"""

import os
import json
from datetime import datetime, timezone

from sqlalchemy import (
    create_engine, MetaData, Table, Column, Integer, BigInteger, String,
    Numeric, Boolean, TIMESTAMP, ForeignKey, text
)
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://heatwave:heatwave_dev_pw@localhost:5432/heatwave",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
metadata = MetaData()

wards = Table(
    "wards", metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String),
    Column("city", String),
    Column("geom", Geometry("MULTIPOLYGON", srid=4326)),
    Column("centroid_lat", Numeric),
    Column("centroid_lon", Numeric),
    Column("population", Integer),
    Column("elderly_pct", Numeric),
    Column("outdoor_worker_pct", Numeric),
    Column("slum_household_pct", Numeric),
    Column("green_cover_pct", Numeric),
)

weather_readings = Table(
    "weather_readings", metadata,
    Column("id", BigInteger, primary_key=True),
    Column("ward_id", Integer, ForeignKey("wards.id")),
    Column("reading_time", TIMESTAMP(timezone=True)),
    Column("fetched_at", TIMESTAMP(timezone=True)),
    Column("is_forecast", Boolean),
    Column("temp_c", Numeric),
    Column("humidity_pct", Numeric),
    Column("wind_speed_ms", Numeric),
    Column("solar_radiation_wm2", Numeric),
    Column("source", String),
    Column("raw_payload", JSONB),
)


def get_wards(city: str | None = None):
    """Return all wards, optionally filtered by city."""
    with engine.connect() as conn:
        query = "SELECT id, name, city, centroid_lat, centroid_lon FROM wards"
        params = {}
        if city:
            query += " WHERE city = :city"
            params["city"] = city
        return [dict(row._mapping) for row in conn.execute(text(query), params)]


def insert_ward(name: str, city: str, lat: float, lon: float,
                 population: int = None, elderly_pct: float = None,
                 outdoor_worker_pct: float = None,
                 slum_household_pct: float = None,
                 green_cover_pct: float = None) -> int:
    """
    Insert a ward using just a centroid point for now (Day 1 — real polygon
    boundaries get loaded separately once osmnx/Bhuvan data is pulled).
    Returns the new ward's id.
    """
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                INSERT INTO wards (name, city, centroid_lat, centroid_lon,
                                    population, elderly_pct, outdoor_worker_pct,
                                    slum_household_pct, green_cover_pct)
                VALUES (:name, :city, :lat, :lon, :population, :elderly_pct,
                        :outdoor_worker_pct, :slum_household_pct, :green_cover_pct)
                RETURNING id
            """),
            dict(name=name, city=city, lat=lat, lon=lon, population=population,
                 elderly_pct=elderly_pct, outdoor_worker_pct=outdoor_worker_pct,
                 slum_household_pct=slum_household_pct, green_cover_pct=green_cover_pct),
        )
        return result.scalar_one()


def insert_weather_reading(ward_id: int, reading_time: datetime, source: str,
                            temp_c: float = None, humidity_pct: float = None,
                            wind_speed_ms: float = None,
                            solar_radiation_wm2: float = None,
                            is_forecast: bool = False, raw_payload: dict = None):
    """
    Insert one weather reading. Uses ON CONFLICT so the scheduler can safely
    re-run without creating duplicate rows for the same ward/time/source.
    """
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO weather_readings
                    (ward_id, reading_time, fetched_at, is_forecast, temp_c,
                     humidity_pct, wind_speed_ms, solar_radiation_wm2, source, raw_payload)
                VALUES
                    (:ward_id, :reading_time, :fetched_at, :is_forecast, :temp_c,
                     :humidity_pct, :wind_speed_ms, :solar_radiation_wm2, :source, :raw_payload)
                ON CONFLICT (ward_id, reading_time, source)
                DO UPDATE SET
                    temp_c = EXCLUDED.temp_c,
                    humidity_pct = EXCLUDED.humidity_pct,
                    wind_speed_ms = EXCLUDED.wind_speed_ms,
                    solar_radiation_wm2 = EXCLUDED.solar_radiation_wm2,
                    fetched_at = EXCLUDED.fetched_at,
                    raw_payload = EXCLUDED.raw_payload
            """),
            dict(
                ward_id=ward_id, reading_time=reading_time,
                fetched_at=datetime.now(timezone.utc), is_forecast=is_forecast,
                temp_c=temp_c, humidity_pct=humidity_pct, wind_speed_ms=wind_speed_ms,
                solar_radiation_wm2=solar_radiation_wm2, source=source,
                raw_payload=json.dumps(raw_payload) if raw_payload else None,
            ),
        )


def latest_reading(ward_id: int, source: str | None = None):
    """Convenience getter — used by Pair B's engine and for quick debugging."""
    with engine.connect() as conn:
        query = """
            SELECT * FROM weather_readings
            WHERE ward_id = :ward_id AND is_forecast = FALSE
        """
        params = {"ward_id": ward_id}
        if source:
            query += " AND source = :source"
            params["source"] = source
        query += " ORDER BY reading_time DESC LIMIT 1"
        row = conn.execute(text(query), params).fetchone()
        return dict(row._mapping) if row else None
