"""Bilingual (kk/ru/en) verdict labels + plain-language reasons (D30). Honest phrasing —
no fabricated certainty. Shared by the demo and the API (seeds the P6 explainability work)."""

from __future__ import annotations

_LABEL = {
    "spoof": {
        "en": "Synthetic (AI-generated) voice",
        "ru": "Синтетический (сгенерированный ИИ) голос",
        "kk": "Жасанды (ЖИ жасаған) дауыс",
    },
    "bona_fide": {
        "en": "Genuine human voice",
        "ru": "Настоящий человеческий голос",
        "kk": "Нақты адам дауысы",
    },
}

_REASON = {
    "spoof": {
        "en": "Acoustic patterns are consistent with synthetic (AI-generated) speech.",
        "ru": "Акустические признаки соответствуют синтетической (сгенерированной ИИ) речи.",
        "kk": "Акустикалық белгілер жасанды (ЖИ жасаған) сөйлеуге сәйкес келеді.",
    },
    "bona_fide": {
        "en": "Acoustic patterns are consistent with genuine human speech.",
        "ru": "Акустические признаки соответствуют настоящей человеческой речи.",
        "kk": "Акустикалық белгілер нақты адам сөйлеуіне сәйкес келеді.",
    },
}


def verdict_label(label: str) -> dict[str, str]:
    return dict(_LABEL[label])


def verdict_reason(label: str) -> dict[str, str]:
    return dict(_REASON[label])
