"""
CRUD operations for database models.
"""

from pymongo.collection import Collection
from bson.objectid import ObjectId
from app.schemas import ItemCreate, Item
from typing import Optional, List


class ItemRepository:
    """Repository for Item CRUD operations."""

    def __init__(self, collection: Collection):
        self.collection = collection

    async def create(self, item: ItemCreate) -> Item:
        """Create a new item."""
        result = self.collection.insert_one(item.model_dump())
        item_dict = item.model_dump()
        item_dict["id"] = str(result.inserted_id)
        return Item(**item_dict)

    async def get(self, item_id: str) -> Optional[Item]:
        """Get item by ID."""
        doc = self.collection.find_one({"_id": ObjectId(item_id)})
        if doc:
            doc["id"] = str(doc["_id"])
            return Item(**doc)
        return None

    async def list(self, skip: int = 0, limit: int = 10) -> List[Item]:
        """List items with pagination."""
        docs = list(self.collection.find().skip(skip).limit(limit))
        return [Item(id=str(doc["_id"]), **{k: v for k, v in doc.items() if k != "_id"}) for doc in docs]

    async def update(self, item_id: str, item: ItemCreate) -> Optional[Item]:
        """Update an item."""
        result = self.collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": item.model_dump()}
        )
        if result.modified_count:
            return await self.get(item_id)
        return None

    async def delete(self, item_id: str) -> bool:
        """Delete an item."""
        result = self.collection.delete_one({"_id": ObjectId(item_id)})
        return result.deleted_count > 0

