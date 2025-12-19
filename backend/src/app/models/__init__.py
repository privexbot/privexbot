"""
Models package - SQLAlchemy ORM models

This file imports all models to ensure they are registered with SQLAlchemy's
metadata for Alembic migrations to work properly.
"""

# Core user and authentication models
from app.models.user import User
from app.models.auth_identity import AuthIdentity

# Multi-tenancy models
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember
from app.models.invitation import Invitation

# Knowledge Base models
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk

# KB RBAC, Audit, Notifications, Analytics
from app.models.kb_member import KBMember
from app.models.kb_audit_log import KBAuditLog
from app.models.kb_notification import KBNotification
from app.models.kb_analytics import KBAnalyticsEvent

# Chatbot models
from app.models.chatbot import Chatbot, ChatbotStatus

# Chat session and message models
from app.models.chat_session import ChatSession, SessionStatus, BotType
from app.models.chat_message import ChatMessage, MessageRole, ContentType

# API Key model
from app.models.api_key import APIKey, KeyScopeType, create_api_key

# NOTE: The following models are still pseudocode and not imported yet:
# - Chatflow
# - Lead
# - Credential

__all__ = [
    # Core
    "User",
    "AuthIdentity",
    # Multi-tenancy
    "Organization",
    "OrganizationMember",
    "Workspace",
    "WorkspaceMember",
    "Invitation",
    # Knowledge Base
    "KnowledgeBase",
    "Document",
    "Chunk",
    # KB RBAC, Audit, Notifications, Analytics
    "KBMember",
    "KBAuditLog",
    "KBNotification",
    "KBAnalyticsEvent",
    # Chatbot
    "Chatbot",
    "ChatbotStatus",
    # Chat Session/Message
    "ChatSession",
    "SessionStatus",
    "BotType",
    "ChatMessage",
    "MessageRole",
    "ContentType",
    # API Key
    "APIKey",
    "KeyScopeType",
    "create_api_key",
]
