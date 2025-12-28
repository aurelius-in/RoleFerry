from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
import re
import uuid
import json
from pathlib import Path

from fastapi import HTTPException, Request
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import text as sql_text

from .config import settings
from .db import get_engine
from .storage import store


# Argon2 (recommended) via argon2-cffi. Avoids bcrypt wheel/version issues on Windows.
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# When Postgres is unavailable, persist demo users so logins survive backend restarts.
_DEMO_USERS_FILE = Path(__file__).resolve().parents[1] / ".demo_users.json"


def _ensure_demo_users_loaded() -> None:
    if getattr(store, "demo_users", None) is None:
        store.demo_users = {}
    if getattr(store, "demo_users_by_email", None) is None:
        store.demo_users_by_email = {}
    if getattr(store, "_demo_users_loaded", False):
        return
    store._demo_users_loaded = True
    try:
        if not _DEMO_USERS_FILE.exists():
            return
        data = json.loads(_DEMO_USERS_FILE.read_text(encoding="utf-8") or "{}")
        users = data.get("users") or {}
        by_email = data.get("by_email") or {}
        if isinstance(users, dict):
            store.demo_users.update(users)
        if isinstance(by_email, dict):
            store.demo_users_by_email.update(by_email)
    except Exception:
        return


def _persist_demo_users() -> None:
    try:
        payload = {
            "users": getattr(store, "demo_users", {}) or {},
            "by_email": getattr(store, "demo_users_by_email", {}) or {},
        }
        _DEMO_USERS_FILE.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
    except Exception:
        return


@dataclass
class AuthUser:
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str
    linkedin_url: str | None = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def create_access_token(user: AuthUser) -> str:
    exp = _now() + timedelta(minutes=int(settings.jwt_exp_minutes))
    payload = {
        "sub": user.id,
        "email": user.email,
        "exp": int(exp.timestamp()),
        "iat": int(_now().timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


async def _db_get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                SELECT id::text, email, password_hash, first_name, last_name, phone, linkedin_url
                FROM user_account
                WHERE email = :email
                LIMIT 1
                """
            ),
            {"email": email},
        )
        row = res.first()
        if not row:
            return None
        return dict(row._mapping)


async def _db_get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    engine = get_engine()
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                SELECT id::text, email, password_hash, first_name, last_name, phone, linkedin_url
                FROM user_account
                WHERE id = :id::uuid
                LIMIT 1
                """
            ),
            {"id": user_id},
        )
        row = res.first()
        if not row:
            return None
        return dict(row._mapping)


async def _db_create_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    engine = get_engine()
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                INSERT INTO user_account (email, password_hash, first_name, last_name, phone, linkedin_url)
                VALUES (:email, :password_hash, :first_name, :last_name, :phone, :linkedin_url)
                RETURNING id::text, email, password_hash, first_name, last_name, phone, linkedin_url
                """
            ),
            payload,
        )
        row = res.first()
        return dict(row._mapping)


def _mem_get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    _ensure_demo_users_loaded()
    users_by_email = getattr(store, "demo_users_by_email", {})
    uid = users_by_email.get(email.lower())
    if not uid:
        return None
    users = getattr(store, "demo_users", {})
    return users.get(uid)


def _mem_get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    _ensure_demo_users_loaded()
    users = getattr(store, "demo_users", {})
    return users.get(user_id)


def _mem_create_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_demo_users_loaded()
    uid = str(uuid.uuid4())
    users = getattr(store, "demo_users", None)
    users_by_email = getattr(store, "demo_users_by_email", None)
    if users is None:
        store.demo_users = {}
        users = store.demo_users
    if users_by_email is None:
        store.demo_users_by_email = {}
        users_by_email = store.demo_users_by_email
    record = {
        "id": uid,
        **payload,
    }
    users[uid] = record
    users_by_email[str(payload.get("email") or "").lower()] = uid
    _persist_demo_users()
    return record


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    # Try DB first; if unavailable, fallback to in-memory demo store.
    try:
        return await _db_get_user_by_email(email)
    except Exception:
        return _mem_get_user_by_email(email)


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        return await _db_get_user_by_id(user_id)
    except Exception:
        return _mem_get_user_by_id(user_id)


async def create_user(email: str, password: str, first_name: str, last_name: str, phone: str, linkedin_url: str | None) -> AuthUser:
    email_norm = (email or "").strip().lower()
    if not EMAIL_RE.match(email_norm):
        raise HTTPException(status_code=400, detail="Please enter a valid email.")
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not first_name.strip() or not last_name.strip():
        raise HTTPException(status_code=400, detail="First and last name are required.")
    if not phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required.")

    existing = await get_user_by_email(email_norm)
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    payload = {
        "email": email_norm,
        "password_hash": hash_password(password),
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "phone": phone.strip(),
        "linkedin_url": (linkedin_url or "").strip() or None,
    }
    try:
        row = await _db_create_user(payload)
    except Exception:
        row = _mem_create_user(payload)

    return AuthUser(
        id=str(row["id"]),
        email=str(row["email"]),
        first_name=str(row["first_name"]),
        last_name=str(row["last_name"]),
        phone=str(row["phone"]),
        linkedin_url=(str(row["linkedin_url"]).strip() if row.get("linkedin_url") else None),
    )


async def authenticate(email: str, password: str) -> Optional[AuthUser]:
    email_norm = (email or "").strip().lower()
    row = await get_user_by_email(email_norm)
    if not row:
        return None
    if not verify_password(password or "", str(row.get("password_hash") or "")):
        return None
    return AuthUser(
        id=str(row["id"]),
        email=str(row["email"]),
        first_name=str(row["first_name"]),
        last_name=str(row["last_name"]),
        phone=str(row["phone"]),
        linkedin_url=(str(row.get("linkedin_url")).strip() if row.get("linkedin_url") else None),
    )


async def get_current_user_optional(request: Request) -> Optional[AuthUser]:
    token = request.cookies.get(settings.auth_cookie_name) if request else None
    if not token:
        return None
    try:
        data = decode_token(token)
    except JWTError:
        return None
    user_id = str(data.get("sub") or "")
    if not user_id:
        return None
    row = await get_user_by_id(user_id)
    if not row:
        return None
    return AuthUser(
        id=str(row["id"]),
        email=str(row["email"]),
        first_name=str(row["first_name"]),
        last_name=str(row["last_name"]),
        phone=str(row["phone"]),
        linkedin_url=(str(row.get("linkedin_url")).strip() if row.get("linkedin_url") else None),
    )


async def require_current_user(request: Request) -> AuthUser:
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


