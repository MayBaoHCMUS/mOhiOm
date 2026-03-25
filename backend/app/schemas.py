"""
Models and schemas for API requests and responses.
"""

from pydantic import BaseModel
from typing import Optional


class ItemBase(BaseModel):
    """Base item schema."""

    name: str
    description: Optional[str] = None


class ItemCreate(ItemBase):
    """Schema for creating an item."""

    pass


class Item(ItemBase):
    """Schema for item response."""

    id: Optional[str] = None

    class Config:
        from_attributes = True

