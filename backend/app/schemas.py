"""
Models and schemas for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List


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


class ResetPasswordRequest(BaseModel):
    """Schema for completing a password reset."""

    email: str
    token: str
    password: str


class OAuthStartResponse(BaseModel):
    """Schema for OAuth start responses."""

    url: str


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str


class AuthResponse(BaseModel):
    """Schema for login/register responses."""

    message: str
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserPublic


class AuthMeResponse(BaseModel):
    """Schema for session lookups."""

    user: UserPublic


class ProjectSaveRequest(BaseModel):
    """Full project state sent from the frontend to persist in MongoDB."""

    project_id: str
    saved_at: str
    user_inputs: Dict[str, Any]
    image_gen_settings: Dict[str, Any]
    steps: Dict[str, Any]


class ProjectListItem(BaseModel):
    """Metadata returned when listing a user's saved projects."""

    project_id: str
    saved_at: str
    genre: Optional[str] = None
    has_step1: bool
    has_step2: bool
    has_step2_images: bool
    has_step3: bool
    has_step4: bool
    step1_approved: bool
    step2_approved: bool
    step2_images_approved: bool
    step3_approved: bool


class CharacterSummary(BaseModel):
    """One character entry extracted from a saved project or standalone library."""

    character_id: str
    name: str
    prompt: Optional[str] = None
    selected_image_url: Optional[str] = None
    project_id: Optional[str] = None


class CharacterUpsertPayload(BaseModel):
    """Payload for creating a new character inside a project."""

    character_id: str
    name: str
    prompt: Optional[str] = None
    selected_image_url: Optional[str] = None


class CharacterPatchPayload(BaseModel):
    """Payload for updating fields of an existing character."""

    name: Optional[str] = None
    prompt: Optional[str] = None
    selected_image_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Payload for changing a user's password from the settings page."""

    current_password: str
    new_password: str


class StatsResponse(BaseModel):
    """Aggregate stats for a user's creative library."""

    project_count: int
    character_count: int
    panel_count: int

