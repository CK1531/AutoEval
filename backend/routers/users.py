from fastapi import APIRouter, Depends, Response
from app.auth import get_current_user
import app.models as models
import os

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

router = APIRouter(prefix="/users", tags=["User"])


@router.get("/me")
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return {"email": current_user.email, "role": current_user.role}


@router.get("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="access_token", httponly=True, secure=COOKIE_SECURE, samesite="lax"
    )
    return {"message": "Logout successful!"}
