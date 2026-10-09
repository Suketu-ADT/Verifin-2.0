"""
Demo API schemas matching frontend DemoRunResponse contract.
"""

from typing import List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.verification import ClaimResponse


class DemoRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    message: str
    session_id: str
    claims_count: int
    claims: List[ClaimResponse] = Field(default_factory=list)
