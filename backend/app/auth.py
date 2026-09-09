"""
auth.py — Authentication module for ThermaSense Official Early Warning System.

NOTE: This is a hackathon/demo authentication implementation using simulated
official accounts. In a production government deployment, this module would
integrate with National Government SSO (e.g. Parichay, Jan Parichay, or NIC LDAP).
"""

import hmac
import hashlib
import base64
import json
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = "thermasense-gov-demo-secret-key-2026".encode("utf-8")
TOKEN_EXPIRY_SECONDS = 7200  # 2 hours

# Demo official credentials (for hackathon/demo purposes only)
DEMO_OFFICIALS = {
    "officer1": {
        "password": "demo123",
        "username": "officer1",
        "name": "R. Sharma",
        "role": "Disaster Management Officer",
        "department": "BBMP",
    },
    "officer2": {
        "password": "demo123",
        "username": "officer2",
        "name": "A. Iyer",
        "role": "Municipal Health Officer",
        "department": "Bengaluru Urban Health Dept",
    },
}


class LoginRequest(BaseModel):
    username: str
    password: str


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ""
    return base64.urlsafe_b64decode(data + padding)


def create_token(user_info: dict) -> str:
    """Generate a standard signed HMAC-SHA256 bearer token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_info["username"],
        "name": user_info["name"],
        "role": user_info["role"],
        "department": user_info["department"],
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
    }

    header_b64 = _base64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(SECRET_KEY, signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def verify_token(token: str) -> dict:
    """Verify HMAC signature and expiration timestamp of bearer token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed token structure")

        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(SECRET_KEY, signing_input, hashlib.sha256).digest()
        provided_sig = _base64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            raise ValueError("Invalid token signature")

        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))

        if payload.get("exp", 0) < int(time.time()):
            raise ValueError("Token has expired")

        return payload
    except Exception as err:
        raise HTTPException(
            status_code=401,
            detail=f"Unauthorized: {str(err)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency to extract and validate the authorized official."""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Official authentication required. Please sign in with authorized credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization scheme. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return verify_token(token)


@router.post("/login")
def login(creds: LoginRequest):
    """
    Authenticate an official with username and password.
    Returns signed Bearer token and officer profile.
    """
    official = DEMO_OFFICIALS.get(creds.username.strip().lower())
    if not official or official["password"] != creds.password.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid officer credentials. Please check username and password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_profile = {
        "username": official["username"],
        "name": official["name"],
        "role": official["role"],
        "department": official["department"],
    }

    token = create_token(user_profile)

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_EXPIRY_SECONDS,
        "user": user_profile,
    }


@router.get("/me")
def get_current_official(user: dict = Depends(get_current_user)):
    """Return currently authenticated official info."""
    return {
        "authenticated": True,
        "user": {
            "username": user["sub"],
            "name": user["name"],
            "role": user["role"],
            "department": user["department"],
        },
    }
