# ThermaSense

AI-powered Heatwave Early Warning and Thermal Stress Index system.

# Day 1 — Pair A Deliverable: Data Layer + DB Setup 
 
## What's in here 
 
- `schema.sql` — the 4 core tables (wards, weather_readings, risk_scores, alerts_log), PostGIS-enabled 
- `docker-compose.yml` — optional local Postgres+PostGIS for dev (use Supabase for the actual demo — see below) 
- `db.py` — connection + insert/read helper functions, shared with Pair B 
- `fetch_weather.py` — OpenWeatherMap One Call API (current + 5-day forecast), with retry + fallback 
- `fetch_solar.py` — NASA POWER solar radiation (needed for WBGT) 
- `test_fetch.py` — end-to-end test script, works in `--mock` mode with no keys/DB 
- `.env.example` — copy to `.env` and fill in your real keys 
- `requirements.txt` 
 
## Setup steps (do this first, in order) 
 
1. **Create your DB.** Fastest path: go to supabase.com → New Project → free tier. Once created, go to Database settings, enable the PostGIS extension (Database → Extensions → search "postgis" → enable). Copy the connection string into `.env` as `DATABASE_URL`. 
   - Alternative: `docker compose up -d` runs Postgres+PostGIS locally using `docker-compose.yml` (schema.sql auto-runs on first boot). 
2. **Get your OpenWeatherMap key.** Sign up free at openweathermap.org → API Keys tab → copy into `.env` as `OPENWEATHERMAP_API_KEY`. Note: new keys can take up to ~1 hour to activate — do this immediately, don't wait. 
3. **(Optional but recommended) Get a WeatherAPI.com key** for the fallback path — free tier, instant activation, into `.env` as `WEATHERAPI_KEY`. 
4. **Install dependencies:** `pip install -r requirements.txt` (use `--break-system-packages` if needed, or a venv). 
5. **Run the schema** (skip this if you used docker-compose, it auto-runs): connect to your DB and run `schema.sql`, e.g. `psql $DATABASE_URL -f schema.sql`. 
6. **Sanity check without any keys yet:** `python test_fetch.py --mock` — confirms the code logic is sound before your keys/DB are even ready. 
7. **Once keys + DB are set:** `python test_fetch.py` (no flag) — this is your real Day 1 acceptance test. It inserts a sample ward, fetches live weather + solar data, writes it to the DB, and reads it back to confirm the full chain works. 
 
## Handoff to Pair B (thermal engine) 
 
Pair B can start immediately using `db.latest_reading(ward_id)` to pull real `temp_c`, `humidity_pct`, `wind_speed_ms`, `solar_radiation_wm2` values once this test passes — that's the exact input their WBGT/UTCI functions need. 
 
--- 
 
## Extra features included (to stand out from other teams) 
 
Most teams building this problem statement will do the bare minimum: one weather API, temp + humidity only, no error handling. These additions cost little extra time but are the kind of thing judges specifically probe for under "feasibility" and "real-world constraints": 
 
1. **Solar radiation via NASA POWER, not just temp/humidity.** This is explicitly what the problem statement calls out as missing from standard forecasts ("ignore the deadly compounding effects of ... solar radiation") — most teams will skip this because it's an extra API to integrate. You're already doing it on Day 1. 
2. **Automatic fallback to a secondary weather source** (`fetch_with_fallback`) — if OpenWeatherMap goes down or rate-limits during your live demo, the system degrades gracefully instead of showing a blank dashboard. This directly answers the "what happens if an API goes down" question before a judge even asks it. 
3. **Retry with exponential backoff** (via `tenacity`) on every external call — protects your scheduled ingestion job from transient network blips, which is the kind of production-readiness detail that separates a hackathon toy from something "actually deployable" (checklist point 4). 
4. **Raw payload storage** (`raw_payload JSONB` column) — every API response is kept, not just the parsed fields. If you discover a bug in your parsing logic on Day 3, you can re-process historical data without re-fetching it, and it's also great for live-debugging in front of judges ("here's the exact raw API response backing this number"). 
5. **Extra vulnerability signals beyond the base spec:** `slum_household_pct` (informal housing has far worse cooling access) and `green_cover_pct` (a proxy for urban heat island effect — wards with less vegetation run hotter). These feed directly into a richer, more defensible risk score in Pair B's engine than "just weather severity," and they're an easy talking point for the "innovation" section of your pitch. 
6. **Idempotent inserts** (`ON CONFLICT ... DO UPDATE`) — the scheduler can safely re-run or retry without creating duplicate rows, which matters once you're running this continuously across a multi-day hackathon. 
7. **Coordinate-rounding cache for NASA POWER batch fetches** — since NASA POWER is the slowest source, wards that are geographically close reuse one API call instead of each ward making its own slow request. Keeps your scheduled job fast even as you add more wards. 
 
None of these are required to pass Day 1 — the priority order is: get `test_fetch.py` (live mode) passing first, then layer in fallback/retry/extra fields if time allows same-day. But if you're looking to visibly differentiate from other teams in this exact layer, these are the additions worth having ready to explain in your pitch.