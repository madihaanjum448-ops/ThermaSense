import os
import requests
from dotenv import load_dotenv

load_dotenv()

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
LAT = os.getenv("DEMO_CITY_LAT", "12.9716")
LON = os.getenv("DEMO_CITY_LON", "77.5946")


def fetch_openweather():
    url = "https://api.openweathermap.org/data/2.5/weather"

    params = {
        "lat": LAT,
        "lon": LON,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    return {
        "source": "OpenWeatherMap",
        "temperature_c": data["main"]["temp"],
        "humidity_percent": data["main"]["humidity"],
        "wind_ms": data["wind"]["speed"],
    }


def fetch_nasa_power():
    url = "https://power.larc.nasa.gov/api/temporal/hourly/point"

    params = {
        "parameters": "T2M,RH2M,WS2M,ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": LON,
        "latitude": LAT,
        "format": "JSON",
    }

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()

    data = response.json()

    parameters = data["properties"]["parameter"]

    # NASA POWER returns hourly values keyed by timestamp.
    # Pick the latest available hourly observation.
    timestamps = sorted(parameters["T2M"].keys())
    latest = timestamps[-1]

    return {
        "source": "NASA POWER",
        "timestamp": latest,
        "temperature_c": parameters["T2M"][latest],
        "humidity_percent": parameters["RH2M"][latest],
        "wind_ms": parameters["WS2M"][latest],
        "solar_radiation": parameters["ALLSKY_SFC_SW_DWN"][latest],
    }


if __name__ == "__main__":
    print("\n=== ThermaSense Weather Ingestion ===\n")

    print("Fetching OpenWeatherMap...")
    try:
        print(fetch_openweather())
    except Exception as e:
        print(f"OpenWeatherMap error: {e}")

    print("\nFetching NASA POWER...")
    try:
        print(fetch_nasa_power())
    except Exception as e:
        print(f"NASA POWER error: {e}")
