"""Frozen, nested AppConfig tree (D45). Single source of truth — no magic literals
elsewhere (D46). Leaf module: imports only pydantic (D39)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class _Frozen(BaseModel):
    model_config = {"frozen": True, "extra": "forbid"}


class PathsConfig(_Frozen):
    data_dir: str = "data"
    artifacts_dir: str = "artifacts"
    cache_dir: str = "artifacts/cache"
    examples_dir: str = "data/examples"


class DataConfig(_Frozen):
    fleurs_configs: tuple[str, ...] = ("kk_kz", "ru_ru")  # D10
    fleurs_split: str = "validation"  # small shard (~340 MB/lang) vs huge train
    target_per_class: int = 1500  # D18 (scale down on slow HW)
    clip_seconds_min: float = 3.0  # D18
    clip_seconds_max: float = 6.0
    cv_sample_size: int = 0  # D11 supplement; 0 = disabled
    test_fraction: float = 0.15  # D19 — group fraction held out for test


class SynthConfig(_Frozen):
    engines: tuple[str, ...] = ("mms", "silero")  # D14
    unseen_engine: str = "silero"  # held out for test_unseen (D19)
    mms_kaz_model: str = "facebook/mms-tts-kaz"
    mms_rus_model: str = "facebook/mms-tts-rus"


class AugmentConfig(_Frozen):
    enabled: bool = True  # D16 toggle (clean vs degraded comparison)
    apply_telephone: bool = True  # D15 — must-keep aug (8 kHz μ-law)
    telephone_sr: int = 8000
    noise_snr_db: float = 15.0  # additive white noise level
    reverb_prob: float = 0.3  # chance of adding synthetic reverb in `degrade`


class BackboneConfig(_Frozen):
    model_id: str = "facebook/wav2vec2-xls-r-300m"  # D6
    revision: str = "main"  # TODO(D51): pin to commit sha before ship
    pooling: str = "mean_std"  # D7/D8 §16.2
    layers: str = "last"


class ClassifierConfig(_Frozen):
    kind: str = "lgbm"  # {"lgbm","mlp","aasist"} (D43)
    lgbm_params: dict = Field(
        default_factory=lambda: {
            "n_estimators": 400,
            "learning_rate": 0.05,
            "num_leaves": 31,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
        }
    )
    mlp_params: dict = Field(
        default_factory=lambda: {"hidden": 256, "dropout": 0.3, "epochs": 30, "lr": 1e-3}
    )


class EvalConfig(_Frozen):
    target_fpr: float = 0.05  # D24 — threshold tuned for low false-positive rate


class DeviceConfig(_Frozen):
    prefer: str = "mps"  # D5
    allow_cpu_fallback: bool = True


class RuntimeConfig(_Frozen):
    seed: int = 1337  # D48
    sample_rate: int = 16000  # backbone input
    max_audio_seconds: float = 60.0  # D49 long-file defense (FLEURS clips run up to ~30 s)
    max_upload_bytes: int = 15 * 1024 * 1024  # D49 size cap (15 MB)
    batch_size: int = 4  # D56 — small to avoid MPS OOM on 17 GB shared RAM


class ApiConfig(_Frozen):
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: tuple[str, ...] = ("*",)  # dev default; restrict to the site origin in prod
    spectrogram_dpi: int = 100


class AppConfig(_Frozen):
    paths: PathsConfig = Field(default_factory=PathsConfig)
    data: DataConfig = Field(default_factory=DataConfig)
    synth: SynthConfig = Field(default_factory=SynthConfig)
    augment: AugmentConfig = Field(default_factory=AugmentConfig)
    backbone: BackboneConfig = Field(default_factory=BackboneConfig)
    classifier: ClassifierConfig = Field(default_factory=ClassifierConfig)
    eval: EvalConfig = Field(default_factory=EvalConfig)
    device: DeviceConfig = Field(default_factory=DeviceConfig)
    runtime: RuntimeConfig = Field(default_factory=RuntimeConfig)
    api: ApiConfig = Field(default_factory=ApiConfig)


def load_config() -> AppConfig:
    """Return the default immutable config. (Env/TOML overlay can layer here later, D46.)"""
    return AppConfig()
