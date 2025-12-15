"""
Chatbot model - AI chatbot resource within a workspace.

WHY:
- Core product: The actual chatbot users create
- Must be isolated by workspace (and therefore by organization)
- Stores configuration and settings for each bot

HOW:
- Lives within a workspace (required workspace_id)
- Accessed through proper tenant hierarchy
- Config stored as flexible JSON for different bot types

PSEUDOCODE:
-----------
class Chatbot(Base):
    __tablename__ = "chatbots"

    # Fields
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this chatbot

    name: str (chatbot name, required)
        WHY: Display name for the chatbot
        EXAMPLE: "Customer Support Bot", "FAQ Assistant"

    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: CRITICAL FOR TENANCY - Links bot to workspace
        HOW:
            - REQUIRED, cannot be null
            - Indexed for fast queries
            - When workspace deleted, bots are deleted
            - ALL queries must verify through workspace -> org chain

        SECURITY: This field enforces tenant isolation
        EXAMPLE: Chatbot A (workspace_id=X) cannot be accessed by user in workspace Y

    config: JSONB (chatbot configuration)
        WHY: Flexible storage for different chatbot types and settings
        HOW: Store as JSON for schema flexibility

        EXAMPLE STRUCTURE:
        {
            "model": "gpt-4",
            "temperature": 0.7,
            "system_prompt": "You are a helpful assistant...",
            "memory": {
                "enabled": true,
                "max_messages": 10
            },

            # Knowledge Base Integration (Context-Aware Design)
            "knowledge_bases": [
                {
                    "kb_id": "uuid",
                    "enabled": true,
                    "override_retrieval": {
                        "top_k": 3,  # Override KB default
                        "search_method": "hybrid",
                        "similarity_threshold": 0.75
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

            "integrations": {
                "slack": {"channel": "#support"},
                "discord": {"webhook": "https://..."}
            },
            "branding": {
                "avatar": "url",
                "color": "#hex"
            }
        }

        WHY KB in config instead of association table:
            - More flexible (bot-specific retrieval overrides)
            - Can disable KB without deleting link
            - Easier to manage in UI
            - Enables per-bot customization of retrieval

    created_by: UUID (foreign key -> users.id, nullable)
        WHY: Track who created this chatbot for audit trail
        HOW: Set to current user's ID on creation

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Relationships
    workspace: Workspace (many-to-one back reference)
        WHY: Access workspace and parent org through this
        HOW: chatbot.workspace.organization.name

    creator: User (many-to-one)
        WHY: Reference to creator for audit/display

TENANT ISOLATION PATTERN:
--------------------------
WHY: Prevent unauthorized access across organizations
HOW: EVERY query must join through tenant hierarchy

CORRECT QUERY PATTERN:
    def get_chatbot(chatbot_id: UUID, current_user):
        chatbot = db.query(Chatbot)
            .join(Workspace)  # Join through workspace
            .join(Organization)  # Join through organization
            .filter(
                Chatbot.id == chatbot_id,
                Organization.id == current_user.org_id  # CRITICAL CHECK
            )
            .first()

        if not chatbot:
            raise HTTPException(404, "Chatbot not found")
        return chatbot

WRONG PATTERN (SECURITY ISSUE):
    # BAD - No tenant check!
    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
    # This allows accessing any chatbot by ID across all organizations!

ACCESS CONTROL FLOW:
--------------------
User wants to edit chatbot:
    1. Get chatbot with tenant-safe query (joins to org)
    2. Verify org_id matches user's current org from JWT
    3. Check workspace permissions:
        - Is user org admin/owner? -> ALLOW
        - Is user workspace admin/editor? -> ALLOW
        - Else -> DENY
"""
