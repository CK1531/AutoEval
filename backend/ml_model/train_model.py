from pathlib import Path
import json
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, accuracy_score

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "autoeval_synthetic_reliability_dataset.csv"
MODEL_PATH = ROOT / "synthetic_reliability_model.joblib"
METRICS_PATH = ROOT / "synthetic_training_metrics.json"
FEATURES = ['ocr_confidence_pct', 'image_quality_pct', 'rubric_coverage_pct', 'answer_completeness_pct', 'semantic_alignment_pct', 'equation_correctness_pct', 'diagram_coverage_pct', 'gemini_confidence_pct', 'ai_score_ratio', 'partial_credit_ratio_pct', 'answer_length_chars', 'missing_region_count', 'low_ocr_word_fraction']
TARGET = "needs_review_label"

def main():
    df = pd.read_csv(DATA_PATH)
    X, y = df[FEATURES], df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("rf", RandomForestClassifier(n_estimators=250, max_depth=8,
             min_samples_leaf=8, class_weight="balanced", random_state=42, n_jobs=-1))
    ])
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    report = {
        "dataset_type": "synthetic_only",
        "accuracy_synthetic_test": float(accuracy_score(y_test, pred)),
        "roc_auc_synthetic_test": float(roc_auc_score(y_test, proba)),
        "classification_report": classification_report(y_test, pred, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        "warning": "Synthetic metrics only; do not treat as real-world performance."
    }
    joblib.dump({"model": model, "feature_columns": FEATURES}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
