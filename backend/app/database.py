from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL")

if DATABASE_URL is None:
    raise ValueError("THERE WAS A PROBLEM TRYING TO FETCH THE DATABASE_URL.")

engine = create_engine(os.getenv("SQLALCHEMY_DATABASE_URL"))

SessionLocal = sessionmaker(autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
