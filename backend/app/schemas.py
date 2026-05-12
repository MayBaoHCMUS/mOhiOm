"""
Models and schemas for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


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


class UserPublic(BaseModel):
    """Public-facing user profile data."""

    id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    providers: List[str] = Field(default_factory=list)


class AuthRegister(BaseModel):
    """Schema for manual user registration."""

    first_name: str
    last_name: str
    email: str
    password: str


class AuthLogin(BaseModel):
    """Schema for manual login."""

    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    """Schema for password reset requests."""

    email: str


class OAuthStartResponse(BaseModel):
    """Schema for OAuth start responses."""

    url: str


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str


class AuthResponse(BaseModel):
    """Schema for login/register responses."""

    message: str
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
