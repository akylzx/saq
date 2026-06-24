"""API request/response schemas (the stable contract). Envelope follows the project's
standard API format: success / data / error."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Reason(BaseModel):
    en: str
    ru: str
    kk: str


class DetectData(BaseModel):
    label: str = Field(description="'spoof' (synthetic) or 'bona_fide' (genuine human)")
    spoof_probability: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0, description="probability of the chosen label")
    threshold: float
    reason: Reason
    spectrogram_png_base64: str | None = None


class DetectResponse(BaseModel):
    success: bool
    data: DetectData | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
