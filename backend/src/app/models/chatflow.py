"""
Chatflow model - Advanced drag-and-drop workflow chatbot within a workspace.

WHY:
- Separate from simple chatbots - different complexity and capabilities
- Workflow-based with ReactFlow nodes and edges
- Requires different UI builder (drag-and-drop vs forms)
- May need different permissions/access control

HOW:
- Lives within a workspace (required workspace_id)
- Stores ReactFlow node/edge data in config
- Supports variables, conditionals, loops, and advanced memory

DIFFERENCE FROM CHATBOT:
- Chatbot: Simple form-based configuration (FAQ, knowledge base)
- Chatflow: Visual workflow builder with nodes for LLM, API calls, conditions, etc.

PSEUDOCODE:
-----------
class Chatflow(Base):
    __tablename__ = "chatflows"

    # Fields
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this chatflow

    name: str (chatflow name, required)
        WHY: Display name for the workflow
        EXAMPLE: "Customer Support Flow", "Lead Qualification Workflow"

    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: CRITICAL FOR TENANCY - Links chatflow to workspace
        HOW:
            - REQUIRED, cannot be null
            - Indexed for fast queries
            - When workspace deleted, chatflows are deleted
            - ALL queries must verify through workspace -> org chain

        SECURITY: This field enforces tenant isolation
        EXAMPLE: Chatflow A (workspace_id=X) cannot be accessed by user in workspace Y

    config: JSONB (chatflow workflow configuration)
        WHY: Store ReactFlow nodes, edges, and workflow settings
        HOW: Store as JSON for flexible schema

        EXAMPLE STRUCTURE:
        {
            "nodes": [
                {
                    "id": "1",
                    "type": "llm",  # AI model node
                    "data": {
                        "model": "gpt-4",
                        "temperature": 0.7,
                        "prompt": "You are a helpful assistant..."
                    },
                    "position": {"x": 100, "y": 100}
                },
                {
                    "id": "2",
                    "type": "condition",  # Conditional branching
                    "data": {
                        "condition": "user_input contains 'urgent'",
                        "true_path": "escalate",
                        "false_path": "standard_response"
                    },
                    "position": {"x": 300, "y": 100}
                },
                {
                    "id": "3",
                    "type": "api_call",  # External API integration
                    "data": {
                        "url": "https://api.example.com/endpoint",
                        "method": "POST",
                        "headers": {"Authorization": "Bearer {token}"}
                    },
                    "position": {"x": 500, "y": 100}
                },
                {
                    "id": "4",
                    "type": "memory",  # Conversation memory
                    "data": {
                        "type": "buffer",
                        "max_messages": 10
                    },
                    "position": {"x": 100, "y": 300}
                }
            ],
            "edges": [
                {"id": "e1-2", "source": "1", "target": "2"},
                {"id": "e2-3", "source": "2", "target": "3", "condition": "true"},
                {"id": "e2-4", "source": "2", "target": "4", "condition": "false"}
            ],
            "variables": {
                "user_name": "",
                "ticket_id": "",
                "priority": "normal"
            },

            # Knowledge Base Integration (Context-Aware Design)
            "knowledge_bases": [
                {
                    "kb_id": "uuid",
                    "enabled": true,
                    "override_retrieval": {
                        "top_k": 5,  # Override KB default
                        "search_method": "semantic",
                        "similarity_threshold": 0.7
                    }
                }
            ],

            # Lead Capture Configuration (Optional)
            "lead_capture": {
                "enabled": false,  # Default: disabled
                "timing": "before_chat",  # "before_chat" | "during_chat" | "after_chat"
                "required_fields": ["email"],  # Always require email
                "optional_fields": ["name", "phone"],  # User can optionally provide
                "custom_fields": [  # Additional custom fields
                    {
                        "name": "company",
                        "label": "Company Name",
                        "type": "text",
                        "required": false
                    }
                ],
                "privacy_notice": "We'll use this to improve your experience.",
                "auto_capture_location": true  # IP-based geolocation
            },

            "settings": {
                "enable_logging": true,
                "max_iterations": 10,  # Prevent infinite loops
                "timeout_seconds": 30
            }
        }

        WHY KB in config instead of association table:
            - Same reason as chatbot - flexibility and per-workflow customization
            - Workflow can use different retrieval strategies than chatbot
            - Can enable/disable KB per workflow stage
            - Easier to manage KB access in visual workflow builder

    version: int (default: 1)
        WHY: Track workflow versions for updates
        HOW: Increment when workflow structure changes
        USE CASE: Rollback to previous working version

    is_active: bool (default: True)
        WHY: Deploy/undeploy without deleting
        HOW: Toggle to disable chatflow

    created_by: UUID (foreign key -> users.id, nullable)
        WHY: Track who created this chatflow for audit trail
        HOW: Set to current user's ID on creation

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Relationships
    workspace: Workspace (many-to-one back reference)
        WHY: Access workspace and parent org through this
        HOW: chatflow.workspace.organization.name

    creator: User (many-to-one)
        WHY: Reference to creator for audit/display

TENANT ISOLATION PATTERN:
--------------------------
WHY: Prevent unauthorized access across organizations
HOW: EVERY query must join through tenant hierarchy

CORRECT QUERY PATTERN:
    def get_chatflow(chatflow_id: UUID, current_user):
        chatflow = db.query(Chatflow)
            .join(Workspace)  # Join through workspace
            .join(Organization)  # Join through organization
            .filter(
                Chatflow.id == chatflow_id,
                Organization.id == current_user.org_id  # CRITICAL CHECK
            )
            .first()

        if not chatflow:
            raise HTTPException(404, "Chatflow not found")
        return chatflow

WRONG PATTERN (SECURITY ISSUE):
    # BAD - No tenant check!
    chatflow = db.query(Chatflow).filter(Chatflow.id == chatflow_id).first()
    # This allows accessing any chatflow by ID across all organizations!

ACCESS CONTROL FLOW:
--------------------
User wants to edit chatflow:
    1. Get chatflow with tenant-safe query (joins to org)
    2. Verify org_id matches user's current org from JWT
    3. Check workspace permissions:
        - Is user org admin/owner? -> ALLOW
        - Is user workspace admin/editor? -> ALLOW
        - Else -> DENY

CHATFLOW vs CHATBOT COMPARISON:
--------------------------------
Feature             | Chatbot (Simple)        | Chatflow (Advanced)
--------------------|-------------------------|---------------------------
Creation Method     | Form-based              | Drag-and-drop visual
Complexity          | Simple, linear          | Complex, branching
Configuration       | Basic settings          | ReactFlow nodes/edges
Use Cases           | FAQ, knowledge base     | Multi-step workflows
Logic Support       | No                      | Conditionals, loops
API Integration     | No                      | Yes (API call nodes)
Memory              | Basic (last N messages) | Advanced (entity, summary)
Target Users        | Non-technical           | Power users/developers
Model              | Separate table/model     | Separate table/model

WHY SEPARATE MODELS:
- Different UI builders (form vs ReactFlow)
- Different query patterns (chatbots vs chatflows)
- Different permission requirements potentially
- Cleaner code separation
- Easier to scale features independently

EXAMPLE USE CASES:
------------------
Chatbot (Simple):
    - "Help Desk FAQ Bot"
    - "Product Documentation Bot"
    - "Simple Q&A Assistant"

Chatflow (Advanced):
    - "Multi-step Customer Support Workflow"
    - "Lead Qualification with CRM Integration"
    - "Automated Order Processing with Conditional Logic"
    - "Complex Decision Trees with External API Calls"
"""
