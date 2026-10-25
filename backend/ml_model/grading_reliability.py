"""Experimental grading metrics + ML review recommendation for AutoEval.

Place this file at backend/ml_model/grading_reliability.py.
The existing synthetic model is used for integration testing only. Its output is
not validated against teacher-reviewed real-world grading data and must never
approve a grade or bypass the TA review workflow.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
import math

import joblib
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "synthetic_reliability_model.joblib"

# Must match the feature names saved in the trained model bundle.
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
    """Return a finite float, or None for unavailable/invalid values."""
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _clamp_pct(value: Any) -> float | None:
    number = _number(value)
    if number is None:
        return None
    return max(0.0, min(100.0, number))


def calculate_metrics(question: dict[str, Any]) -> tuple[dict[str, Any], dict[str, float | None]]:
    """Calculate metrics that can be grounded in the current question payload.

    Fields not produced by the current pipeline remain None; we do not invent
    image/OCR/semantic/equation/diagram metrics to fill model inputs.
    """
    ocr_text = str(question.get("ocrText") or "").strip()
    rubric = question.get("rubric") or []
    rubric_matches = question.get("rubricMatch") or []

    ai_score = _number(question.get("aiScore"))
    max_score = _number(question.get("maxScore"))
    score_ratio = (
        max(0.0, min(1.0, ai_score / max_score))
        if ai_score is not None and max_score is not None and max_score > 0
        else None
    )

    expected_names = {
        str(item.get("name", "")).strip().casefold()
        for item in rubric
        if isinstance(item, dict) and str(item.get("name", "")).strip()
    }
    evaluated_names = {
        str(item.get("name", "")).strip().casefold()
        for item in rubric_matches
        if isinstance(item, dict) and str(item.get("name", "")).strip()
    }
    rubric_coverage = (
        100.0 * len(expected_names & evaluated_names) / len(expected_names)
        if expected_names else None
    )

    valid_matches = [item for item in rubric_matches if isinstance(item, dict)]
    partial_credit_ratio = (
        100.0 * sum(str(item.get("status", "")).casefold() == "partial" for item in valid_matches)
        / len(valid_matches)
        if valid_matches else None
    )

    awarded_sum = sum((_number(item.get("awarded")) or 0.0) for item in valid_matches)
    rubric_max_sum = sum((_number(item.get("max")) or 0.0) for item in valid_matches)
    confidence = _clamp_pct(question.get("confidence"))

    # NOTE: graph.py currently gives ocrConfidence a default of 95.0. That is
    # not a measured OCR confidence, so do NOT use it as a model feature.
    # These optional fields can be populated later only after real extraction is implemented.
    features: dict[str, float | None] = {
        "ocr_confidence_pct": _clamp_pct(question.get("ocrConfidenceMeasured")),
        "image_quality_pct": _clamp_pct(question.get("imageQualityPct")),
        "rubric_coverage_pct": round(rubric_coverage, 2) if rubric_coverage is not None else None,
        "answer_completeness_pct": _clamp_pct(question.get("answerCompletenessPct")),
        "semantic_alignment_pct": _clamp_pct(question.get("semanticAlignmentPct")),
        "equation_correctness_pct": _clamp_pct(question.get("equationCorrectnessPct")),
        "diagram_coverage_pct": _clamp_pct(question.get("diagramCoveragePct")),
        "gemini_confidence_pct": confidence,
        # The training CSV uses a 0-1 ratio for this feature, not 0-100.
        "ai_score_ratio": round(score_ratio, 4) if score_ratio is not None else None,
        "partial_credit_ratio_pct": round(partial_credit_ratio, 2) if partial_credit_ratio is not None else None,
        "answer_length_chars": float(len(ocr_text)),
        "missing_region_count": _number(question.get("missingRegionCount")),
        "low_ocr_word_fraction": _number(question.get("lowOcrWordFraction")),
    }

    metrics = {
        "score_ratio_pct": round(score_ratio * 100.0, 2) if score_ratio is not None else None,
        "answer_length_chars": len(ocr_text),
        "answer_length_words": len(ocr_text.split()),
        "rubric_coverage_pct": features["rubric_coverage_pct"],
        "partial_credit_ratio_pct": features["partial_credit_ratio_pct"],
        "gemini_confidence_pct": confidence,
        "answer_is_empty": not bool(ocr_text),
        "rubric_awarded_points_sum": round(awarded_sum, 2),
        "rubric_max_points_sum": round(rubric_max_sum, 2),
        "rubric_score_matches_ai_score": (
            abs(awarded_sum - ai_score) < 0.001 if ai_score is not None else None
        ),
        "rubric_max_matches_question_max": (
            abs(rubric_max_sum - max_score) < 0.001 if max_score is not None else None
        ),
    }
    return metrics, features


@lru_cache(maxsize=1)
def _load_model_bundle() -> dict[str, Any]:
    """Load the model once per backend process."""
    bundle = joblib.load(MODEL_PATH)
    if not isinstance(bundle, dict) or "model" not in bundle:
        raise ValueError("Unexpected model bundle format")
    saved_features = bundle.get("feature_columns") or EXPECTED_FEATURES
    if list(saved_features) != EXPECTED_FEATURES:
        raise ValueError(
            "Model feature columns do not match grading_reliability.py. "
            "Retrain the model or update the feature mapping before using it."
        )
    return bundle


def enrich_question_with_metrics(question: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of one grading result enriched with metrics and ML metadata."""
    enriched = dict(question)
    try:
        metrics, features = calculate_metrics(enriched)
        available = [name for name, value in features.items() if value is not None]
        missing = [name for name, value in features.items() if value is None]
        coverage_pct = round(100.0 * len(available) / len(EXPECTED_FEATURES), 1)

        metrics.update({
            "model_feature_coverage_pct": coverage_pct,
            "available_model_features": available,
            "unavailable_model_features": missing,
        })
        enriched["gradingMetrics"] = metrics

        try:
            bundle = _load_model_bundle()
            model = bundle["model"]
            feature_columns = bundle["feature_columns"]
            row = [features.get(name) if features.get(name) is not None else np.nan for name in feature_columns]
            predicted_label = int(model.predict([row])[0])

            probability_pct = None
            if hasattr(model, "predict_proba"):
                probabilities = model.predict_proba([row])[0]
                classes = list(getattr(model, "classes_", []))
                # Pipeline exposes classes_ on the final estimator in supported sklearn versions.
                positive_index = classes.index(1) if 1 in classes else (1 if len(probabilities) > 1 else 0)
                probability_pct = round(float(probabilities[positive_index]) * 100.0, 1)

            # The current pipeline measures only 5/13 model features. Do not
            # present an imputed prediction as a meaningful recommendation until
            # enough genuine features are available.
            if coverage_pct < 70.0:
                enriched["mlReview"] = {
                    "status": "insufficient_features",
                    "label": None,
                    "needsReview": None,
                    "reviewProbabilityPct": None,
                    "recommendation": (
                        "Not enough measured features for a meaningful ML recommendation"
                    ),
                    "featureCoveragePct": coverage_pct,
                    "missingFeatures": missing,
                    "modelName": "synthetic_reliability_model",
                    "warning": (
                        f"Only {len(available)} of {len(EXPECTED_FEATURES)} features are measured. "
                        "The model was trained on synthetic data. Continue normal TA review."
                    ),
                }
            else:
                enriched["mlReview"] = {
                    "status": "experimental",
                    "label": predicted_label,
                    "needsReview": predicted_label == 1,
                    "reviewProbabilityPct": probability_pct,
                    "recommendation": (
                        "Additional review recommended"
                        if predicted_label == 1
                        else "No additional review flagged"
                    ),
                    "featureCoveragePct": coverage_pct,
                    "missingFeatures": missing,
                    "modelName": "synthetic_reliability_model",
                    "warning": (
                        "Experimental prediction from synthetic training data. "
                        "This is not validated grading reliability. TA review is still required."
                    ),
                }
        except Exception as model_error:
            enriched["mlReview"] = {
                "status": "unavailable",
                "label": None,
                "needsReview": None,
                "reviewProbabilityPct": None,
                "recommendation": "ML recommendation unavailable",
                "featureCoveragePct": coverage_pct,
                "missingFeatures": missing,
                "warning": str(model_error),
            }
    except Exception as metrics_error:
        # Never fail or bypass the current grading/TA workflow because of ML.
        enriched["gradingMetrics"] = {"status": "unavailable", "error": str(metrics_error)}
        enriched["mlReview"] = {
            "status": "unavailable",
            "label": None,
            "needsReview": None,
            "reviewProbabilityPct": None,
            "recommendation": "ML recommendation unavailable",
            "warning": "Metric calculation failed; continue with existing TA review.",
        }
    return enriched
