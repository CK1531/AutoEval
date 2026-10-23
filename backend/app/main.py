from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import exams, login, register, submissions, users
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exams.router)
app.include_router(register.router)
app.include_router(login.router)
app.include_router(submissions.router)
app.include_router(users.router)


@app.get("/")
async def root():
    return {"Message": "Welcome to my API!"}
