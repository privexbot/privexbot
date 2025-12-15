"""
Pydantic schemas for Chatbot API requests and responses.

WHY:
- Validate chatbot creation/update data
- Support both simple chatbot and advanced chatflow types
- Flexible config structure for different bot types

IMPORTANT:
- Platform supports TWO types: "simple" and "chatflow"
- Simple: Form-based FAQ/knowledge bots
- Chatflow: Drag-and-drop visual workflow builder

PSEUDOCODE:
-----------
from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Literal

# Chatbot Types
ChatbotType = Literal["simple", "chatflow"]
    WHY: Type-safe enum for bot types
    SIMPLE: Form-based chatbot configuration
    CHATFLOW: ReactFlow-based visual workflow

# Base chatbot config (common to both types)
class ChatbotConfigBase(BaseModel):
    \"\"\"Common configuration fields\"\"\"
    type: ChatbotType
        WHY: Determines which builder/runtime to use

    model: str = "gpt-4"
        WHY: AI model to use
        EXAMPLE: "gpt-4", "gpt-3.5-turbo", "claude-3"

    temperature: float = 0.7 (ge=0, le=2)
        WHY: Control response randomness

    system_prompt: str | None
        WHY: Custom instructions for the AI

# Simple Chatbot Config
class SimpleChatbotConfig(ChatbotConfigBase):
    \"\"\"
    WHY: Configuration for form-based chatbots
    HOW: Simpler setup for FAQ/knowledge retrieval
    \"\"\"
    type: Literal["simple"]

    knowledge_base_ids: list[UUID4] = []
        WHY: Link to knowledge bases for RAG

    max_messages_history: int = 10
        WHY: Conversation memory depth

    enable_sources: bool = True
        WHY: Show source documents in responses

# Chatflow Config
class ChatflowConfig(ChatbotConfigBase):
    \"\"\"
    WHY: Configuration for advanced drag-and-drop workflows
    HOW: Stores ReactFlow node/edge data
    \"\"\"
    type: Literal["chatflow"]

    nodes: list[dict]
        WHY: ReactFlow nodes (AI nodes, conditional nodes, API nodes, etc.)
        EXAMPLE: [
            {"id": "1", "type": "llm", "data": {"prompt": "..."}, "position": {"x": 0, "y": 0}},
            {"id": "2", "type": "condition", "data": {"logic": "..."}, "position": {"x": 200, "y": 0}}
        ]

    edges: list[dict]
        WHY: Connections between nodes
        EXAMPLE: [{"id": "e1-2", "source": "1", "target": "2"}]

    variables: dict[str, any] = {}
        WHY: Workflow-level variables
        EXAMPLE: {"user_name": "", "order_id": ""}

    memory_config: dict
        WHY: Advanced memory settings for stateful conversations
        EXAMPLE: {
            "type": "buffer" | "summary" | "entity",
            "max_tokens": 1000
        }

# Common config (union of both types)
ChatbotConfig = SimpleChatbotConfig | ChatflowConfig
    WHY: Accept either type in API

# Branding/Deployment config (common to both)
class ChatbotBranding(BaseModel):
    \"\"\"
    WHY: Customize appearance and deployment
    \"\"\"
    avatar_url: str | None
    primary_color: str | None
        EXAMPLE: "#3B82F6"
    widget_position: Literal["bottom-right", "bottom-left"] = "bottom-right"
    welcome_message: str | None

# Create Chatbot Request
class ChatbotCreate(BaseModel):
    \"\"\"
    WHY: Validate chatbot creation
    HOW: Used in POST /chatbots
    \"\"\"
    name: str (min_length=1, max_length=100)
    workspace_id: UUID4
        WHY: REQUIRED - determines tenant ownership
    config: ChatbotConfig
        WHY: Type is simple or chatflow
    branding: ChatbotBranding | None

# Update Chatbot Request
class ChatbotUpdate(BaseModel):
    \"\"\"
    WHY: Partial updates allowed
    HOW: All fields optional
    \"\"\"
    name: str | None
    config: ChatbotConfig | None
    branding: ChatbotBranding | None

# Chatbot Response
class ChatbotResponse(BaseModel):
    \"\"\"
    WHY: Return chatbot data
    HOW: Includes workspace/org context for display
    \"\"\"
    id: UUID4
    name: str
    workspace_id: UUID4
    workspace_name: str
        WHY: For display in UI
    organization_id: UUID4
        WHY: Helps with tenant verification
    config: ChatbotConfig
    branding: ChatbotBranding | None
    created_by: UUID4 | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# List response
class ChatbotListResponse(BaseModel):
    \"\"\"
    WHY: Paginated list of chatbots
    \"\"\"
    chatbots: list[ChatbotResponse]
    total: int
    page: int
    page_size: int

USAGE EXAMPLES:
---------------
# Create simple chatbot
POST /api/v1/chatbots
{
    "name": "FAQ Bot",
    "workspace_id": "uuid",
    "config": {
        "type": "simple",
        "model": "gpt-4",
        "knowledge_base_ids": ["uuid1", "uuid2"],
        "enable_sources": true
    }
}

# Create chatflow
POST /api/v1/chatbots
{
    "name": "Customer Support Flow",
    "workspace_id": "uuid",
    "config": {
        "type": "chatflow",
        "nodes": [{...}],
        "edges": [{...}],
        "variables": {"status": "new"}
    }
}
"""
