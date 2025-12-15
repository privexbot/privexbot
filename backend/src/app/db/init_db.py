"""
Database initialization and table creation.

WHY:
- Create all database tables on first startup
- Safe initialization (only creates if not exists)
- Useful for development and testing

HOW:
- Import all models through base.py
- Use Base.metadata.create_all() to create tables
- Call on application startup

Usage:
------
# In main.py startup event
from app.db.init_db import init_db
init_db()
"""

# ACTUAL IMPLEMENTATION
from app.db.session import engine


def init_db() -> None:
    """
    Initialize database by creating all tables.

    This is safe to call multiple times - it only creates tables
    that don't already exist.

    NOTE: Currently disabled until models are fully implemented.
    Uncomment the code below when models are ready.
    """
    # Uncomment when models are implemented:
    # from app.db.base import Base
    # Base.metadata.create_all(bind=engine)
    # print("✅ Database tables created successfully")

    # For now, just verify database connection
    try:
        engine.connect()
        print("✅ Database connection successful")
    except Exception as e:
        print(f"⚠️  Database connection warning: {e}")
