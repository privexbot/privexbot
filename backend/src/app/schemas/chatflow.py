"""
Pydantic schemas for Chatflow API requests and responses.

WHY:
- Validate chatflow creation/update data
- Support advanced drag-and-drop workflow configuration
- Separate from simple chatbot schemas

IMPORTANT:
- Chatflows are DIFFERENT from chatbots
- Chatflow: Advanced visual workflow builder with ReactFlow
- Chatbot: Simple form-based configuration

PSEUDOCODE:
-----------
from pydantic import BaseModel, UUID4
from datetime import datetime

# ReactFlow Node schema
class ChatflowNode(BaseModel):
    \"\"\"
    WHY: Represent a single node in the workflow
    HOW: Matches ReactFlow node structure
    \"\"\"
    id: str
        WHY: Unique node identifier within the flow

    type: str
        WHY: Node type determines behavior
        TYPES: 'llm', 'condition', 'api_call', 'memory', 'start', 'end', 'variable_set', 'loop'

    data: dict
        WHY: Node-specific configuration
        EXAMPLE for 'llm': {"model": "gpt-4", "temperature": 0.7, "prompt": "..."}
        EXAMPLE for 'condition': {"condition": "variable > 10", "true": "node2", "false": "node3"}
        EXAMPLE for 'api_call': {"url": "...", "method": "POST", "headers": {...}}

    position: dict
        WHY: Visual position in ReactFlow canvas
        STRUCTURE: {"x": 100, "y": 200}

# ReactFlow Edge schema
class ChatflowEdge(BaseModel):
    \"\"\"
    WHY: Represent connections between nodes
    HOW: Defines workflow execution path
    \"\"\"
    id: str
        WHY: Unique edge identifier

    source: str
        WHY: Source node ID

    target: str
        WHY: Target node ID

    condition: str | None
        WHY: Conditional edge (for branching)
        EXAMPLE: "true", "false", "error"

# Chatflow Configuration
class ChatflowConfig(BaseModel):
    \"\"\"
    WHY: Complete chatflow workflow configuration
    HOW: Stores all nodes, edges, variables, and settings
    \"\"\"
    nodes: list[ChatflowNode]
        WHY: All workflow nodes
        EXAMPLE: [LLM node, condition node, API call node, etc.]

    edges: list[ChatflowEdge]
        WHY: All connections between nodes
        EXAMPLE: Flow from start -> LLM -> condition -> end

    variables: dict[str, any] = {}
        WHY: Workflow-level variables
        EXAMPLE: {"user_name": "", "ticket_id": "", "priority": "normal"}

    settings: dict | None = {}
        WHY: Global workflow settings
        EXAMPLE: {
            "enable_logging": true,
            "max_iterations": 10,
            "timeout_seconds": 30
        }

# Create Chatflow Request
class ChatflowCreate(BaseModel):
    \"\"\"
    WHY: Validate chatflow creation
    HOW: Used in POST /chatflows
    \"\"\"
    name: str (min_length=1, max_length=100)
        WHY: Chatflow display name

    workspace_id: UUID4
        WHY: REQUIRED - determines tenant ownership
        SECURITY: Must verify user has access to this workspace

    config: ChatflowConfig
        WHY: Complete workflow definition

    version: int = 1
        WHY: Initial version number

    is_active: bool = True
        WHY: Deploy immediately or save as draft

# Update Chatflow Request
class ChatflowUpdate(BaseModel):
    \"\"\"
    WHY: Partial updates allowed
    HOW: All fields optional
    \"\"\"
    name: str | None
    config: ChatflowConfig | None
    version: int | None
        WHY: Increment when making breaking changes
    is_active: bool | None

# Chatflow Response
class ChatflowResponse(BaseModel):
    \"\"\"
    WHY: Return chatflow data
    HOW: Includes workspace/org context
    \"\"\"
    id: UUID4
    name: str
    workspace_id: UUID4
    workspace_name: str
    organization_id: UUID4
    config: ChatflowConfig
    version: int
    is_active: bool
    created_by: UUID4 | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Chatflow List Response
class ChatflowListResponse(BaseModel):
    \"\"\"
    WHY: Paginated list of chatflows
    \"\"\"
    chatflows: list[ChatflowResponse]
    total: int
    page: int
    page_size: int

# Chatflow Summary (lightweight)
class ChatflowSummary(BaseModel):
    \"\"\"
    WHY: Quick overview for lists/dropdowns
    \"\"\"
    id: UUID4
    name: str
    workspace_id: UUID4
    version: int
    is_active: bool
    node_count: int
        WHY: Show complexity (number of nodes in workflow)

NODE TYPE REFERENCE:
--------------------
'start': Entry point of workflow
'end': Exit point of workflow
'llm': AI model interaction (GPT-4, Claude, etc.)
'condition': Branching logic (if/else)
'api_call': External API integration
'memory': Conversation memory management
'variable_set': Set/update workflow variables
'loop': Iterate over data
'human_input': Wait for human intervention
'webhook': Trigger external webhooks

USAGE EXAMPLES:
---------------
# Create chatflow
POST /api/v1/chatflows
{
    "name": "Customer Support Workflow",
    "workspace_id": "uuid",
    "config": {
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "data": {},
                "position": {"x": 0, "y": 0}
            },
            {
                "id": "llm1",
                "type": "llm",
                "data": {
                    "model": "gpt-4",
                    "temperature": 0.7,
                    "prompt": "You are a customer support assistant..."
                },
                "position": {"x": 200, "y": 0}
            },
            {
                "id": "condition1",
                "type": "condition",
                "data": {
                    "condition": "intent == 'urgent'",
                    "true": "escalate",
                    "false": "respond"
                },
                "position": {"x": 400, "y": 0}
            }
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "llm1"},
            {"id": "e2", "source": "llm1", "target": "condition1"}
        ],
        "variables": {
            "intent": "",
            "user_id": "",
            "ticket_id": ""
        }
    }
}

CHATFLOW vs CHATBOT COMPARISON:
--------------------------------
Feature          | Chatbot Schema              | Chatflow Schema
-----------------|-----------------------------|--------------------------
Config Type      | SimpleChatbotConfig         | ChatflowConfig
Structure        | Flat settings               | Nodes + Edges
Complexity       | Simple (few fields)         | Complex (workflow graph)
UI Builder       | Form inputs                 | ReactFlow canvas
Validation       | Basic field validation      | Graph validation (cycles, etc.)
API Endpoints    | /chatbots                   | /chatflows
Model/Table      | chatbots                    | chatflows

WHY SEPARATE SCHEMAS:
- Different validation rules
- Different structure (flat vs graph)
- Different API endpoints
- Cleaner code organization
- Type safety for both formats
"""
