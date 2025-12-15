"""
Lead model - Captured user information from chatbot/chatflow interactions.

WHY:
- Optional feature for builders to capture leads (email, name, location)
- Track end-user engagement and geographical distribution
- Enable lead generation from bot interactions

HOW:
- Lives within workspace (through bot relationship)
- Stores user-provided info + auto-captured metadata
- Minimal design - just essential lead data

PSEUDOCODE:
-----------
class Lead(Base):
    __tablename__ = "leads"

    # Fields
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this lead

    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: CRITICAL FOR TENANCY - Direct link to workspace
        HOW: When workspace deleted, leads are deleted
        SECURITY: Enforces tenant isolation

    bot_id: UUID (required, indexed)
        WHY: Which bot/chatflow captured this lead
        NOTE: Not a foreign key - can be chatbot OR chatflow ID

    bot_type: str (required)
        WHY: Distinguish between "chatbot" and "chatflow"
        VALUES: "chatbot" | "chatflow"
        EXAMPLE: bot_type="chatbot", bot_id=<chatbot_uuid>

    session_id: str (optional, indexed)
        WHY: Link lead to specific chat session
        HOW: Reference to ChatSession.session_id
        USE CASE: View conversation that led to lead capture

    # User-provided information
    email: str (required, indexed)
        WHY: Primary contact method
        HOW: Captured from widget form or chat interaction
        VALIDATION: Email format validation

    name: str (optional)
        WHY: User's name for personalization
        EXAMPLE: "John Doe"

    phone: str (optional)
        WHY: Additional contact method
        EXAMPLE: "+1234567890"

    custom_fields: JSONB (optional)
        WHY: Flexible storage for additional lead data
        EXAMPLE:
        {
            "company": "Acme Inc",
            "role": "Product Manager",
            "interest": "Enterprise Plan",
            "source": "landing_page"
        }

    # Auto-captured metadata
    ip_address: str (optional)
        WHY: Capture IP for geolocation
        HOW: From request headers
        PRIVACY: Consider GDPR compliance

    country: str (optional, indexed)
        WHY: Geographical distribution tracking
        HOW: Resolved from IP using GeoIP service
        EXAMPLE: "United States"

    country_code: str (optional, indexed)
        WHY: ISO country code for filtering/grouping
        EXAMPLE: "US"

    region: str (optional)
        WHY: State/province level location
        EXAMPLE: "California"

    city: str (optional)
        WHY: City level location
        EXAMPLE: "San Francisco"

    timezone: str (optional)
        WHY: User's timezone for follow-up scheduling
        EXAMPLE: "America/Los_Angeles"

    # Engagement metadata
    channel: str (optional, indexed)
        WHY: Where lead was captured
        VALUES: "website" | "discord" | "telegram" | "whatsapp" | "api"
        DEFAULT: "website"

    referrer: str (optional)
        WHY: Where user came from
        EXAMPLE: "https://google.com/search?q=..."

    user_agent: str (optional)
        WHY: Device/browser information
        EXAMPLE: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."

    language: str (optional)
        WHY: User's preferred language
        HOW: From Accept-Language header
        EXAMPLE: "en-US"

    # Lead status
    status: str (default: "new", indexed)
        WHY: Track lead lifecycle
        VALUES: "new" | "contacted" | "qualified" | "converted" | "unqualified"
        DEFAULT: "new"

    notes: text (optional)
        WHY: Internal notes about this lead
        EXAMPLE: "Follow up on enterprise pricing"

    # Timestamps
    captured_at: datetime (auto-set on creation)
        WHY: When lead was captured
        HOW: Set to current UTC time

    updated_at: datetime (auto-update on modification)
        WHY: Last modification time

    # Relationships
    workspace: Workspace (many-to-one back reference)
        WHY: Access workspace and parent org through this

    # No direct FK to Chatbot/Chatflow
    # WHY: Lead can outlive the bot that captured it
    # HOW: Use bot_id + bot_type for lookups when needed

TENANT ISOLATION PATTERN:
--------------------------
WHY: Prevent unauthorized access across organizations
HOW: EVERY query must join through tenant hierarchy

CORRECT QUERY PATTERN:
    def get_leads(workspace_id: UUID, current_user):
        leads = db.query(Lead)
            .join(Workspace)
            .join(Organization)
            .filter(
                Lead.workspace_id == workspace_id,
                Organization.id == current_user.org_id  # CRITICAL CHECK
            )
            .all()

        return leads

LEAD CAPTURE FLOW:
------------------
1. Builder enables lead capture in chatbot/chatflow config:
    {
        "lead_capture": {
            "enabled": true,
            "timing": "before_chat",  # or "during_chat", "after_chat"
            "required_fields": ["email"],
            "optional_fields": ["name", "phone"],
            "custom_fields": [
                {"name": "company", "type": "text", "required": false}
            ]
        }
    }

2. Widget detects lead capture enabled:
    - Shows form before/during/after chat based on timing
    - Collects required + optional fields
    - Sends to backend: POST /v1/bots/{bot_id}/leads

3. Backend processes lead:
    - Validates email format
    - Resolves geolocation from IP address
    - Stores in database
    - Returns success/error to widget

4. Builder views leads:
    - Dashboard: GET /workspaces/{workspace_id}/leads
    - Filter by bot, date, country, status
    - Export to CSV
    - View geographical distribution map

GEOLOCATION RESOLUTION:
-----------------------
WHY: Capture geographical distribution of end users
HOW: Use IP geolocation service (MaxMind GeoIP2, IP2Location, etc.)

PSEUDOCODE:
    def capture_lead(lead_data: dict, request: Request):
        # Get IP address
        ip_address = request.headers.get("X-Forwarded-For") or request.client.host

        # Resolve geolocation
        geo_data = geoip_service.lookup(ip_address)

        # Create lead
        lead = Lead(
            email=lead_data["email"],
            name=lead_data.get("name"),
            ip_address=ip_address,
            country=geo_data.get("country"),
            country_code=geo_data.get("country_code"),
            region=geo_data.get("region"),
            city=geo_data.get("city"),
            timezone=geo_data.get("timezone"),
            channel="website",
            captured_at=datetime.utcnow()
        )

        db.add(lead)
        db.commit()

EXAMPLE USE CASES:
------------------
1. Website Widget Lead Capture:
    - User visits website with embedded chatbot
    - Before chat starts, form asks for email + name
    - User enters info and starts chatting
    - Lead stored with IP-based geolocation

2. Discord Bot Lead Capture:
    - User interacts with Discord bot
    - Bot asks: "Want updates? Share your email!"
    - User provides email in chat
    - Lead stored with channel="discord"

3. Lead Analytics Dashboard:
    - Builder views leads by country (map visualization)
    - Filter leads captured last 30 days
    - Export to CSV for CRM import
    - See which bot captured most leads

PRIVACY CONSIDERATIONS:
-----------------------
- GDPR compliance: Inform users about data collection
- Allow users to opt-out
- Provide data deletion endpoint
- Encrypt sensitive fields (consider email encryption)
- IP address storage may require consent in some regions

INDEXES:
--------
WHY: Optimize common queries
CREATE INDEX idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX idx_leads_bot_id ON leads(bot_id);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_country_code ON leads(country_code);
CREATE INDEX idx_leads_captured_at ON leads(captured_at);
CREATE INDEX idx_leads_channel ON leads(channel);
"""
