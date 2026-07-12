"""
CRUD operations for database models.
"""

from pymongo.collection import Collection
from bson.objectid import ObjectId
from app.schemas import ItemCreate, Item
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


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


class UserRepository:
    """Repository for user authentication data."""

    def __init__(self, collection: Collection):
        self.collection = collection

    @staticmethod
    def _public_user(doc: Dict[str, Any]) -> Dict[str, Any]:
        providers = []
        oauth = doc.get("oauth", {}) or {}
        if doc.get("password_hash"):
            providers.append("manual")
        for provider in ("google", "github"):
            if oauth.get(provider, {}).get("id"):
                providers.append(provider)

        return {
            "id": str(doc["_id"]),
            "email": doc.get("email"),
            "first_name": doc.get("first_name"),
            "last_name": doc.get("last_name"),
            "providers": providers,
        }

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return self.collection.find_one({"email": email.lower()})

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self.collection.find_one({"_id": ObjectId(user_id)})

    async def get_by_oauth(self, provider: str, provider_id: str) -> Optional[Dict[str, Any]]:
        return self.collection.find_one({f"oauth.{provider}.id": provider_id})

    async def create_manual_user(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        doc = {
            "email": payload["email"].lower(),
            "first_name": payload.get("first_name"),
            "last_name": payload.get("last_name"),
            "password_hash": payload["password_hash"],
            "oauth": payload.get("oauth", {}),
            "reset_token_hash": None,
            "reset_token_expires_at": None,
            "created_at": now,
            "updated_at": now,
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def upsert_oauth_user(self, provider: str, provider_profile: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        email = provider_profile.get("email")
        lookup = {f"oauth.{provider}.id": provider_profile["id"]}
        set_fields: Dict[str, Any] = {
            "first_name": provider_profile.get("first_name"),
            "last_name": provider_profile.get("last_name"),
            f"oauth.{provider}": provider_profile,
            "updated_at": now,
        }
        if email:
            set_fields["email"] = email.lower()

        update = {
            "$set": set_fields,
            "$setOnInsert": {"created_at": now},
        }

        existing = None
        if email:
            existing = self.collection.find_one({"email": email.lower()})

        if existing:
            self.collection.update_one({"_id": existing["_id"]}, update)
            return self.collection.find_one({"_id": existing["_id"]})

        result = self.collection.update_one(lookup, update, upsert=True)
        if result.upserted_id:
            return self.collection.find_one({"_id": result.upserted_id})
        return self.collection.find_one(lookup)

    async def set_password_reset(self, email: str, token_hash: str, expires_at: datetime) -> bool:
        result = self.collection.update_one(
            {"email": email.lower()},
            {
                "$set": {
                    "reset_token_hash": token_hash,
                    "reset_token_expires_at": expires_at,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.matched_count > 0

    async def clear_password_reset(self, user_id: str) -> None:
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "reset_token_hash": None,
                    "reset_token_expires_at": None,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

    async def update_password(self, user_id: str, password_hash: str) -> None:
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {"password_hash": password_hash, "updated_at": datetime.now(timezone.utc)},
            },
        )

    async def link_oauth_provider(self, user_id: str, provider: str, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        result = self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {f"oauth.{provider}": profile, "updated_at": now}},
        )
        if result.matched_count == 0:
            return None
        return self.collection.find_one({"_id": ObjectId(user_id)})

    async def get_text_gen_config(self, user_id: str) -> Optional[Dict[str, Any]]:
        doc = self.collection.find_one({"_id": ObjectId(user_id)}, {"text_gen_config": 1})
        return (doc or {}).get("text_gen_config")

    async def set_text_gen_config(self, user_id: str, config: Dict[str, Any]) -> None:
        config = {**config, "updated_at": datetime.now(timezone.utc)}
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"text_gen_config": config}},
        )

    async def clear_text_gen_config(self, user_id: str) -> None:
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$unset": {"text_gen_config": ""}},
        )

    async def get_image_gen_config(self, user_id: str) -> Optional[Dict[str, Any]]:
        doc = self.collection.find_one({"_id": ObjectId(user_id)}, {"image_gen_config": 1})
        return (doc or {}).get("image_gen_config")

    async def set_image_gen_config(self, user_id: str, config: Dict[str, Any]) -> None:
        config = {**config, "updated_at": datetime.now(timezone.utc)}
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"image_gen_config": config}},
        )

    async def clear_image_gen_config(self, user_id: str) -> None:
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$unset": {"image_gen_config": ""}},
        )

    async def get_onboarding_state(self, user_id: str) -> Optional[Dict[str, Any]]:
        doc = self.collection.find_one({"_id": ObjectId(user_id)}, {"onboarding_state": 1})
        return (doc or {}).get("onboarding_state")

    async def set_onboarding_state(self, user_id: str, state: Dict[str, Any]) -> None:
        state = {**state, "updated_at": datetime.now(timezone.utc)}
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"onboarding_state": state}},
        )

