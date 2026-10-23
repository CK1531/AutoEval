from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    role: str = Field(..., pattern="^(instructor|ta)")


class UserResponse(BaseModel):
    email: EmailStr
    id: int
    role: str

    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ExamCreate(BaseModel):
    title: str
    rubric: Dict[str, Any]


class ExamResponse(BaseModel):
    id: int
    title: str
    rubric: Dict[str, Any]
    instructor_id: int
    model_config = ConfigDict(from_attributes=True)


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None


class ExamToGradeResponse(BaseModel):
    id: int
    title: str
    pending: int
    total: int
    graded: int
    uploaded: str

    @field_validator("uploaded", mode="before")
    def format_date(cls, value):
        if isinstance(value, datetime):
            return value.strftime("%b %d, %Y")
        return value

    model_config = ConfigDict(from_attributes=True)


class Exam_Instructor_Response(BaseModel):
    id: int
    title: str
    uploaded: str
    scripts: int
    graded: int
    status: str = Field(..., pattern="^(completed|in_review|processing|pending_review)")

    @field_validator("uploaded", mode="before")
    def format_date(cls, value):
        if isinstance(value, datetime):
            return value.strftime("%b %d, %Y")
        return value

    model_config = ConfigDict(from_attributes=True)


class SubmissionResponse(BaseModel):
    id: int
    student_roll_no: str
    pdf_path: str
    images_path: str
    ai_score: Optional[int] = None
    ai_justification: Optional[str] = None
    status: str
    exam_id: int

    model_config = ConfigDict(from_attributes=True)


class TAReviewSubmit(BaseModel):
    questions: list[Any]
