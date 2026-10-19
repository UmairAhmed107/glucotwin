from typing import List
from fastapi import APIRouter
from app.data_loader import (
    BioDataUnavailableException,
    ShanghaiDataUnavailableException,
    data_loader,
)
from app.errors import ServiceUnavailableException
from app.schemas import DropdownItem, ShanghaiDropdownItem

router = APIRouter(prefix="/data", tags=["Data"])


@router.get("/cgmacros-participants", response_model=List[DropdownItem])
def get_cgmacros_participants() -> List[DropdownItem]:
    """
    Return candidate CGMacros participants for dropdown selection.
    Returns id and short clinical summary only; never dumps full table.
    Returns 503 if bio file is missing.
    """
    try:
        items = data_loader.get_cgmacros_dropdown()
        return [DropdownItem(**item) for item in items]
    except BioDataUnavailableException as e:
        raise ServiceUnavailableException(
            message=str(e),
            details={"dataset": "cgmacros_bio", "file": "bio.csv"},
        )


@router.get("/shanghai-profiles", response_model=List[ShanghaiDropdownItem])
def get_shanghai_profiles() -> List[ShanghaiDropdownItem]:
    """
    Return candidate Shanghai clinical profiles for dropdown selection.
    Returns id and short clinical summary only; never dumps full table.
    """
    try:
        items = data_loader.get_shanghai_dropdown()
        return [ShanghaiDropdownItem(**item) for item in items]
    except ShanghaiDataUnavailableException as e:
        raise ServiceUnavailableException(
            message=str(e),
            details={"dataset": "shanghai_clinical", "file": "shanghai_clinical.pkl"},
        )
