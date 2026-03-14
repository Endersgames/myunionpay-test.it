from pathlib import Path


def test_admin_myu_training_frontend_preserves_new_behavior_fields():
    repo_root = Path(__file__).resolve().parents[2]
    page_file = repo_root / "frontend" / "src" / "screens" / "AdminMyuTrainingPage.jsx"
    text = page_file.read_text(encoding="utf-8")

    required_keys = [
        "human_mode_enabled",
        "adaptive_style_enabled",
        "curiosity_level",
        "humor_style",
        "surprise_insights_enabled",
        "proactive_enabled",
        "proactive_followups_enabled",
        "proactive_checkins_enabled",
        "proactivity_boundaries",
    ]
    for key in required_keys:
        assert key in text, f"Missing behavior field in frontend config flow: {key}"


def test_admin_api_has_protected_training_document_download_method():
    repo_root = Path(__file__).resolve().parents[2]
    api_file = repo_root / "frontend" / "src" / "lib" / "api.js"
    text = api_file.read_text(encoding="utf-8")

    assert "downloadMyuTrainingDocument" in text
    assert "/admin/myu-training/training-documents/${documentId}/download" in text
