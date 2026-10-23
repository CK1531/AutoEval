import jwt
from app.database import get_db
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timezone, timedelta
import app.models as models
import os

ALGORITHM = "HS256"


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, os.getenv("SECRET_KEY"), algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(request: Request, db: Session = Depends(get_db)):

    credential_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials!"
    )

    token = request.cookies.get("access_token")
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    try:
        decoded_token = jwt.decode(
            token, os.getenv("SECRET_KEY"), algorithms=[ALGORITHM]
        )
        user_id = decoded_token.get("id")
        if user_id is None:
            raise credential_error
    except InvalidTokenError as e:
        print(e)
        raise credential_error

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise credential_error
    return user
