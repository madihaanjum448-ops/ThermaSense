from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print(client.get("/").json())
print(client.get("/thermal/heat_index?tdb=30&rh=70").json())
print(client.get("/thermal/wbgt?twb=25&tg=30").json())
print(client.get("/thermal/utci?tdb=29&tr=32&v=1.0&rh=60").json())
