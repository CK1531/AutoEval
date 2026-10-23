from fastapi import (
    APIRouter,
    Depends,
    File,
    UploadFile,
    Form,
    HTTPException,
    status,
    BackgroundTasks,
)
from fastapi.responses import FileResponse
import app.models as models
from app.auth import get_current_user
from app.database import SessionLocal
from typing import Annotated, List
from app.database import get_db
from sqlalchemy.orm import Session, joinedload
from ai_engine.graph import builder
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command
import app.schemas as schemas
from ai_engine.plagiarism import run_batch_plagiarism_check
import os, shutil, re, pymupdf
import json

db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[models.User, Depends(get_current_user)]

router = APIRouter(prefix="/upload", tags=["Upload"])


def secure_filename(filename: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", os.path.basename(filename))


@router.post("/")
def upload_files(
    current_user: user_dependency,
    background_tasks: BackgroundTasks,
    db: db_dependency,
    files: List[UploadFile] = File(...),
    exam_id: int = Form(...),
):
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an Instructor to upload files",
        )

    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()

    if exam is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No such exam found."
        )

    exam_base_folder = os.path.join("uploads", "exams", f"exam_{exam_id}")
    required_folders = [os.path.join(exam_base_folder, "pdfs"), os.path.join(exam_base_folder, "images")]

    for path in required_folders:
        os.makedirs(path, exist_ok=True)

    created_pdf_paths = []
    created_img_dirs = []
    net_new_students_count = 0

    try:
        for file in files:
            safe_name = secure_filename(file.filename)
            student_id = safe_name.rsplit(".", 1)[0]

            pdf_destination = os.path.join(required_folders[0], safe_name)
            imgs_destination = os.path.join(required_folders[1], str(student_id))

            existing_submission = (
                db.query(models.Submission)
                .filter(
                    models.Submission.exam_id == exam_id,
                    models.Submission.student_roll_no == student_id,
                )
                .first()
            )
            current_sub_id = None
            if existing_submission is not None:
                if os.path.exists(existing_submission.images_path):
                    shutil.rmtree(existing_submission.images_path)
                if os.path.exists(existing_submission.pdf_path):
                    os.remove(existing_submission.pdf_path)
                db.delete(existing_submission)
                db.flush()
            else:
                net_new_students_count += 1

            new_submission = models.Submission(
                student_roll_no=student_id,
                pdf_path=pdf_destination,
                images_path=imgs_destination,
                ai_score=None,
                ai_justification=None,
                exam_id=exam_id,
                status="processing",
            )
            db.add(new_submission)
            db.flush()
            current_sub_id = new_submission.id

            with open(pdf_destination, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file.file.close()
            created_pdf_paths.append(pdf_destination)

            os.makedirs(imgs_destination, exist_ok=True)
            with pymupdf.open(pdf_destination) as doc:
                for page in doc:
                    pix = page.get_pixmap(dpi=150)
                    pix.save(f"{imgs_destination}/page-{page.number}.png")
            created_img_dirs.append(imgs_destination)

            background_tasks.add_task(execute_grading_pipeline, current_sub_id)

        db.commit()

    except Exception as error:
        db.rollback()

        for file_path in created_pdf_paths:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as f_error:
                    print(f"Failed to delete {file_path} : {f_error}")

        for img_dir in created_img_dirs:
            if os.path.exists(img_dir):
                try:
                    shutil.rmtree(img_dir)
                except Exception as img_error:
                    print(f"Failed to delete {img_dir} : {img_error}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading files: {str(error)}",
        )

    return {
        "message": "Bulk upload successful!",
        "exam_id": exam_id,
        "students_processed": net_new_students_count,
    }


@router.get("/{submission_id}/review")
async def get_human_review_data(
    submission_id: int, current_user: user_dependency, db: Session = Depends(get_db)
):
    if current_user.role != "ta":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Only TAs can reviews answer scripts",
        )

    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found"
        )

    if submission.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission is not ready for review",
        )

    config = {"configurable": {"thread_id": f"submission_{submission.id}"}}

    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as memory:
        graph = builder.compile(checkpointer=memory)
        paused_state = await graph.aget_state(config)

    if not paused_state.tasks or not paused_state.tasks[0].interrupts:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Graph state lost or not found",
        )

    ui_payload = paused_state.tasks[0].interrupts[0].value

    return {"submission_id": submission.id, "ai_review_data": ui_payload}


def _sorted_page_files(images_path: str):
    if not images_path or not os.path.isdir(images_path):
        return []
    files = [f for f in os.listdir(images_path) if f.lower().endswith(".png")]
    return sorted(files, key=lambda n: int(re.sub(r"\D", "", n) or 0))


@router.get("/{submission_id}/pages")
def list_submission_pages(submission_id: int, db: db_dependency):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found"
        )

    files = _sorted_page_files(submission.images_path)
    return {"pages": [f"/upload/{submission_id}/page/{i}" for i in range(len(files))]}


@router.get("/{submission_id}/page/{page_no}")
def get_submission_page(submission_id: int, page_no: int, db: db_dependency):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found"
        )

    files = _sorted_page_files(submission.images_path)
    if page_no < 0 or page_no >= len(files):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Page not found"
        )

    return FileResponse(
        os.path.join(submission.images_path, files[page_no]), media_type="image/png"
    )


@router.post("/{submission_id}/review")
async def submit_human_review(
    submission_id: int,
    current_user: user_dependency,
    payload: schemas.TAReviewSubmit,
    db: db_dependency,
):
    if current_user.role != "ta":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Only TAs can reviews answer scripts",
        )

    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id)
        .first()
    )

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found."
        )

    if submission.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission is not pending review.",
        )

    config = {"configurable": {"thread_id": f"submission_{submission.id}"}}

    try:
        async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as memory:
            graph = builder.compile(checkpointer=memory)
            final_state = await graph.ainvoke(
                Command(resume=payload.model_dump()), config=config
            )

        if final_state:
            final_json = final_state.get("detailed_analysis", {})
            total_score = 0
            for q in final_json.get("questions", []):
                total_score += int(q.get("aiScore", 0))

            submission.ai_score = total_score
            submission.ai_justification = json.dumps(final_json)
            submission.status = "completed"
            db.commit()
            return {
                "message": "Grading finalized successfully.",
                "final_score": total_score,
            }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resume graph: {str(e)}",
        )


@router.get("/instructor_exams")
def get_student_grades(current_user: user_dependency, db: db_dependency):
    submissions = (
        db.query(models.Submission)
        .join(models.Exam, models.Submission.exam_id == models.Exam.id)
        .filter(models.Exam.instructor_id == current_user.id)
        .options(joinedload(models.Submission.exam))
        .all()
    )

    exam_total_possible_marks = {}

    if not submissions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No submissions found for this instructor",
        )

    results = []
    for submission in submissions:
        exam_id = submission.exam_id

        if exam_id not in exam_total_possible_marks:
            calculated_total = 0
            if submission.exam and submission.exam.rubric:
                questions = submission.exam.rubric.get("questions", [])
                for q in questions:
                    for criteria in q.get("criteria", []):
                        calculated_total += int(criteria.get("maxPoints", 0))

            exam_total_possible_marks[exam_id] = calculated_total

        results.append(
            {
                "id": submission.student_roll_no,
                "exam": submission.exam.title,
                "score": submission.ai_score,
                "max": exam_total_possible_marks[exam_id],
                "released": False,
            }
        )

    return results


async def execute_grading_pipeline(submission_id: int):
    db = SessionLocal()
    try:
        submission = (
            db.query(models.Submission)
            .filter(models.Submission.id == submission_id)
            .first()
        )
        if not submission:
            return

        initial_state = {
            "submission_id": submission.id,
            "student_id": submission.student_roll_no,
            "page_img_paths": [
                os.path.join(submission.images_path, f)
                for f in sorted(
                    os.listdir(submission.images_path),
                    key=lambda n: int(re.sub(r"\D", "", n) or 0),
                )
                if f.lower().endswith(".png")
            ],
            "rubric": submission.exam.rubric,
            "ocr_text": "",
            "detailed_analysis": {},
            "status": "processing",
            "feedback": "",
        }
        config = {"configurable": {"thread_id": f"submission_{submission.id}"}}

        async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as memory:
            await memory.setup()
            graph = builder.compile(checkpointer=memory)
            final_state = await graph.ainvoke(initial_state, config=config)
            current_graph_state = await graph.aget_state(config)

            if current_graph_state.tasks and current_graph_state.tasks[0].interrupts:
                interrupt_payload = current_graph_state.tasks[0].interrupts[0].value
                submission.status = "pending_review"
                submission.ai_justification = json.dumps(interrupt_payload)
                print(f"Submission {submission.id} successfully queued for TA review.")
            else:
                submission.status = "error"
                print(f"PIPELINE FAILED or skipped interrupt for sub {submission.id}.")

        db.commit()

        remaining_processing = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == submission.exam_id,
                models.Submission.status == "processing",
            )
            .count()
        )

        if remaining_processing == 0:
            rows_updated = (
                db.query(models.Exam)
                .filter(
                    models.Exam.id == submission.exam_id,
                    models.Exam.plagiarism_checked == False,
                )
                .update({"plagiarism_checked": True})
            )
            db.commit()

            if rows_updated > 0:
                print(f"All scripts for Exam {submission.exam_id} have finished processing!")
                print("Automatically triggering batch plagiarism check...")
                await run_batch_plagiarism_check(submission.exam_id)

    except Exception as e:
        print(f"Pipeline error: {e}")
        submission.status = "error"
        db.commit()
    finally:
        db.close()