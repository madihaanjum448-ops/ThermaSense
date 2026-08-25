from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()


@app.post("/webhook")
async def receive_webhook(request: Request):
    payload = await request.json()

    print("\n========== WEBHOOK RECEIVED ==========")
    print(payload)
    print("======================================\n")

    return {
        "received": True,
        "message": "Webhook received successfully"
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)