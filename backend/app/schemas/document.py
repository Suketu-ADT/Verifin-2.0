"""
Document API schemas matching frontend DocumentResponse contract.
"""

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    filename: str
    file_type: str
    size: int
    page_count: int
    status: str
