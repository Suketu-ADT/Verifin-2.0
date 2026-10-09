"""
Demo execution endpoint for out-of-the-box system demonstration.
"""

from fastapi import APIRouter, Depends
from app.schemas.demo import DemoRunResponse
from app.services.demo_service import DemoService

router = APIRouter(prefix="/api/demo", tags=["Demo"])


def get_demo_service() -> DemoService:
    return DemoService()


@router.post("/run", response_model=DemoRunResponse)
async def run_demo(
    service: DemoService = Depends(get_demo_service),
) -> DemoRunResponse:
    """
    Executes a demo run using the verified Apple FY2025 demonstration dataset.
    Returns structured claims matching the frontend contract without polluting production collections.
    """
    return await service.run_demo()
