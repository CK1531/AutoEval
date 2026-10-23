from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
import app.models as models
import app.schemas as schemas
from app.utils import hash_password, verify_password

router = APIRouter(prefix="/register", tags=["Register"])


@router.post("/", response_model=schemas.UserResponse)
async def register(user_credentials: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(models.User)
        .filter(models.User.email == user_credentials.email)
        .first()
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists!"
        )

    user_credentials.password = hash_password(user_credentials.password)

    new_user = models.User(**user_credentials.model_dump())

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
