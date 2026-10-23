from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.database import get_db
from sqlalchemy.orm import Session
import app.models as models
from app.utils import verify_password
from app.auth import create_access_token
import app.schemas as schemas
import os

EXPIRY = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

router = APIRouter(prefix="/login", tags=["Login"])


@router.post("/")
async def login(
    response: Response,
    user_credentials: schemas.UserLogin,
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter(models.User.email == user_credentials.email)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Credentials!"
        )

    is_password_correct = verify_password(user_credentials.password, user.password)

    if not is_password_correct:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Credentials!"
        )

    access_token = create_access_token({"id": user.id})

    expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    cookie_max_age = expire_minutes * 60

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=cookie_max_age,
    )

    return {"message": "Login successful!"}
