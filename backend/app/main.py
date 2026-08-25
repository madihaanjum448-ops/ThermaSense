from fastapi import FastAPI
from .thermal import router as thermal_router

app = FastAPI(title="ThermaSense")

app.include_router(thermal_router, prefix="/thermal", tags=["Thermal"])

@app.get("/")
def read_root():
    return {"status": "ok"}
