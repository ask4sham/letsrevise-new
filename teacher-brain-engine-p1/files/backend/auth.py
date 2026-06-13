"""
Teacher Brain — P0.1 JWT Auth module (custom email/password).

- bcrypt password hashing
- JWT (HS256) access tokens
- Both Authorization: Bearer <token> AND access_token cookie supported
- Idempotent admin seeding
- get_current_user FastAPI dependency
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("teacher-brain.auth")

JWT_ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    # bcrypt 4.x: hard-limit 72 bytes — defensively encode + truncate
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        pw = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or len(secret) < 32:
        raise RuntimeError("JWT_SECRET must be set to a >=32 char string")
    return secret


def _jwt_ttl() -> timedelta:
    try:
        days = int(os.environ.get("JWT_EXPIRES_DAYS", "7"))
    except ValueError:
        days = 7
    return timedelta(days=max(1, days))


def create_access_token(user_id: str, email: str, role: str = "teacher") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + _jwt_ttl()).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def _extract_token(request: Request) -> Optional[str]:
    # 1. Authorization header
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token:
            return token
    # 2. httpOnly cookie fallback (future-compat)
    cookie = request.cookies.get("access_token")
    return cookie or None


async def get_current_user(request: Request) -> dict:
    db: AsyncIOMotorDatabase = request.app.state.db
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired",
                            headers={"WWW-Authenticate": "Bearer"})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token",
                            headers={"WWW-Authenticate": "Bearer"})

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Wrong token type")

    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


async def get_current_user_optional(request: Request) -> Optional[dict]:
    """Same as get_current_user but returns None instead of 401."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ---------------------------------------------------------------------------
# Admin seeding & indexes
# ---------------------------------------------------------------------------

async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)


async def seed_admin(db: AsyncIOMotorDatabase) -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD missing — skipping seed.")
        return

    existing = await db.users.find_one({"email": email})
    if existing is None:
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": "Teacher",
            "role": "teacher",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc)
        logger.info("Seeded admin user: %s", email)
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password)}},
        )
        logger.info("Rotated admin password hash for: %s", email)


# ---------------------------------------------------------------------------
# Public surface for /api/auth routes
# ---------------------------------------------------------------------------

def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "teacher"),
        "created_at": user.get("created_at"),
    }


async def register_user(db: AsyncIOMotorDatabase, email: str, password: str,
                        name: Optional[str] = None) -> dict:
    email = email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Valid email is required")
    if not password or len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "name": (name or "").strip() or "Teacher",
        "role": "teacher",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return user_doc


async def authenticate_user(db: AsyncIOMotorDatabase, email: str, password: str) -> dict:
    email = email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user.get("password_hash", "")):
        # Always 401 — never reveal which side was wrong
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user
