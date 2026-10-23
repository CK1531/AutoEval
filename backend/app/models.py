from app.database import Base
from sqlalchemy import Column, Integer, String, JSON, ForeignKey, DateTime, Boolean, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, nullable=False) 
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)

class Exam(Base):
    __tablename__ = "exams"
    
    id = Column(Integer, primary_key=True, nullable=False)
    title = Column(String, nullable=False)
    rubric = Column(JSON, nullable=False) 
    plagiarism_checked = Column(Boolean, nullable=False, server_default=text('false'))
    instructor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    uploaded = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String, nullable=False, server_default="Processing")
    instructor = relationship("User")

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, nullable=False)
    student_roll_no = Column(String, nullable=False) 
    pdf_path = Column(String, nullable=False)
    images_path = Column(String, nullable=False)
    ai_score = Column(Integer, nullable=True) 
    ai_justification = Column(String, nullable=True)
    status = Column(String, server_default="processing", nullable=False) 
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    exam = relationship("Exam")