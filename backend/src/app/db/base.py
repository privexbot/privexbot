"""
Import all models for Alembic auto-generation.

WHY:
- Alembic needs to import all models to detect schema changes
- Central place to import all models for migrations
- Ensures all models are registered with SQLAlchemy

HOW:
- Import Base from base_class
- Import all model classes
- Alembic's env.py imports from here

PSEUDOCODE:
-----------
# from app.db.base_class import Base  # noqa
#
# # Import all models here so Alembic can detect them
# from app.models.user import User  # noqa
# from app.models.auth_identity import AuthIdentity  # noqa
# from app.models.organization import Organization  # noqa
# from app.models.workspace import Workspace  # noqa
# from app.models.organization_member import OrganizationMember  # noqa
# from app.models.workspace_member import WorkspaceMember  # noqa
# from app.models.chatbot import Chatbot  # noqa
# from app.models.chatflow import Chatflow  # noqa
# from app.models.knowledge_base import KnowledgeBase  # noqa
# from app.models.document import Document  # noqa
# from app.models.chunk import Chunk  # noqa
# from app.models.api_key import APIKey  # noqa
#
# NOTE: Chatbot and Chatflow are SEPARATE models
#     - chatbot: Simple form-based bots
#     - chatflow: Advanced drag-and-drop workflow bots
#
# NOTE: Knowledge Base models
#     - knowledge_base: RAG knowledge storage
#     - document: Individual documents within KB
#     - chunk: Text segments for embedding/retrieval
#
# NOTE: API Key model
#     - api_key: Public API access for deployed resources
#
# WHY noqa: Tell linters to ignore "unused import" warnings
# WHY import all: Alembic scans Base.metadata to find all tables
#
# USAGE IN ALEMBIC:
# -----------------
# # In alembic/env.py
# from app.db.base import Base
#
# def run_migrations():
#     # Base.metadata now contains all table definitions
#     context.configure(
#         target_metadata=Base.metadata  # All models registered here
#     )
#
# MIGRATION WORKFLOW:
# -------------------
# 1. Create/modify model in app/models/
# 2. Import model in this file
# 3. Run: alembic revision --autogenerate -m "description"
# 4. Alembic compares Base.metadata (all models) to database
# 5. Generates migration with detected changes
"""

# ACTUAL IMPLEMENTATION
# Import Base first
from app.db.base_class import Base  # noqa

# Import models so they are registered with SQLAlchemy
# These imports ensure Alembic can detect all tables for migrations
from app.models.user import User  # noqa
from app.models.auth_identity import AuthIdentity  # noqa

#  TODO: Uncomment these imports as you implement each model
# from app.models.organization import Organization  # noqa
# from app.models.workspace import Workspace  # noqa
# from app.models.organization_member import OrganizationMember  # noqa
# from app.models.workspace_member import WorkspaceMember  # noqa
# from app.models.chatbot import Chatbot  # noqa
# from app.models.chatflow import Chatflow  # noqa
# from app.models.knowledge_base import KnowledgeBase  # noqa
# from app.models.document import Document  # noqa
# from app.models.chunk import Chunk  # noqa
# from app.models.chat_session import ChatSession  # noqa
# from app.models.chat_message import ChatMessage  # noqa
# from app.models.lead import Lead  # noqa
# from app.models.credential import Credential  # noqa
# from app.models.api_key import APIKey  # noqa
