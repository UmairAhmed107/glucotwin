from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_MODEL")
    mock_gemini: bool = Field(default=True, alias="MOCK_GEMINI")
    database_url: str = Field(default="sqlite:///./glucotwin.db", alias="DATABASE_URL")
    replay_data_path: Optional[str] = Field(default=None, alias="REPLAY_DATA_PATH")
    jwt_secret: str = Field(default="glucotwin-dev-secret-key-change-in-prod-1234567890", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=60 * 24 * 7, alias="JWT_EXPIRE_MINUTES")

    # Base path resolution
    backend_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent)

    @property
    def resolved_database_url(self) -> str:
        if self.database_url.startswith("sqlite:///./") or self.database_url == "sqlite:///glucotwin.db":
            fname = self.database_url.split("///")[-1].lstrip("./")
            # Always anchor relative sqlite path to backend_dir
            return f"sqlite:///{(self.backend_dir / fname).resolve().as_posix()}"
        return self.database_url

    def resolve_replay_path(self) -> Optional[Path]:
        """Resolve path to CGM replay time series data if available."""
        if self.replay_data_path:
            p = Path(self.replay_data_path)
            if p.is_absolute() and p.exists():
                return p
            p_rel = self.backend_dir / p
            if p_rel.exists():
                return p_rel
            p_root = self.backend_dir.parent / p
            if p_root.exists():
                return p_root
            return None

        # Look in models_dir for common names
        for fname in ["cgm_timeseries.csv", "cgmacros_cgm.csv", "cgm.csv"]:
            candidate = self.models_dir / fname
            if candidate.exists():
                return candidate
        return None

    @property
    def models_dir(self) -> Path:
        """Resolve models directory (backend/models or root models)."""
        candidate1 = self.backend_dir / "models"
        if candidate1.exists():
            return candidate1
        candidate2 = self.backend_dir.parent / "models"
        if candidate2.exists():
            return candidate2
        return candidate1

    @property
    def metrics_dir(self) -> Path:
        """Resolve metrics directory."""
        candidate1 = self.backend_dir / "metrics"
        if candidate1.exists():
            return candidate1
        candidate2 = self.backend_dir.parent / "metrics"
        if candidate2.exists():
            return candidate2
        return candidate1

    @property
    def guidelines_dir(self) -> Path:
        """Resolve guidelines directory."""
        candidate1 = self.backend_dir / "guidelines"
        if candidate1.exists():
            return candidate1
        candidate2 = self.backend_dir.parent / "guidelines"
        if candidate2.exists():
            return candidate2
        return candidate1


settings = Settings()
