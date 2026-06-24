"""D63 — API contract envelope (fast, no model)."""

from saq.api.schemas import DetectData, DetectResponse, Reason
from saq.explain.reasons import verdict_label, verdict_reason


def test_detect_response_envelope_shape():
    data = DetectData(
        label="spoof",
        spoof_probability=0.97,
        confidence=0.97,
        threshold=0.5,
        reason=Reason(en="x", ru="y", kk="z"),
    )
    payload = DetectResponse(success=True, data=data).model_dump()
    assert payload["success"] is True
    assert payload["error"] is None
    assert payload["data"]["label"] == "spoof"
    assert set(payload["data"]["reason"]) == {"en", "ru", "kk"}


def test_error_envelope_has_no_data():
    payload = DetectResponse(success=False, error="Audio too long").model_dump()
    assert payload["success"] is False
    assert payload["data"] is None
    assert payload["error"] == "Audio too long"


def test_reason_and_label_cover_three_languages():
    for label in ("spoof", "bona_fide"):
        assert set(verdict_label(label)) == {"en", "ru", "kk"}
        assert set(verdict_reason(label)) == {"en", "ru", "kk"}
