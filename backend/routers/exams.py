from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from ai_engine.graph import builder
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
import app.models as models
from app.database import get_db
from app.auth import get_current_user
import app.schemas as schemas
import os, shutil, json

router = APIRouter(prefix="/exams", tags=["Exams"])


@router.post(
    "/", status_code=status.HTTP_201_CREATED, response_model=schemas.ExamResponse
)
async def add_exam(
    exam: schemas.ExamCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors can edit exams",
        )

    duplicate_exam = (
        db.query(models.Exam)
        .filter(
            models.Exam.title == exam.title,
            models.Exam.instructor_id == current_user.id,
        )
        .first()
    )
    if duplicate_exam is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You already have an exam titled '{exam.title}'.",
        )

    new_exam = models.Exam(**exam.model_dump(), instructor_id=current_user.id)

    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    return new_exam


@router.get("/", response_model=list[schemas.Exam_Instructor_Response])
async def get_instructor_exams(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )

    exams = (
        db.query(models.Exam).filter(models.Exam.instructor_id == current_user.id).all()
    )
    results = []

    for exam in exams:
        total_scripts = (
            db.query(models.Submission)
            .filter(models.Submission.exam_id == exam.id)
            .count()
        )
        total_graded = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == exam.id,
                models.Submission.status == "completed",
            )
            .count()
        )
        total_in_review = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == exam.id,
                models.Submission.status == "pending_review",
            )
            .count()
        )

        if total_graded == 0:
            exam_status = "processing"
        elif total_graded == total_scripts:
            exam_status = "completed"
        elif total_in_review > 0:
            exam_status = "in_review"
        else:
            exam_status = "processing"

        results.append(
            {
                "id": exam.id,
                "title": exam.title,
                "uploaded": exam.uploaded,
                "scripts": total_scripts,
                "graded": total_graded,
                "status": exam_status,
            }
        )

    return results


@router.get("/to-grade", response_model=list[schemas.ExamToGradeResponse])
async def get_exams_to_grade(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam_ids = [
        row[0]
        for row in db.query(models.Submission.exam_id)
        .filter(models.Submission.status == "pending_review")
        .distinct()
        .all()
    ]

    if not exam_ids:
        return []

    exams = db.query(models.Exam).filter(models.Exam.id.in_(exam_ids)).all()

    results = []
    for exam in exams:
        total = (
            db.query(models.Submission)
            .filter(models.Submission.exam_id == exam.id)
            .count()
        )
        pending = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == exam.id,
                models.Submission.status == "pending_review",
            )
            .count()
        )
        graded = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == exam.id,
                models.Submission.status == "completed",
            )
            .count()
        )
        results.append(
            {
                "id": exam.id,
                "title": exam.title,
                "pending": pending,
                "total": total,
                "graded": graded,
                "uploaded": exam.uploaded,
            }
        )

    return results


@router.patch("/{exam_id}/", response_model=schemas.ExamResponse)
async def update_exam(
    exam_id: int,
    exam_update: schemas.ExamUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors can edit exams",
        )

    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()

    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No exam found"
        )

    if exam.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own exams",
        )

    update_data = exam_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exam, field, value)

    db.commit()
    db.refresh(exam)

    return exam


@router.delete("/{exam_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an Instructor to delete exams",
        )

    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No exam found"
        )

    exam_base_folder = os.path.join("uploads", "exams", f"exam_{exam_id}")
    if os.path.exists(exam_base_folder):
        try:
            shutil.rmtree(exam_base_folder)
        except Exception as e:
            print(
                f"Warning: Could not delete physical files for exam {exam_id}: {str(e)}"
            )

    db.delete(exam)
    db.commit()


@router.get("/{exam_id}/queue")
async def get_exam_review_queue(exam_id: int, db: Session = Depends(get_db)):

    pending_subs = (
        db.query(models.Submission)
        .filter(
            models.Submission.exam_id == exam_id,
            models.Submission.status == "pending_review",
        )
        .all()
    )

    master_queue = []

    exam_base_folder = os.path.join("uploads", "exams", f"exam_{exam_id}")
    flag_file = os.path.join(exam_base_folder, "plagiarism.json")
    plagiarism_data = {}
    if os.path.exists(flag_file):
        with open(flag_file, "r") as f:
            plagiarism_data = json.load(f)

    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as memory:
        graph = builder.compile(checkpointer=memory)

        for sub in pending_subs:
            config = {"configurable": {"thread_id": f"submission_{sub.id}"}}
            paused_state = await graph.aget_state(config)

            if paused_state.tasks and paused_state.tasks[0].interrupts:
                ui_payload = paused_state.tasks[0].interrupts[0].value
                questions = ui_payload.get("questions", [])

                for q in questions:
                    q["submission_id"] = sub.id

                    sub_flags = plagiarism_data.get(str(sub.id), {})
                    if q["questionRef"] in sub_flags:
                        q["similarityFlag"] = sub_flags[q["questionRef"]]

                    master_queue.append(q)
            else:
                print(
                    f"Submission {sub.id} is 'pending' in DB, but missing from LangGraph RAM!"
                )

    return {"queue": master_queue}
