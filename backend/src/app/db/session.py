"""
Database session management.

WHY:
- Create database connections using connection pool
- Provide session factory for dependency injection
- Handle connection lifecycle properly

HOW:
- Create SQLAlchemy engine from DATABASE_URL
- Create SessionLocal factory for creating sessions
- Each request gets its own session, closed after use

PSEUDOCODE:
-----------
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker
# from app.core.config import settings
#
# # Create database engine
# engine = create_engine(
#     settings.DATABASE_URL,
#     pool_pre_ping=True,  # WHY: Verify connections before using
#     pool_size=10,  # HOW MANY: Connections to keep in pool
#     max_overflow=20  # HOW MANY: Extra connections when pool full
# )
#     WHY pool_pre_ping: Detect and reconnect dropped connections
#     WHY pool_size: Reuse connections instead of creating new ones
#     HOW: PostgreSQL can handle ~100 connections, allocate wisely
#
# # Create session factory
# SessionLocal = sessionmaker(
#     autocommit=False,  # WHY: Explicit commits for transaction control
#     autoflush=False,  # WHY: Explicit flush for better control
#     bind=engine  # HOW: Connect to our PostgreSQL database
# )
#
# # Dependency for FastAPI routes
# def get_db():
#     '''
#     WHY: Provide database session to route handlers
#     HOW: Dependency injection pattern
#
#     Usage in route:
#         @router.get("/users")
#         def get_users(db: Session = Depends(get_db)):
#             return db.query(User).all()
#     '''
#     db = SessionLocal()  # Create new session
#     try:
#         yield db  # Provide to route handler
#     finally:
#         db.close()  # Always close session, even on error
#
#     WHY try/finally: Ensure session is closed to prevent connection leaks
#     HOW yield: FastAPI dependency injection pattern
"""

# ACTUAL IMPLEMENTATION
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings


# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=10,  # Connections to keep in pool
    max_overflow=20  # Extra connections when pool full
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,  # Explicit commits for transaction control
    autoflush=False,  # Explicit flush for better control
    bind=engine  # Connect to PostgreSQL database
)


# Dependency for FastAPI routes
def get_db() -> Generator[Session, None, None]:
    """
    Provide database session to route handlers.

    Usage in route:
        @router.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
