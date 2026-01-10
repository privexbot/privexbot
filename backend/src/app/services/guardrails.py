"""
Guardrails Service for AI Inference

WHY: Ensures AI responses are grounded in knowledge base content
HOW: Provides grounding modes (STRICT/GUIDED/FLEXIBLE) with enforced prompts
"""

from enum import Enum
from typing import Optional
import re


class GroundingMode(str, Enum):
    """
    Grounding modes control how strictly the AI adheres to KB content.

    STRICT: AI ONLY answers from KB, refuses if not found
    GUIDED: AI prefers KB but can supplement with disclosure
    FLEXIBLE: AI uses KB to enhance but can use general knowledge
    """
    STRICT = "strict"
    GUIDED = "guided"
    FLEXIBLE = "flexible"


# Grounding prompt templates for each mode
GROUNDING_PROMPTS = {
    GroundingMode.STRICT: """[STRICT KNOWLEDGE BASE MODE]

CONTEXT FROM KNOWLEDGE BASE:
{context}

═══════════════════════════════════════════════════════════════
IMPORTANT - TRUST THE RETRIEVAL SYSTEM:
═══════════════════════════════════════════════════════════════
If you see CONTEXT above, it means our retrieval system already found this content
relevant to the user's question using semantic search. The user might use abbreviations,
partial words, or different phrasing - but the retrieval already matched it.

TRUST THE CONTEXT. If context exists, USE IT to answer the question.

═══════════════════════════════════════════════════════════════
MANDATORY RULE:
═══════════════════════════════════════════════════════════════

For ANY question asking about a topic, concept, fact, or subject:
1. If CONTEXT exists above → Answer using ONLY the CONTEXT (it IS relevant)
2. If CONTEXT is empty/none → Respond: "I don’t have that information in my current context, but if you can provide more details or rephrase the question, I’ll try to help."

WHAT IS A TOPIC QUESTION (must check CONTEXT):
- "What is X?" → Check CONTEXT for X
- "How does Y work?" → Check CONTEXT for Y
- "Tell me about Z" → Check CONTEXT for Z
- "Explain W" → Check CONTEXT for W

WHAT IS CONVERSATION (respond naturally):
- "hi", "hello", "thanks", "bye" → Greet/acknowledge
- "ok", "got it", "I see" → Acknowledge
- "hmm", "interesting" → Acknowledge

CRITICAL - DO NOT DO THIS:
- User asks about X, X not in CONTEXT → You answer from training data ✗
- User asks about Y, CONTEXT has Z → You answer about Y from training data ✗
- Provide "general knowledge" when CONTEXT is silent ✗
- Suggest topics NOT in the CONTEXT (like "try asking about X") ✗

ABOUT SUGGESTING TOPICS:
- You MAY suggest topics that ARE in the CONTEXT above
- You must NEVER suggest topics from your training data

EXAMPLE:
User: "What is document structure?"
→ Search CONTEXT for "document structure"
→ Not found in CONTEXT
→ Response: "I don't have information about that in my knowledge base."
""",

    GroundingMode.GUIDED: """You are an AI assistant that prioritizes information from the provided context.

RULES:
1. Always check the context first for answers
2. If the context is insufficient, you may supplement with general knowledge but you MUST clearly disclose this by saying "Based on general knowledge..." or similar
3. When context and general knowledge conflict, ALWAYS prefer the context
4. Clearly distinguish between information from context vs. general knowledge

CONTEXT FROM KNOWLEDGE BASE:
{context}

Remember: Context is your primary source. Disclose when using general knowledge.""",

    GroundingMode.FLEXIBLE: """You are an AI assistant with access to a knowledge base to help answer questions.

GUIDELINES:
1. Use the provided context to enhance and ground your responses
2. You may use general knowledge when the context is insufficient
3. Prioritize accuracy and helpfulness
4. When the context provides relevant information, prefer it over general knowledge

CONTEXT FROM KNOWLEDGE BASE:
{context}"""
}


# Jailbreak detection patterns
JAILBREAK_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"pretend\s+(you\s+)?(are|to\s+be)",
    r"act\s+as\s+if",
    r"disregard\s+(your\s+)?(previous|all)",
    r"forget\s+(everything|all|your)",
    r"you\s+are\s+now",
    r"new\s+(persona|identity|character)",
    r"roleplay\s+as",
    r"from\s+now\s+on\s+(you|pretend)",
    r"override\s+(your\s+)?(instructions|rules)",
    r"bypass\s+(your\s+)?(restrictions|rules|limits)",
    r"developer\s+mode",
    r"jailbreak",
    r"dan\s+mode",
    r"do\s+anything\s+now",
]


class GuardrailsService:
    """Service for applying AI guardrails and grounding."""

    MAX_INPUT_LENGTH = 4000

    def __init__(self):
        self._jailbreak_patterns = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in JAILBREAK_PATTERNS
        ]

    def get_grounding_prompt(
        self,
        mode: GroundingMode,
        context: str,
        custom_prompt: Optional[str] = None
    ) -> str:
        """
        Build the grounding prompt based on mode and context.

        Args:
            mode: The grounding mode to use
            context: The KB context to include
            custom_prompt: Optional custom system prompt to prepend

        Returns:
            Complete grounding prompt with context
        """
        grounding = GROUNDING_PROMPTS.get(mode, GROUNDING_PROMPTS[GroundingMode.STRICT])
        grounding_with_context = grounding.format(context=context or "No relevant context found.")

        if custom_prompt:
            return f"{custom_prompt}\n\n{grounding_with_context}"

        return grounding_with_context

    def sanitize_input(self, message: str) -> str:
        """
        Sanitize user input to prevent injection and enforce limits.

        Args:
            message: Raw user input

        Returns:
            Sanitized message
        """
        if not message:
            return ""

        # Remove excessive whitespace (but preserve single spaces)
        message = " ".join(message.split())

        # Truncate if too long
        if len(message) > self.MAX_INPUT_LENGTH:
            message = message[:self.MAX_INPUT_LENGTH]

        return message

    def detect_jailbreak(self, message: str) -> bool:
        """
        Detect potential jailbreak attempts in user message.

        Args:
            message: User message to check

        Returns:
            True if jailbreak pattern detected
        """
        if not message:
            return False

        message_lower = message.lower()

        for pattern in self._jailbreak_patterns:
            if pattern.search(message_lower):
                return True

        return False

    def get_jailbreak_response(self) -> str:
        """Get the standard response for jailbreak attempts."""
        return "I'm designed to be helpful, harmless, and honest. I can't pretend to be something I'm not or bypass my guidelines. How can I actually help you today?"

    def validate_input(self, message: str) -> tuple[bool, Optional[str], str]:
        """
        Validate and sanitize user input.

        Args:
            message: Raw user input

        Returns:
            Tuple of (is_valid, error_message, sanitized_message)
        """
        # Sanitize first
        sanitized = self.sanitize_input(message)

        if not sanitized:
            return False, "Message cannot be empty", ""

        # Check for jailbreak
        if self.detect_jailbreak(sanitized):
            return False, self.get_jailbreak_response(), sanitized

        return True, None, sanitized


# Singleton instance
_guardrails_service: Optional[GuardrailsService] = None


def get_guardrails_service() -> GuardrailsService:
    """Get or create the guardrails service singleton."""
    global _guardrails_service
    if _guardrails_service is None:
        _guardrails_service = GuardrailsService()
    return _guardrails_service
