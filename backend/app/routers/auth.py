from fastapi import APIRouter, Response, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..config import settings
from ..auth import create_user, authenticate, create_access_token, require_current_user


router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    password_verify: str
    first_name: str
    last_name: str
    phone: str
    linkedin_url: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserProfile(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str
    linkedin_url: Optional[str] = None


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserProfile] = None


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, response: Response):
    if req.password != req.password_verify:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    user = await create_user(
        email=req.email,
        password=req.password,
        first_name=req.first_name,
        last_name=req.last_name,
        phone=req.phone,
        linkedin_url=req.linkedin_url,
    )
    token = create_access_token(user)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=int(settings.jwt_exp_minutes) * 60,
        path="/",
    )
    return AuthResponse(
        success=True,
        message="Account created",
        user=UserProfile(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            linkedin_url=user.linkedin_url,
        ),
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, response: Response):
    user = await authenticate(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(user)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=int(settings.jwt_exp_minutes) * 60,
        path="/",
    )
    return AuthResponse(
        success=True,
        message="Logged in",
        user=UserProfile(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            linkedin_url=user.linkedin_url,
        ),
    )


@router.post("/logout", response_model=AuthResponse)
async def logout(response: Response):
    response.delete_cookie(key=settings.auth_cookie_name, path="/")
    return AuthResponse(success=True, message="Logged out")


@router.get("/me", response_model=AuthResponse)
async def me(request: Request):
    user = await require_current_user(request)
    return AuthResponse(
        success=True,
        message="OK",
        user=UserProfile(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            linkedin_url=user.linkedin_url,
        ),
    )


