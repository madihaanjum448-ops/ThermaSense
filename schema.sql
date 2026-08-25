-- Heatwave Early Warning System — Day 1 Schema
-- Run this after enabling PostGIS on your database:
--   CREATE EXTENSION IF NOT EXISTS postgis;

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- WARDS: ward/zone boundaries + demographic vulnerability data
-- ============================================================
CREATE TABLE IF NOT EXISTS wards (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    geom            GEOMETRY(MultiPolygon, 4326),   -- ward boundary polygon (WGS84)
    centroid_lat    DOUBLE PRECISION,                 -- convenience column for API calls
    centroid_lon    DOUBLE PRECISION,
    population      INTEGER,
    elderly_pct     NUMERIC(5,2),                       -- % population 60+
    outdoor_worker_pct NUMERIC(5,2),                     -- % population in outdoor occupations
    -- EXTRA FEATURE: additional vulnerability signals beyond the base spec
    slum_household_pct NUMERIC(5,2),                     -- % households in informal/slum housing (poor cooling access)
    green_cover_pct     NUMERIC(5,2),                    -- % ward area under vegetation (urban heat island proxy)
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wards_geom ON wards USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_wards_city ON wards (city);

-- ============================================================
-- WEATHER_READINGS: raw ingested weather data, live + forecast
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_readings (
    id              BIGSERIAL PRIMARY KEY,
    ward_id         INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    reading_time    TIMESTAMPTZ NOT NULL,          -- the time this reading applies to
    fetched_at      TIMESTAMPTZ DEFAULT now(),      -- when we pulled it
    is_forecast     BOOLEAN DEFAULT FALSE,
    temp_c          NUMERIC(5,2),
    humidity_pct    NUMERIC(5,2),
    wind_speed_ms   NUMERIC(6,2),
    solar_radiation_wm2 NUMERIC(8,2),               -- from NASA POWER
    source          VARCHAR(50) NOT NULL,           -- 'openweathermap' | 'nasa_power' | 'imd'
    -- EXTRA FEATURE: raw payload kept for debugging / re-processing without a re-fetch
    raw_payload     JSONB
);

CREATE INDEX IF NOT EXISTS idx_weather_ward_time ON weather_readings (ward_id, reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_weather_forecast ON weather_readings (is_forecast);

-- Prevent duplicate rows if the scheduler runs twice for the same slot/source
CREATE UNIQUE INDEX IF NOT EXISTS uq_weather_ward_time_source
    ON weather_readings (ward_id, reading_time, source);

-- ============================================================
-- RISK_SCORES: computed thermal stress + risk band per ward
-- (filled in by Pair B's thermal engine on Day 1/Day 2 — table
--  is created now so both pairs can work against it immediately)
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_scores (
    id              BIGSERIAL PRIMARY KEY,
    ward_id         INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    score_time      TIMESTAMPTZ NOT NULL,
    is_forecast     BOOLEAN DEFAULT FALSE,
    heat_index_c    NUMERIC(5,2),
    wbgt_c          NUMERIC(5,2),
    utci_c          NUMERIC(5,2),
    risk_band       VARCHAR(20),                    -- 'low' | 'moderate' | 'high' | 'extreme'
    risk_score_raw  NUMERIC(6,3),                    -- underlying weighted numeric score
    computed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_ward_time ON risk_scores (ward_id, score_time DESC);

-- ============================================================
-- ALERTS_LOG: record of alerts dispatched
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts_log (
    id              BIGSERIAL PRIMARY KEY,
    ward_id         INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    triggered_at    TIMESTAMPTZ DEFAULT now(),
    risk_band       VARCHAR(20),
    channel         VARCHAR(20),                    -- 'sms' | 'whatsapp' | 'webhook'
    message         TEXT,
    status          VARCHAR(20) DEFAULT 'pending'    -- 'sent' | 'failed' | 'pending'
);

CREATE INDEX IF NOT EXISTS idx_alerts_ward ON alerts_log (ward_id, triggered_at DESC);
