from fastapi import FastAPI, Request

from .thermal import router as thermal_router
from .wards import router as wards_router


app = FastAPI(title="ThermaSense")


app.include_router(
    thermal_router,
    prefix="/thermal",
    tags=["Thermal"],
)

app.include_router(
    wards_router,
    tags=["Wards"],
)


@app.get("/")
def read_root():
    return {"status": "ok"}


@app.post("/webhook")
async def receive_webhook(request: Request):
    payload = await request.json()

    print("\n========== WEBHOOK RECEIVED ==========")
    print(payload)
    print("======================================\n")

    return {
        "received": True,
        "message": "Webhook received successfully",
    }