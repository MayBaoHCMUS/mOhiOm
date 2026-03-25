from pymongo import MongoClient
from app.config import settings
from typing import Optional


class MongoDatabase:
    """MongoDB database connection manager."""

    client: Optional[MongoClient] = None
    db = None

    @classmethod
    def connect(cls):
        """Establish MongoDB connection."""
        cls.client = MongoClient(settings.MONGODB_URL)
        cls.db = cls.client[settings.DATABASE_NAME]
        print(f"Connected to MongoDB: {settings.DATABASE_NAME}")

    @classmethod
    def disconnect(cls):
        """Close MongoDB connection."""
        if cls.client:
            cls.client.close()
            print("Disconnected from MongoDB")

    @classmethod
    def get_database(cls):
        """Get database instance."""
        return cls.db


# Initialize database connection
mongo_db = MongoDatabase()

