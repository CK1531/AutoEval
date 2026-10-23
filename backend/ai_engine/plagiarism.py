import json
import asyncio
from sklearn.metrics.pairwise import cosine_similarity
from pydantic import BaseModel, Field
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from app.database import SessionLocal
import app.models as models

embeddings_model = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
evaluator_llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", temperature=0.0)


class PlagiarismDecision(BaseModel):
    is_suspicious: bool = Field(
        description="True if cheating/collusion. False if standard proof, MCQ, or expected math."
    )
    reason: str = Field(description="Very short reason why.")


evaluator = evaluator_llm.with_structured_output(PlagiarismDecision)


async def check_suspicious_pair(
    question_text: str, ans_a: str, ans_b: str, sem: asyncio.Semaphore
) -> bool:
    if len(ans_a) < 30 and len(ans_b) < 30:
        return False

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are an academic integrity AI. Two students have submitted answers with high textual similarity.
                Your job is to determine if this similarity indicates COPYING or INDEPENDENT WORK.

                The key question is NOT whether the topic has a standard answer.
                The key question IS: could two students independently produce this level of textual similarity?

                INDEPENDENT / EXPECTED (Return False):
                - Answers that are similar in content but differ in wording, notation, or structure.
                - MCQ or fill-in answers where only one token is the answer (e.g., "A", "True", "42").
                - Simple one-line arithmetic where no other phrasing is possible.

                SUSPICIOUS / COPYING (Return True):
                - Answers that are verbatim or near-verbatim, even if the math itself is standard.
                (Two students can both know how to integrate sin(x) without copying each other word for word.)
                - Matching unconventional notation, formatting, or layout choices.
                - Matching errors, crossed-out work, or partial mistakes.
                - Identical sentence structure and phrasing in written explanations.
                - Answers where the only plausible explanation for the similarity is that one student copied from the other.

                When in doubt about verbatim or near-verbatim matches: return True.
                """,
            ),
            ("user", "Question: {q}\n\nStudent 1: {a}\n\nStudent 2: {b}"),
        ]
    )

    chain = prompt | evaluator

    async with sem:
        try:
            decision = await chain.ainvoke({"q": question_text, "a": ans_a, "b": ans_b})
            return decision.is_suspicious
        except Exception as e:
            print(f"LLM Eval failed: {e}")
            return False


async def run_batch_plagiarism_check(exam_id: int):
    print(f"--- Starting Plagiarism Check for Exam {exam_id} ---")
    db = SessionLocal()

    try:
        pending_subs = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == exam_id,
                models.Submission.status == "pending_review",
            )
            .all()
        )

        if len(pending_subs) < 2:
            print("Not enough submissions to compare, skipping.")
            return {
                "status": "skipped",
                "message": "Not enough submissions to compare.",
            }

        q_data = {}

        for sub in pending_subs:
            if not sub.ai_justification:
                print(f"Sub {sub.id}: ai_justification is empty, skipping")
                continue
            payload = json.loads(sub.ai_justification)
            print(f"Sub {sub.id} payload keys: {list(payload.keys())}")
            print(f"Sub {sub.id} questions sample: {payload.get('questions', [])[:1]}")
            questions = payload.get("questions", [])
            for q in questions:
                q_ref = q["questionRef"]
                if q_ref not in q_data:
                    q_data[q_ref] = []
                q_data[q_ref].append(
                    {
                        "sub_id": sub.id,
                        "student_id": q["studentId"],
                        "ocr_text": q["ocrText"],
                        "q_text": q["questionText"],
                    }
                )

    finally:
        db.close()

    final_flags = {}
    sem = asyncio.Semaphore(5)

    for q_ref, students in q_data.items():
        valid_students = [s for s in students if len(s["ocr_text"].strip()) > 5]
        if len(valid_students) < 2:
            continue

        texts = [s["ocr_text"] for s in valid_students]
        try:
            vectors = await embeddings_model.aembed_documents(texts)
        except Exception as e:
            print(f"Embedding API failed for question {q_ref}: {e}")
            continue
        sim_matrix = cosine_similarity(vectors)

        llm_tasks = []
        pair_indices = []

        for i in range(len(valid_students)):
            for j in range(i + 1, len(valid_students)):
                if sim_matrix[i][j] > 0.85:
                    pair_indices.append((i, j))
                    llm_tasks.append(
                        check_suspicious_pair(
                            valid_students[i]["q_text"], texts[i], texts[j], sem
                        )
                    )

        if not llm_tasks:
            continue

        results = await asyncio.gather(*llm_tasks)

        for (i, j), is_suspicious in zip(pair_indices, results):
            if is_suspicious:
                s1, s2 = valid_students[i], valid_students[j]

                if str(s1["sub_id"]) not in final_flags:
                    final_flags[str(s1["sub_id"])] = {}
                if str(s2["sub_id"]) not in final_flags:
                    final_flags[str(s2["sub_id"])] = {}
                if q_ref not in final_flags[str(s1["sub_id"])]:
                    final_flags[str(s1["sub_id"])][q_ref] = {"count": 0, "papers": []}
                if q_ref not in final_flags[str(s2["sub_id"])]:
                    final_flags[str(s2["sub_id"])][q_ref] = {"count": 0, "papers": []}

                final_flags[str(s1["sub_id"])][q_ref]["count"] += 1
                final_flags[str(s1["sub_id"])][q_ref]["papers"].append(s2["student_id"])

                final_flags[str(s2["sub_id"])][q_ref]["count"] += 1
                final_flags[str(s2["sub_id"])][q_ref]["papers"].append(s1["student_id"])

    flag_file = f"uploads/exams/exam_{exam_id}/plagiarism.json"
    with open(flag_file, "w") as f:
        json.dump(final_flags, f)

    print(f"--- Plagiarism Check Complete! Saved to {flag_file} ---")
    return {
        "status": "success",
        "flags_found": sum(len(qs) for qs in final_flags.values()),
    }
