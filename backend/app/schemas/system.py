"""
System health schemas.
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict


class ServicesHealth(BaseModel):
    model_config = ConfigDict(extra="forbid")

    backend: str
    database: str
    embedding: str
    nli: str
    llm: Optional[str] = "ready"


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    services: ServicesHealth
