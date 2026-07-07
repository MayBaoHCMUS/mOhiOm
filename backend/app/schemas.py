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
    is_public: bool = False
    is_publishable: bool = False


class CharacterSummary(BaseModel):
    """One character entry extracted from a saved project or standalone library."""

    character_id: str
    name: str
    prompt: Optional[str] = None
    selected_image_url: Optional[str] = None
    project_id: Optional[str] = None
    is_public: bool = False


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
    is_public: Optional[bool] = None


class ProjectPublishPayload(BaseModel):
    """Payload for toggling a project's gallery visibility."""

    is_public: bool


class GalleryComicSummary(BaseModel):
    """Summary of a public comic shown in the community gallery."""

    project_id: str
    title: str
    genre: str
    art_style: str
    story_synopsis: str
    cover_image_url: Optional[str] = None
    page_count: int
    published_at: str


class GalleryComicDetail(BaseModel):
    """Full data for reading a public comic."""

    project_id: str
    title: str
    genre: str
    art_style: str
    story_content: str
    main_characters: str
    pages: List[Dict[str, Any]]


class ChangePasswordRequest(BaseModel):
    """Payload for changing a user's password from the settings page."""

    current_password: str
    new_password: str


class StatsResponse(BaseModel):
    """Aggregate stats for a user's creative library."""

    project_count: int
    character_count: int
    panel_count: int


class ComposePanelInput(BaseModel):
    """One panel's metadata + image for page composition."""

    panel_number: int
    page_number: int
    shot_type: str = "medium shot"
    dialogue: Optional[str] = None
    image_data_url: str


class CrossPanelBubble(BaseModel):
    """A speech bubble that visually spans two adjacent panels across the gutter."""

    text: str
    bubble_type: str = "speech"
    panel_indices: List[int] = Field(
        ...,
        min_length=2, max_length=2,
        description="Two 0-based indices (sorted panel order) of the adjacent panels this bubble bridges.",
    )


class ComposePageRequest(BaseModel):
    """Request to compose a set of panel images into a single comic page."""

    panels: List[ComposePanelInput]
    style: str = "manga"
    layout: Optional[List[List[int]]] = None  # explicit panel-index rows, e.g. [[0,1],[2]]
    use_smart_layout: bool = False             # trigger LLM layout selection
    cross_panel_bubbles: Optional[List[CrossPanelBubble]] = None  # bubbles spanning two panels


class ComposePageResponse(BaseModel):
    """Composed comic page returned as base64 PNG."""

    status: str
    page_base64: str
    page_width: int
    page_height: int
    panel_count: int
    layout_name: Optional[str] = None  # e.g. "grid_2x2" or display name


class AutoLayoutPanel(BaseModel):
    """Metadata for one panel used in auto-layout (no image — comes from splitting)."""

    panel_number: int
    shot_type: str = "medium shot"
    dialogue: Optional[str] = None


class AutoLayoutRequest(BaseModel):
    """Split a full AI-generated page into panels, then re-compose with intensity sizing."""

    page_image_data_url: str
    panels: List[AutoLayoutPanel]
    style: str = "manga"


class AutoLayoutResponse(BaseModel):
    """Re-composed page after splitting and re-laying out panels."""

    status: str
    page_base64: str
    page_width: int
    page_height: int
    panel_count: int
    detected_panels: int


class LayoutDimensionsRequest(BaseModel):
    """Request to compute panel cell pixel dimensions for a chosen layout template."""

    panels: List[AutoLayoutPanel]  # panel_number + shot_type per panel
    layout_name: str               # e.g. "grid_2x2"; "auto" triggers rule-based selection
    style: str = "manga"


class PanelCellDimensions(BaseModel):
    """Exact pixel dimensions for one panel cell in the chosen layout."""

    panel_index: int   # 0-based position in the sorted panels list
    panel_number: int  # 1-based panel number from the script
    width: int
    height: int


class LayoutDimensionsResponse(BaseModel):
    """Computed cell dimensions for every panel in the chosen layout."""

    status: str
    layout_name: str
    layout: List[List[int]]               # resolved row-of-indices structure
    dimensions: List[PanelCellDimensions]
    page_width: int = 1200
    page_height: int = 1600


class ProjectImageEntry(BaseModel):
    image_key: str  # "panel:p1-n1" or "page:page-1"
    image_url: str  # R2 public URL


class ProjectImagesSaveRequest(BaseModel):
    images: List[ProjectImageEntry]


class ProjectImagesResponse(BaseModel):
    images: List[ProjectImageEntry]


class ImageUploadRequest(BaseModel):
    image_base64: str
    folder: str = "misc"


class ImageUploadResponse(BaseModel):
    image_url: str

