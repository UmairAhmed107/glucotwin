import json
import sklearn
from fastapi import APIRouter
from app.config import settings
from app.data_loader import data_loader
from app.errors import AppException
from app.schemas import HealthResponse, ModelManifestResponse
from app.twin.twin_engine import is_model_loaded

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """
    Health check returning service status, model load status,
    and runtime vs manifest scikit-learn version check.
    """
    manifest = data_loader.get_manifest()
    manifest_sklearn = manifest.get("sklearn_version", "1.6.1")
    running_sklearn = sklearn.__version__
    match = running_sklearn == manifest_sklearn

    return HealthResponse(
        status="ok",
        models_loaded=is_model_loaded(),
        sklearn_version_running=running_sklearn,
        sklearn_version_manifest=manifest_sklearn,
        version_match=match,
    )


@router.get("/system/models", response_model=ModelManifestResponse)
def get_system_models() -> ModelManifestResponse:
    """
    Read models/model_manifest.json and return model metadata, class name,
    library versions, dataset sizes, and public methods.
    """
    manifest = data_loader.get_manifest()

    meals_shape = manifest.get("meals_db", {}).get("shape", [0, 0])
    shanghai_shape = manifest.get("shanghai_clinical", {}).get("shape", [0, 0])

    dataset_sizes = {
        "meals_db": {"rows": meals_shape[0], "columns": meals_shape[1]},
        "shanghai_clinical": {"rows": shanghai_shape[0], "columns": shanghai_shape[1]},
    }
    if data_loader.bio_df is not None:
        dataset_sizes["cgmacros_bio"] = {
            "rows": data_loader.bio_df.shape[0],
            "columns": data_loader.bio_df.shape[1],
        }

    return ModelManifestResponse(
        name="Metabolic Twin Recommender",
        class_name=manifest.get("class_name", "MealRecommender"),
        sklearn_version=manifest.get("sklearn_version", "1.6.1"),
        pandas_version=manifest.get("pandas_version"),
        numpy_version=manifest.get("numpy_version"),
        dataset_sizes=dataset_sizes,
        public_methods=manifest.get("public_methods", {}),
    )


@router.get("/system/validation")
def get_system_validation():
    """
    Read backend/metrics/validation.json and return its contents.
    Returns 404 NOT_FOUND if the file is missing.
    """
    validation_path = settings.metrics_dir / "validation.json"
    if not validation_path.exists():
        raise AppException(
            code="NOT_FOUND",
            message="Validation metrics file validation.json not found.",
            status_code=404,
            details={"path": str(validation_path)},
        )
    try:
        with open(validation_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise AppException(
            code="INTERNAL_SERVER_ERROR",
            message=f"Failed to read validation metrics file: {e}",
            status_code=500,
        )


@router.api_route("/system/seed-demo", methods=["GET", "POST"])
def trigger_seed_demo():
    """
    Triggers the comprehensive demo seeder to load 10 numbered patients,
    7 doctors/dietitians, South Indian and Indian meal history, saved meals,
    and 14-day continuous CGM sensor telemetry.
    """
    from app.db import SessionLocal
    from app.food_seeder import seed_foods, seed_demo_medications
    from app.comprehensive_seeder import seed_comprehensive_database

    db = SessionLocal()
    try:
        seed_foods(db)
        seed_demo_medications(db)
        stats = seed_comprehensive_database(db)
        return {
            "status": "success",
            "message": "Demo data successfully seeded and synchronized.",
            "stats": stats,
        }
    except Exception as e:
        raise AppException(
            code="SEED_ERROR",
            message=f"Error executing comprehensive seeder: {e}",
            status_code=500,
        )
    finally:
        db.close()


