"""
API routes for items.
"""

from fastapi import APIRouter, HTTPException
from app.schemas import ItemCreate, Item
from app.database import mongo_db
from app.crud import ItemRepository

router = APIRouter(prefix="/items", tags=["items"])


@router.post("/", response_model=Item)
async def create_item(item: ItemCreate):
    """Create a new item."""
    db = mongo_db.get_database()
    repository = ItemRepository(db["items"])
    return await repository.create(item)


@router.get("/", response_model=list[Item])
async def list_items(skip: int = 0, limit: int = 10):
    """List all items."""
    db = mongo_db.get_database()
    repository = ItemRepository(db["items"])
    return await repository.list(skip, limit)


@router.get("/{item_id}", response_model=Item)
async def get_item(item_id: str):
    """Get item by ID."""
    db = mongo_db.get_database()
    repository = ItemRepository(db["items"])
    item = await repository.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}", response_model=Item)
async def update_item(item_id: str, item: ItemCreate):
    """Update an item."""
    db = mongo_db.get_database()
    repository = ItemRepository(db["items"])
    updated_item = await repository.update(item_id, item)
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item


@router.delete("/{item_id}")
async def delete_item(item_id: str):
    """Delete an item."""
    db = mongo_db.get_database()
    repository = ItemRepository(db["items"])
    if not await repository.delete(item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted successfully"}

