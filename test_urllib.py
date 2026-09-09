import urllib.request
import json

base = "http://127.0.0.1:8080"
urls = [
    "/thermal/heat_index?tdb=30&rh=70",
    "/thermal/wbgt?twb=25&tg=30&tdb=30&with_solar_load=true",
    "/thermal/utci?tdb=29&tr=32&v=1.0&rh=60",
    "/thermal/derive_all?temp_c=32.0&humidity=50.0&wind_ms=2.0&solar_rad=800.0&timestamp=2023-07-15T14:00:00Z&latitude=34.0522&longitude=-118.2437"
]
for url in urls:
    req = urllib.request.Request(base + url)
    try:
        with urllib.request.urlopen(req) as response:
            print(f"GET {url}\n{json.dumps(json.loads(response.read()), indent=2)}\n")
    except Exception as e:
        print(f"Error {url}: {e}\n")
