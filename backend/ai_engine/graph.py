import asyncio
import os
import base64
import json
import re
from typing import Any, Literal, Optional, TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from langchain_google_genai import ChatGoogleGenerativeAI


from dotenv import load_dotenv

load_dotenv()
from pydantic import BaseModel, Field


# PYDANTIC MODELS
class RubricCriterionMatch(BaseModel):
    name: str = Field(
        description="The exact name of the rubric criterion (e.g., 'Antiderivative setup')"
    )
    awarded: int = Field(description="Points awarded for this specific criterion")
    max: int = Field(description="Maximum points possible for this criterion")
    status: Literal["full", "partial", "none"] = Field(
        description="Calculated status based on awarded vs max"
    )


class SimilarityFlagData(BaseModel):
    count: int = Field(description="Number of similar papers found")
    papers: list[str] = Field(description="List of student IDs with similar logic")


class RubricCriterion(BaseModel):
    name: str = Field(description="Name of the criterion")
    maxPoints: int = Field(description="Maximum points possible")
    keywords: list[str] = Field(description="Keywords to look for")


class QuestionGradingResult(BaseModel):
    id: str = Field(
        description="Unique ID for this specific UI card (e.g., 'q1', 'q2')"
    )
    studentId: str = Field(description="The student's ID/Roll number")
    questionRef: str = Field(
        description="The ID of the question from the rubric (e.g., 'Q3b')"
    )
    questionText: str = Field(description="The full text of the question")
    rubric: list[RubricCriterion] = Field(
        description="The original rubric criteria used for grading"
    )
    ocrText: str = Field(
        description="The exact mathematical text/steps extracted from the student's upload"
    )
    ocrConfidence: float = Field(
        default=95.0, description="Estimated confidence in the text extraction"
    )
    aiScore: int = Field(description="Total points awarded (sum of all rubric matches)")
    maxScore: int = Field(description="Total possible points for the whole question")
    aiJustification: str = Field(
        description="A holistic paragraph explaining the deductions and final score"
    )
    rubricMatch: list[RubricCriterionMatch] = Field(
        description="Granular breakdown of points awarded per criterion"
    )
    confidence: int = Field(
        description="AI confidence in this grading decision (0-100)"
    )
    status: str = Field(default="pending")
    timeAgo: str = Field(default="Just now")
    similarityFlag: Optional[SimilarityFlagData] = Field(default=None)


class FullExamGradingResult(BaseModel):
    questions: list[QuestionGradingResult] = Field(
        description="Array containing the grading result for every single question answered in the exam paper"
    )


# STATE SCHEMA
class GradingState(TypedDict):
    submission_id: int
    student_id: str
    page_img_paths: list[str]
    rubric: dict[str, Any]
    ocr_text: str
    detailed_analysis: dict
    status: str
    feedback: str


# NODES
async def run_nemotron_ocr_node(state: GradingState):
    print("--- [NODE 1] EXECUTING MULTIMODAL OCR VIA GEMINI ---")

    gemini_vlm = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        temperature=0.0,
        max_output_tokens=2000,
    )

    def extract_page_number(filepath):
        match = re.search(r"page-(\d+)\.png", filepath)
        return int(match.group(1)) if match else 0

    sorted_paths = sorted(state["page_img_paths"], key=extract_page_number)

    sem = asyncio.Semaphore(3)

    async def process_single_page(index: int, img_path: str):

        async with sem:
            await asyncio.sleep(5)
            print(f"Reading page number {index+1} from {img_path}...")
            try:
                with open(img_path, "rb") as img_file:
                    b64_img = base64.b64encode(img_file.read()).decode("utf-8")

                message = HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": "You are an expert academic digitizer. Your task is to convert this handwritten exam page into clean, structured Markdown. Follow these strict rules: "
                            "1. INTELLIGENT CORRECTION: Fix obvious spelling errors caused by messy cursive (e.g., 'quicksoft' to 'quicksort', 'heavyly' to 'heavily'). However, DO NOT alter the student's underlying logic, grammar, or factual claims. "
                            "2. MATHEMATICS & SCIENCE: You MUST use standard LaTeX for all math, physics, chemistry, and algorithmic notation. Use single `$` for inline variables (e.g., $O(n^2)$) and double `$$` for block equations. "
                            "3. STRUCTURE: Preserve explicit question labels (e.g., 'Q1)', '2a.') clearly on new lines to maintain the document hierarchy. "
                            "4. NOISE FILTERING: Completely ignore scribbles, explicitly crossed-out text, smudges, and page numbers. "
                            "5. BOUNDARIES: Do not attempt to solve, grade, or evaluate the text. Output ONLY the corrected transcription."
                            "DO NOT input any conversational text, else THE SYSTEM AND DATABASE WILL ALL CRASH!! Your response must be exactly the transcription, not a word more, not a word less.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"},
                        },
                    ]
                )

                response = await gemini_vlm.ainvoke([message])
                return f"\n\n--- Page {index+1} ---\n\n{response.content}"

            except Exception as e:
                print(f"Error reading and processing {img_path}: {e}")
                return f"\n\n--- Page {index+1} ---\n\n[ERROR PROCESSING PAGE]"

    tasks = [process_single_page(i, path) for i, path in enumerate(sorted_paths)]

    results = await asyncio.gather(*tasks)

    full_transcription = "".join(results)

    print("OCR text transcribed successfully.")
    return {"ocr_text": full_transcription, "status": "ocr_completed"}


def human_intervention_decider(state: GradingState):
    print("--- Waiting for Human Review of AI Grading ---")

    ui_payload = state.get("detailed_analysis", {})
    human_review = interrupt(ui_payload)

    return {
        "status": "approved",
        "detailed_analysis": {"questions": human_review.get("questions", [])},
    }


def grade_with_gemini_model(state: GradingState):
    print("--- [NODE 2] GRADING ANSWER SCRIPT USING GEMINI ---")

    gemini_model = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite", temperature=0.0
    )

    structured_gemini = gemini_model.with_structured_output(FullExamGradingResult)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are an expert Teaching Assistant grading a university exam. 
                You will receive the Student ID, the Extracted OCR Text of their answer, and a Granular Rubric.
                
                INSTRUCTIONS FOR NEW RUBRIC SYSTEM:
                1. For each question, evaluate the student's answer against the array of specific rubric criteria.
                2. For each criterion (e.g., 'Justification quality'), determine the points `awarded` out of the `maxPoints`.
                3. Calculate the `status` for each criterion:
                - 'full' if awarded == max
                - 'partial' if 0 < awarded < max
                - 'none' if awarded == 0
                4. Calculate the overall `aiScore` by summing the awarded points from the `rubricMatch` array.
                5. Provide a cohesive `aiJustification` summarizing why points were awarded or deducted across the criteria.
                """,
            ),
            (
                "user",
                """
                Student ID: {student_id}
                Exam Rubric: {rubric}
                Extracted Student Answer: {ocr_text}
            
                Analyze the answer and provide the grading payload.
                """,
            ),
        ]
    )

    grading_chain = prompt | structured_gemini

    try:
        result = grading_chain.invoke(
            {
                "rubric": json.dumps(state["rubric"]),
                "student_id": state["student_id"],
                "ocr_text": state["ocr_text"],
            }
        )
        return {"detailed_analysis": result.model_dump(), "status": "pipeline_complete"}
    except Exception as e:
        print(f"Error during Gemini Grading: {e}")
        return {"status": "error_grading"}


builder = StateGraph(GradingState)

builder.add_node("nemotron_ocr", run_nemotron_ocr_node)
builder.add_node("gemini_grader", grade_with_gemini_model)
builder.add_node("human_intervention", human_intervention_decider)

builder.set_entry_point("nemotron_ocr")
builder.add_edge("nemotron_ocr", "gemini_grader")
builder.add_edge("gemini_grader", "human_intervention")
builder.add_edge("human_intervention", END)
