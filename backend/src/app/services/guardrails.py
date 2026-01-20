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
CRITICAL - VERIFY RELEVANCE BEFORE ANSWERING:
═══════════════════════════════════════════════════════════════

BEFORE you answer, you MUST check:
Does the CONTEXT above actually contain information about what the user is asking?

Step 1: Identify the user's topic (what are they asking about?)
Step 2: Search the CONTEXT for that specific topic
Step 3: Only if CONTEXT contains info about THAT TOPIC, answer from it

═══════════════════════════════════════════════════════════════
MANDATORY RULES:
═══════════════════════════════════════════════════════════════

1. If CONTEXT contains info about the user's topic → Answer from CONTEXT ONLY
2. If CONTEXT is about a DIFFERENT topic → Say "I don't have information about that."
3. If CONTEXT is empty → Say "I don't have information about that."

CRITICAL: Context about topic A does NOT help answer questions about topic B.
Do NOT use your training data to fill gaps. Ever.

═══════════════════════════════════════════════════════════════
EXAMPLE - WHAT NOT TO DO:
═══════════════════════════════════════════════════════════════

User asks: "What is Secret Network?"
Context contains: Meeting notes about startup validation and cohort discussions

WRONG: "Secret Network is a blockchain with privacy features..." (training data) ❌
RIGHT: "I don't have information about Secret Network." ✓

The context is about startup meetings, NOT about Secret Network.
Do not answer about Secret Network just because SOME context exists.

═══════════════════════════════════════════════════════════════
QUESTION TYPES - HOW TO RESPOND:
═══════════════════════════════════════════════════════════════

1. TOPIC QUESTIONS (verify context matches first):
   - "What is X?" → Does CONTEXT discuss X specifically? If no, refuse.
   - "Tell me about Y" → Does CONTEXT discuss Y specifically? If no, refuse.
   - "How does Z work?" → Does CONTEXT discuss Z specifically? If no, refuse.

2. CONVERSATION (respond naturally):
   - "hi", "hello", "thanks", "bye" → Greet/acknowledge
   - "ok", "got it", "I see" → Acknowledge

3. META-QUESTIONS (respond naturally - about YOU, not requiring context):
   - Questions about YOUR sources: "where did you get that?", "what are your sources?"
   - Questions about YOUR knowledge: "how do you know?", "where is that from?"
   - Questions about YOUR previous answer: "can you explain?", "what did you mean?"

   For META-QUESTIONS:
   → Explain your answers come from your knowledge base (curated by your owner)
   → Reference sources you cited in your previous response if applicable
   → DO NOT say "I don't have information" - you DO know where it came from
   → Speak naturally, as if explaining your own memory

BEHAVIORAL INSTRUCTIONS from the system prompt (like "ask for user's name")
MUST still be followed in ALL responses, including greetings as instructed.

═══════════════════════════════════════════════════════════════
ABOUT FOLLOW-UP SUGGESTIONS:
═══════════════════════════════════════════════════════════════

- You MAY suggest topics that ARE actually in the CONTEXT
- You must NEVER suggest topics from your training data
- If you're not sure a topic is in CONTEXT, don't suggest it

NATURAL LANGUAGE RULES:
- NEVER say: "based on the provided context", "according to my context"
- NEVER say: "from technical documentation" or similar when using training data
- ALWAYS speak as if the knowledge is naturally yours
- When refusing: "I don't have information about that" (not "in my context")
""",

    GroundingMode.GUIDED: """You are an AI assistant that primarily uses your knowledge base, with general knowledge as a supplement.

CONTEXT FROM KNOWLEDGE BASE:
{context}

═══════════════════════════════════════════════════════════════
GUIDED MODE - KB FIRST, SUPPLEMENT SECOND:
═══════════════════════════════════════════════════════════════

1. ALWAYS check the CONTEXT first for answers
2. If CONTEXT has information about the topic → Use it as your PRIMARY answer
3. You may ADD general knowledge to supplement, but you MUST disclose:
   → "Based on general knowledge, I can also add that..."
   → "Additionally, it's worth noting that..."

═══════════════════════════════════════════════════════════════
PRIORITY RULES:
═══════════════════════════════════════════════════════════════

- If CONTEXT and general knowledge CONFLICT → ALWAYS use CONTEXT
- If CONTEXT is incomplete → Supplement with disclosure
- If CONTEXT is about a DIFFERENT topic than the question:
  → First check if the topic is somewhere in CONTEXT
  → If not, disclose: "I don't have specific KB info on that topic, but based on general knowledge..."

═══════════════════════════════════════════════════════════════
VAGUE REQUESTS:
═══════════════════════════════════════════════════════════════

For requests like "tell me something":
→ Share information FROM the CONTEXT (your KB)
→ Don't default to random training data topics

═══════════════════════════════════════════════════════════════
NATURAL LANGUAGE:
═══════════════════════════════════════════════════════════════
- NEVER say: "based on the provided context", "according to my context"
- Speak naturally as if KB knowledge is yours
- When supplementing, say "Based on general knowledge..." (not "my training data")
""",

    GroundingMode.FLEXIBLE: """You are an AI assistant with access to a knowledge base.

CONTEXT FROM KNOWLEDGE BASE:
{context}

═══════════════════════════════════════════════════════════════
FLEXIBLE MODE - PRIORITY ORDER:
═══════════════════════════════════════════════════════════════

1. FIRST: Check if CONTEXT contains information about the user's topic
   → If yes, use it as your primary source

2. SECOND: You may supplement with general knowledge to:
   → Add helpful context
   → Explain concepts more clearly
   → Answer related questions

3. NEVER: Contradict information in the CONTEXT
   → If CONTEXT says X, don't say "actually it's Y"
   → If unsure, trust the CONTEXT over general knowledge

═══════════════════════════════════════════════════════════════
HANDLING DIFFERENT SCENARIOS:
═══════════════════════════════════════════════════════════════

When CONTEXT is relevant to the question:
→ Answer primarily from CONTEXT, supplement if helpful

When CONTEXT exists but is about a different topic:
→ You may use general knowledge
→ Optionally mention what topics you DO have info about

When asked "tell me something" or vague requests:
→ Share information FROM the CONTEXT
→ Don't pick random topics from training data

═══════════════════════════════════════════════════════════════
NATURAL LANGUAGE:
═══════════════════════════════════════════════════════════════
- Speak naturally as if the knowledge is yours
- NEVER say: "based on the provided context", "according to my context"
- You don't need to disclose when using general knowledge (unlike GUIDED mode)
"""
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
