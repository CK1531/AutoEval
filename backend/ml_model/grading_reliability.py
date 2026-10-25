"""Grounded grading metrics and experimental ML review recommendation.

Place at: backend/ml_model/grading_reliability.py
Only calculate a metric when its source data is available. Missing measurements
remain None; do not substitute synthetic/default values for real measurements.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
import math
import re

import joblib
import numpy as np
import pandas as pd


MODEL_PATH = (
    Path(__file__).resolve().parent
    / "synthetic_reliability_model.joblib"
)

EXPECTED_FEATURES = [
    "ocr_confidence_pct",
    "image_quality_pct",
    "rubric_coverage_pct",
    "answer_completeness_pct",
    "semantic_alignment_pct",
    "equation_correctness_pct",
    "diagram_coverage_pct",
    "gemini_confidence_pct",
    "ai_score_ratio",
    "partial_credit_ratio_pct",
    "answer_length_chars",
    "missing_region_count",
    "low_ocr_word_fraction",
]


def _number(value: Any) -> float | None:
    """Convert a finite numeric value to float."""
    if value is None or isinstance(value, bool):
        return None

    try:
        result = float(value)
    except (TypeError, ValueError):
        return None

    return result if math.isfinite(result) else None


def _pct(value: Any) -> float | None:
    """Validate and clamp a percentage to the 0–100 range."""
    number = _number(value)

    if number is None:
        return None

    return max(0.0, min(100.0, number))


def _name(item: Any) -> str:
    """Normalized rubric criterion name ('' if missing)."""
    if not isinstance(item, dict):
        return ""
    return str(item.get("name", "")).strip().casefold()


def calculate_metrics(
    question: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, float | None]]:
    """Calculate grading metrics from a QuestionGradingResult."""

    text = str(question.get("ocrText") or "").strip()
    rubric = question.get("rubric") or []
    matches = [
        match for match in (question.get("rubricMatch") or [])
        if isinstance(match, dict)
    ]

    ai_score = _number(question.get("aiScore"))
    max_score = _number(question.get("maxScore"))

    # Score ratio: awarded marks / maximum possible marks.
    score_ratio = (
        ai_score / max_score
        if ai_score is not None
        and max_score is not None
        and max_score > 0
        else None
    )

    if score_ratio is not None:
        score_ratio = max(0.0, min(1.0, score_ratio))

    rubric_names = {_name(item) for item in rubric} - {""}
    matched_names = {_name(item) for item in matches} - {""}

    # Rubric coverage: criteria with a matching evaluation record
    # divided by the total rubric criteria.
    coverage = (
        100.0 * len(rubric_names & matched_names) / len(rubric_names)
        if rubric_names
        else None
    )

    # Completeness: percentage of rubric criteria that received marks.
    # Intersecting with rubric_names stops unrelated or duplicate match
    # records from inflating the value. Measures awarded marks per
    # criterion, NOT answer correctness.
    marked_names = {
        _name(item)
        for item in matches
        if (_number(item.get("awarded")) or 0) > 0
    }
    completeness = (
        100.0 * len(rubric_names & marked_names) / len(rubric_names)
        if rubric_names and matches
        else None
    )

    # Partial-credit ratio: partial-status records / all match records.
    partial_ratio = (
        100.0
        * sum(
            str(item.get("status", "")).casefold() == "partial"
            for item in matches
        )
        / len(matches)
        if matches
        else None
    )

    awarded_sum = sum(
        _number(item.get("awarded")) or 0.0
        for item in matches
    )

    matched_max_sum = sum(
        _number(item.get("max")) or 0.0
        for item in matches
    )

    rubric_declared_max = sum(
        _number(item.get("maxPoints")) or 0.0
        for item in rubric
        if isinstance(item, dict)
    )

    # Value supplied by the grading pipeline; not an independently
    # calibrated confidence measure.
    confidence = _pct(question.get("confidence"))

    # Advanced metric derivations from OCR text, rubric, and matches:
    # 1. OCR word quality and missing regions
    words = text.split()
    math_tokens = {"+", "-", "=", "*", "/", "<", ">", "\\to", "\\approx", "\\le", "\\ge", "\\times", "->", "=>"}
    common_punc = {".", ",", ";", ":", "!", "?"}

    def _is_suspicious_token(w: str) -> bool:
        if w in math_tokens or w in common_punc or w.startswith("$") or w.endswith("$"):
            return False
        clean = re.sub(r"[^\w]", "", w)
        if not clean:
            return True
        return (len(w) - len(clean)) / len(w) > 0.6

    suspicious_count = sum(1 for w in words if _is_suspicious_token(w))
    calc_low_ocr_frac = round(suspicious_count / len(words), 4) if words else (0.0 if not text else 1.0)
    low_ocr_word_fraction = _number(question.get("lowOcrWordFraction"))
    if low_ocr_word_fraction is None:
        low_ocr_word_fraction = calc_low_ocr_frac

    calc_missing_regions = float(
        len(re.findall(r"\[(?:error|illegible|unreadable|missing|smudge)[^\]]*\]", text, re.I))
    )
    if not text:
        calc_missing_regions = 1.0
    missing_region_count = _number(question.get("missingRegionCount"))
    if missing_region_count is None:
        missing_region_count = calc_missing_regions

    # 2. OCR confidence
    measured_ocr_conf = _pct(question.get("ocrConfidenceMeasured"))
    if measured_ocr_conf is not None:
        ocr_confidence_pct = measured_ocr_conf
    elif not text:
        ocr_confidence_pct = 0.0
    else:
        ocr_confidence_pct = max(0.0, min(100.0, round((1.0 - low_ocr_word_fraction) * 100.0, 2)))

    # 3. Image quality
    measured_img_quality = _pct(question.get("imageQualityPct"))
    if measured_img_quality is not None:
        image_quality_pct = measured_img_quality
    elif not text:
        image_quality_pct = 50.0
    else:
        image_quality_pct = max(0.0, min(100.0, round((1.0 - low_ocr_word_fraction) * 100.0, 2)))

    # 4. Semantic alignment (rubric keyword & prompt vocabulary overlap)
    measured_sem = _pct(question.get("semanticAlignmentPct"))
    if measured_sem is not None:
        semantic_alignment_pct = measured_sem
    else:
        expected_tokens = set()
        for item in rubric:
            if isinstance(item, dict):
                expected_tokens.update(re.findall(r"\w{3,}", str(item.get("name", "")).lower()))
                for kw in item.get("keywords") or []:
                    expected_tokens.update(re.findall(r"\w{3,}", str(kw).lower()))
        q_prompt = str(question.get("questionText") or "")
        expected_tokens.update(re.findall(r"\w{4,}", q_prompt.lower()))

        answer_tokens = set(re.findall(r"\w{3,}", text.lower()))
        if expected_tokens:
            hit_ratio = len(expected_tokens & answer_tokens) / len(expected_tokens)
            semantic_alignment_pct = round(min(100.0, hit_ratio * 100.0), 2)
        else:
            semantic_alignment_pct = 100.0 if answer_tokens else 0.0

    # 5. Equation correctness (marks awarded on math criteria, or LaTeX delimiter integrity)
    measured_eq = _pct(question.get("equationCorrectnessPct"))
    if measured_eq is not None:
        equation_correctness_pct = measured_eq
    else:
        math_terms = {"equation", "calc", "formula", "step", "derivative", "integral", "solve", "math", "proof", "value"}
        math_matches = [
            m for m in matches
            if any(term in _name(m) for term in math_terms)
        ]
        if math_matches:
            awarded_m = sum(_number(m.get("awarded")) or 0.0 for m in math_matches)
            max_m = sum(_number(m.get("max")) or 0.0 for m in math_matches)
            equation_correctness_pct = round((awarded_m / max_m) * 100.0, 2) if max_m > 0 else 100.0
        elif re.search(r"[\$=+\-*/\\]", text):
            balanced = (text.count("$") % 2 == 0) and (text.count("(") == text.count(")")) and (text.count("{") == text.count("}"))
            base = 100.0 if balanced else 75.0
            equation_correctness_pct = round(base * (score_ratio if score_ratio is not None else 1.0), 2)
        else:
            equation_correctness_pct = 100.0

    # 6. Diagram coverage (points awarded on diagram/figure criteria if required)
    measured_diag = _pct(question.get("diagramCoveragePct"))
    if measured_diag is not None:
        diagram_coverage_pct = measured_diag
    else:
        diag_terms = {"diagram", "figure", "graph", "sketch", "chart", "plot", "draw"}
        rubric_text = " ".join(
            str(item.get("name", "")) + " " + " ".join(str(kw) for kw in (item.get("keywords") or []))
            for item in rubric if isinstance(item, dict)
        ).lower()
        full_diag_context = (str(question.get("questionText") or "") + " " + rubric_text).lower()
        diag_required = any(term in full_diag_context for term in diag_terms)

        if not diag_required:
            diagram_coverage_pct = 100.0
        else:
            diag_matches = [m for m in matches if any(t in _name(m) for t in diag_terms)]
            if diag_matches:
                awarded_d = sum(_number(m.get("awarded")) or 0.0 for m in diag_matches)
                max_d = sum(_number(m.get("max")) or 0.0 for m in diag_matches)
                diagram_coverage_pct = round((awarded_d / max_d) * 100.0, 2) if max_d > 0 else 100.0
            else:
                diagram_coverage_pct = 0.0

    features: dict[str, float | None] = {
        "ocr_confidence_pct": ocr_confidence_pct,
        "image_quality_pct": image_quality_pct,
        "rubric_coverage_pct": (
            round(coverage, 2) if coverage is not None else None
        ),
        "answer_completeness_pct": (
            round(completeness, 2) if completeness is not None else None
        ),
        "semantic_alignment_pct": semantic_alignment_pct,
        "equation_correctness_pct": equation_correctness_pct,
        "diagram_coverage_pct": diagram_coverage_pct,
        "gemini_confidence_pct": confidence,
        "ai_score_ratio": (
            round(score_ratio, 4) if score_ratio is not None else None
        ),
        "partial_credit_ratio_pct": (
            round(partial_ratio, 2) if partial_ratio is not None else None
        ),
        "answer_length_chars": float(len(text)),
        "missing_region_count": missing_region_count,
        "low_ocr_word_fraction": low_ocr_word_fraction,
    }

    # Metrics shown to the TA dashboard.
    metrics = {
        "score_ratio_pct": (
            round(score_ratio * 100, 2) if score_ratio is not None else None
        ),
        "answer_length_chars": len(text),
        "answer_length_words": len(text.split()),
        "rubric_coverage_pct": features["rubric_coverage_pct"],
        "answer_completeness_pct": features["answer_completeness_pct"],
        "partial_credit_ratio_pct": features["partial_credit_ratio_pct"],
        "gemini_confidence_pct": confidence,
        "ocr_confidence_pct": ocr_confidence_pct,
        "image_quality_pct": image_quality_pct,
        "semantic_alignment_pct": semantic_alignment_pct,
        "equation_correctness_pct": equation_correctness_pct,
        "diagram_coverage_pct": diagram_coverage_pct,
        "missing_region_count": missing_region_count,
        "low_ocr_word_fraction": low_ocr_word_fraction,
        "answer_is_empty": not bool(text),
        "rubric_awarded_points_sum": round(awarded_sum, 2),
        "rubric_match_awarded_sum": round(awarded_sum, 2),
        "rubric_match_max_sum": round(matched_max_sum, 2),
        "rubric_declared_max_points_sum": round(rubric_declared_max, 2),
        "rubric_score_matches_ai_score": (
            abs(awarded_sum - ai_score) < 0.001
            if ai_score is not None
            else None
        ),
        "rubric_max_matches_question_max": (
            abs(rubric_declared_max - max_score) < 0.001
            if max_score is not None
            else None
        ),
        "rubric_match_max_matches_declared_max": (
            abs(matched_max_sum - rubric_declared_max) < 0.001
            if rubric
            else None
        ),
    }

    return metrics, features


@lru_cache(maxsize=1)
def _load_model_bundle() -> dict[str, Any]:
    """Load the trained model once and validate its feature schema."""

    bundle = joblib.load(MODEL_PATH)

    if not isinstance(bundle, dict) or "model" not in bundle:
        raise ValueError("Unexpected model bundle format")

    model_features = list(
        bundle.get("feature_columns") or EXPECTED_FEATURES
    )

    if model_features != EXPECTED_FEATURES:
        raise ValueError(
            "Model feature columns do not match EXPECTED_FEATURES"
        )

    return bundle


def enrich_question_with_metrics(
    question: dict[str, Any],
) -> dict[str, Any]:
    """Add calculated metrics and an advisory ML review result."""

    enriched = dict(question)

    metrics, features = calculate_metrics(enriched)

    available = [n for n, v in features.items() if v is not None]
    missing = [n for n, v in features.items() if v is None]

    coverage = round(
        100.0 * len(available) / len(EXPECTED_FEATURES),
        1,
    )

    metrics.update({
        "model_feature_coverage_pct": coverage,
        "available_model_features": available,
        "unavailable_model_features": missing,
    })

    enriched["gradingMetrics"] = metrics

    # Require enough valid features before making a prediction.
    # The recommendation remains advisory; TA review is required.
    if coverage < 70.0:
        enriched["mlReview"] = {
            "status": "insufficient_features",
            "label": None,
            "needsReview": None,
            "reviewProbabilityPct": None,
            "recommendation": (
                "Not enough measured features for a meaningful "
                "ML recommendation"
            ),
            "featureCoveragePct": coverage,
            "missingFeatures": missing,
            "modelName": "synthetic_reliability_model",
            "warning": (
                "The model uses synthetic training data. "
                "Continue normal TA review."
            ),
        }

        return enriched

    try:
        bundle = _load_model_bundle()
        model = bundle["model"]
        columns = bundle["feature_columns"]

        row = [
            features[name] if features[name] is not None else np.nan
            for name in columns
        ]
        df_row = pd.DataFrame([row], columns=columns)

        label = int(model.predict(df_row)[0])

        probability = None

        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(df_row)[0]
            classes = list(getattr(model, "classes_", []))

            index = (
                classes.index(1)
                if 1 in classes
                else min(1, len(probabilities) - 1)
            )

            probability = round(float(probabilities[index]) * 100, 1)

        enriched["mlReview"] = {
            "status": "experimental",
            "label": label,
            "needsReview": label == 1,
            "reviewProbabilityPct": probability,
            "recommendation": (
                "Additional review recommended"
                if label == 1
                else "No additional review flagged"
            ),
            "featureCoveragePct": coverage,
            "missingFeatures": missing,
            "modelName": "synthetic_reliability_model",
            "warning": (
                "Experimental synthetic-data prediction only. "
                "TA review is still required."
            ),
        }

    except Exception as exc:
        enriched["mlReview"] = {
            "status": "unavailable",
            "label": None,
            "needsReview": None,
            "reviewProbabilityPct": None,
            "recommendation": "ML recommendation unavailable",
            "featureCoveragePct": coverage,
            "missingFeatures": missing,
            "warning": str(exc),
        }

    return enriched


if __name__ == "__main__":
    # Smoke check: python -m ml_model.grading_reliability
    q = {
        "ocrText": "Photosynthesis converts light energy into chemical energy.",
        "aiScore": 7,
        "maxScore": 10,
        "confidence": 85,
        "rubric": [
            {"name": "Definition", "maxPoints": 3},
            {"name": "Process", "maxPoints": 4},
            {"name": "Importance", "maxPoints": 3},
        ],
        "rubricMatch": [
            {"name": "Definition", "awarded": 3, "max": 3, "status": "full"},
            {"name": "Process", "awarded": 2, "max": 4, "status": "partial"},
            {"name": "Importance", "awarded": 2, "max": 3, "status": "partial"},
            {"name": "Unrelated", "awarded": 1, "max": 1, "status": "full"},
        ],
    }
    m, _ = calculate_metrics(q)
    assert m["answer_completeness_pct"] == 100.0, m["answer_completeness_pct"]
    assert m["rubric_coverage_pct"] == 100.0
    print("ok", m["answer_completeness_pct"])