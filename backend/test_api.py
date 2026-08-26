import asyncio
import json
from urllib.parse import urlparse
from app.main import app

async def asgi_get(path_with_query: str):
    parsed = urlparse(path_with_query)
    scope = {
        'type': 'http',
        'http_version': '1.1',
        'method': 'GET',
        'path': parsed.path,
        'raw_path': parsed.path.encode('utf-8'),
        'query_string': parsed.query.encode('utf-8'),
        'headers': []
    }
    response_body = []

    async def send(message):
        if message['type'] == 'http.response.body':
            response_body.append(message.get('body', b''))

    async def receive():
        return {'type': 'http.request', 'body': b'', 'more_body': False}

    await app(scope, receive, send)
    return json.loads(b''.join(response_body).decode('utf-8'))

async def main():
    print("--- Root ---")
    print(await asgi_get("/"))

    print("\n--- Existing Endpoints ---")
    print("Heat Index:", await asgi_get("/thermal/heat_index?tdb=30&rh=70"))
    print("WBGT:", await asgi_get("/thermal/wbgt?twb=25&tg=30&tdb=30&with_solar_load=true"))
    print("UTCI:", await asgi_get("/thermal/utci?tdb=29&tr=32&v=1.0&rh=60"))

    print("\n--- New Derivation Endpoint ---")
    params = {
        "temp_c": 32.0,
        "humidity": 50.0,
        "wind_ms": 2.0,
        "solar_rad": 800.0,
        "timestamp": "2023-07-15T20:00:00Z",  # Solar noon in Los Angeles (13:00 PDT)
        "latitude": 34.0522,  # Los Angeles
        "longitude": -118.2437
    }

    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    response = await asgi_get(f"/thermal/derive_all?{query_string}")
    print(json.dumps(response, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
