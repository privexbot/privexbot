"""
Seed marketplace templates.

Idempotent: each template is upserted by `slug`. Run inside the backend
container:

    docker exec privexbot-backend-dev python scripts/seed_chatflow_templates.py
"""

from __future__ import annotations

from app.db.session import SessionLocal
from app.models.chatflow_template import ChatflowTemplate


def _node(node_id: str, node_type: str, *, x: int, y: int, config: dict | None = None, label: str | None = None) -> dict:
    """Build a React-Flow-compatible node dict matching what the builder writes.

    Mirrors the canonical shape the executor expects (see
    `chatflow_executor.py` and the builder's auto-save payload):
        { id, type, position: { x, y }, data: { label, config: {...} } }
    """
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": y},
        "data": {
            "label": label or node_type.title(),
            "config": config or {},
        },
    }


def _edge(edge_id: str, source: str, target: str, *, source_handle: str | None = None) -> dict:
    edge: dict = {
        "id": edge_id,
        "source": source,
        "target": target,
    }
    if source_handle is not None:
        edge["sourceHandle"] = source_handle
    return edge


# ─── Template 1: hello-world ────────────────────────────────────────────────
HELLO_WORLD = {
    "slug": "hello-world",
    "name": "Hello World",
    "description": "Smallest possible chatflow — replies with a fixed greeting. Useful as a starter.",
    "category": "starter",
    "icon": "👋",
    "tags": ["starter", "simple"],
    "config": {
        "nodes": [
            _node("trigger_1", "trigger", x=80, y=80, label="Trigger"),
            _node(
                "response_1",
                "response",
                x=400,
                y=80,
                label="Response",
                config={
                    "message": "Hi there! 👋 I'm your new chatflow. Edit me in the builder to make me actually useful.",
                    "format": "text",
                },
            ),
        ],
        "edges": [_edge("e1", "trigger_1", "response_1")],
        "variables": [],
        "settings": {},
    },
}


# ─── Template 2: customer-support-faq ───────────────────────────────────────
CUSTOMER_SUPPORT_FAQ = {
    "slug": "customer-support-faq",
    "name": "Customer Support FAQ",
    "description": "Answer customer questions from your knowledge base. Pick a KB, attach a friendly system prompt, done.",
    "category": "support",
    "icon": "🛟",
    "tags": ["support", "kb", "faq"],
    "config": {
        "nodes": [
            _node("trigger_1", "trigger", x=60, y=120, label="Trigger"),
            _node(
                "memory_1",
                "memory",
                x=300,
                y=120,
                label="Conversation memory",
                config={
                    # Pull the last 6 turns into `{{memory_1}}` so the LLM
                    # can resolve follow-ups like "yes" / "the second one"
                    # against prior context.
                    "max_messages": 6,
                    "format": "text",
                    "include_system": False,
                },
            ),
            _node(
                "kb_1",
                "kb",
                x=560,
                y=120,
                label="KB lookup",
                config={
                    # `kb_id` left blank — user picks it in the builder.
                    "kb_id": "",
                    "query": "{{input}}",
                    "top_k": 4,
                    "search_method": "hybrid",
                    # 0.55 was overly strict and silently dropped good hybrid
                    # hits, making the template feel broken on first use.
                    # 0.4 is the conventional hybrid default — relaxed enough
                    # for typed questions to surface real chunks.
                    "threshold": 0.4,
                },
            ),
            _node(
                "llm_1",
                "llm",
                x=820,
                y=120,
                label="Answer",
                config={
                    "system_prompt": (
                        "You are a helpful customer support assistant. "
                        "Use only the provided context to answer. If the "
                        "context does not contain the answer, say you don't "
                        "know and offer to connect the user with a human. "
                        "Use the conversation history to resolve short "
                        "follow-up replies (e.g. 'yes', 'the first one')."
                    ),
                    "prompt": (
                        "Conversation so far:\n{{memory_1}}\n\n"
                        "Knowledge base context:\n{{kb_1}}\n\n"
                        "User question: {{input}}"
                    ),
                    "temperature": 0.3,
                    "max_tokens": 600,
                },
            ),
            _node(
                "response_1",
                "response",
                x=1100,
                y=120,
                label="Response",
                config={
                    "message": "{{llm_1}}",
                    "format": "markdown",
                    "include_sources": True,
                },
            ),
        ],
        "edges": [
            _edge("e1", "trigger_1", "memory_1"),
            _edge("e2", "memory_1", "kb_1"),
            _edge("e3", "kb_1", "llm_1"),
            _edge("e4", "llm_1", "response_1"),
        ],
        "variables": [],
        "settings": {},
    },
}


# ─── Template 3: lead-capture ───────────────────────────────────────────────
LEAD_CAPTURE = {
    "slug": "lead-capture",
    "name": "Lead Capture Bot",
    "description": "Collects name + email from interested visitors and stores them as a lead.",
    "category": "sales",
    "icon": "📝",
    "tags": ["sales", "leads", "capture"],
    "config": {
        "nodes": [
            _node("trigger_1", "trigger", x=60, y=120, label="Trigger"),
            _node(
                "llm_1",
                "llm",
                x=320,
                y=120,
                label="Ask for details",
                config={
                    "system_prompt": (
                        "You are a friendly sales assistant. Ask the user for "
                        "their name and email so the team can follow up. Keep "
                        "the tone warm and brief (one short sentence)."
                    ),
                    "prompt": "{{input}}",
                    "temperature": 0.6,
                    "max_tokens": 200,
                },
            ),
            _node(
                "lead_1",
                "lead_capture",
                x=620,
                y=120,
                label="Save lead",
                config={
                    "fields": {"email": "required", "name": "optional"},
                    "store_internally": True,
                    "duplicate_handling": "update",
                },
            ),
            _node(
                "response_1",
                "response",
                x=900,
                y=120,
                label="Confirmation",
                config={
                    "message": "Thanks! Someone from the team will reach out shortly. 🙏",
                    "format": "text",
                },
            ),
        ],
        "edges": [
            _edge("e1", "trigger_1", "llm_1"),
            _edge("e2", "llm_1", "lead_1"),
            _edge("e3", "lead_1", "response_1"),
        ],
        "variables": [],
        "settings": {},
    },
}


# ─── Template 4: feedback-router ────────────────────────────────────────────
FEEDBACK_ROUTER = {
    "slug": "feedback-router",
    "name": "Feedback Router",
    "description": "Classifies incoming feedback as positive or negative, then thanks or escalates accordingly.",
    "category": "support",
    "icon": "🎯",
    "tags": ["support", "classification", "branching"],
    "config": {
        "nodes": [
            _node("trigger_1", "trigger", x=60, y=180, label="Trigger"),
            _node(
                "llm_1",
                "llm",
                x=300,
                y=180,
                label="Classify",
                config={
                    "system_prompt": (
                        "Classify the user's feedback into exactly one of: "
                        "'positive', 'negative'. Reply with ONLY that single word."
                    ),
                    "prompt": "{{input}}",
                    "temperature": 0.0,
                    "max_tokens": 10,
                },
            ),
            _node(
                "cond_1",
                "condition",
                x=560,
                y=180,
                label="Positive?",
                config={
                    "operator": "contains",
                    "variable": "{{llm_1}}",
                    "value": "positive",
                },
            ),
            _node(
                "response_pos",
                "response",
                x=820,
                y=80,
                label="Thank-you",
                config={
                    "message": "We're so glad to hear that! 💚 Thank you for sharing.",
                    "format": "text",
                },
            ),
            _node(
                "response_neg",
                "response",
                x=820,
                y=300,
                label="Escalation",
                config={
                    "message": "Sorry to hear that. A team member will follow up shortly.",
                    "format": "text",
                },
            ),
        ],
        "edges": [
            _edge("e1", "trigger_1", "llm_1"),
            _edge("e2", "llm_1", "cond_1"),
            _edge("e3", "cond_1", "response_pos", source_handle="true"),
            _edge("e4", "cond_1", "response_neg", source_handle="false"),
        ],
        "variables": [],
        "settings": {},
    },
}


# ─── Template 5: calendly-booking ───────────────────────────────────────────
CALENDLY_BOOKING = {
    "slug": "calendly-booking",
    "name": "Calendly Booking",
    "description": "Helps users book a meeting through your Calendly. Requires a Calendly credential.",
    "category": "scheduling",
    "icon": "📅",
    "tags": ["scheduling", "calendly", "booking"],
    "config": {
        "nodes": [
            _node("trigger_1", "trigger", x=60, y=120, label="Trigger"),
            _node(
                "calendly_1",
                "calendly",
                x=360,
                y=120,
                label="Get booking link",
                config={
                    # `credential_id` is selected in the builder.
                    "credential_id": "",
                    "action": "get_booking_link",
                    "event_type_name": "",
                    "message_template": "Sure! You can pick a time here: {{booking_url}}",
                },
            ),
            _node(
                "response_1",
                "response",
                x=680,
                y=120,
                label="Response",
                config={
                    "message": "{{calendly_1}}",
                    "format": "markdown",
                },
            ),
        ],
        "edges": [
            _edge("e1", "trigger_1", "calendly_1"),
            _edge("e2", "calendly_1", "response_1"),
        ],
        "variables": [],
        "settings": {},
    },
}


TEMPLATES = [
    HELLO_WORLD,
    CUSTOMER_SUPPORT_FAQ,
    LEAD_CAPTURE,
    FEEDBACK_ROUTER,
    CALENDLY_BOOKING,
]


def main() -> None:
    db = SessionLocal()
    try:
        upserted = 0
        for spec in TEMPLATES:
            existing = (
                db.query(ChatflowTemplate)
                .filter(ChatflowTemplate.slug == spec["slug"])
                .first()
            )
            if existing:
                existing.name = spec["name"]
                existing.description = spec["description"]
                existing.category = spec["category"]
                existing.icon = spec["icon"]
                existing.tags = spec["tags"]
                existing.config = spec["config"]
                existing.is_public = True
                print(f"Updated template: {spec['slug']}")
            else:
                row = ChatflowTemplate(
                    name=spec["name"],
                    slug=spec["slug"],
                    description=spec["description"],
                    category=spec["category"],
                    icon=spec["icon"],
                    tags=spec["tags"],
                    config=spec["config"],
                    is_public=True,
                    use_count=0,
                )
                db.add(row)
                print(f"Created template: {spec['slug']}")
            upserted += 1
        db.commit()
        print(f"\nDone. {upserted} template(s) upserted.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
