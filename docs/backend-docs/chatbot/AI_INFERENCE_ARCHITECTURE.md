# AI Inference Architecture - PrivexBot

## Executive Summary

This document provides a comprehensive analysis of PrivexBot's AI inference architecture, including the multi-provider system, RAG (Retrieval Augmented Generation) implementation, message processing pipeline, and best practices for reliability, security, and performance.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Multi-Provider Inference System](#multi-provider-inference-system)
3. [Message Processing Pipeline](#message-processing-pipeline)
4. [RAG/Knowledge Base Retrieval](#ragknowledge-base-retrieval)
5. [Session and Memory Management](#session-and-memory-management)
6. [Configuration Reference](#configuration-reference)
7. [Grounding Modes](#grounding-modes)
8. [Security Considerations](#security-considerations)
9. [Best Practices](#best-practices)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PrivexBot AI Inference                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Message                                                                │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Validate  │───▶│   Session   │───▶│     KB      │───▶│   Context   │  │
│  │    Input    │    │    Load     │    │  Retrieval  │    │   Building  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                   │          │
│                                                                   ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     INFERENCE SERVICE                                │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  Secret AI (DEFAULT)  →  Gemini  →  OpenAI  →  DeepSeek  →  Ollama │ │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                   │          │
│                                                                   ▼          │
│                                                            ┌─────────────┐  │
│                                                            │  Response   │  │
│                                                            └─────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File Location | Purpose |
|-----------|---------------|---------|
| InferenceService | `services/inference_service.py` | Multi-provider AI abstraction |
| ChatbotService | `services/chatbot_service.py` | Message processing and orchestration |
| RetrievalService | `services/retrieval_service.py` | RAG search and context retrieval |
| SessionService | `services/session_service.py` | Chat history and session management |
| EmbeddingService | `services/embedding_service_v2.py` | Vector embedding generation |
| QdrantService | `services/qdrant_service.py` | Vector store operations |

---

## Multi-Provider Inference System

### Provider Hierarchy

**Location**: `backend/src/app/services/inference_service.py`

Secret AI is the **DEFAULT** provider (configured at line 782). The fallback chain activates on provider failures:

```
Secret AI (Primary/Default)
    │
    ├── NetworkError → Fallback
    ├── AuthError → Fallback
    └── RateLimitError → NO FALLBACK (fail immediately)
    │
    ▼
Gemini
    │
    ▼
OpenAI
    │
    ▼
DeepSeek
    │
    ▼
Ollama (Local)
```

### Provider Configuration

```python
# Default provider settings
DEFAULT_PROVIDER = "secret_ai"
DEFAULT_MODEL = "DeepSeek-R1-Distill-Llama-70B"

# Default generation parameters
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 2000
DEFAULT_TOP_P = 1.0
DEFAULT_FREQUENCY_PENALTY = 0.0
DEFAULT_PRESENCE_PENALTY = 0.0
```

### Message Format

All providers use OpenAI-compatible message format:

```python
messages = [
    {"role": "system", "content": "System instructions..."},
    {"role": "user", "content": "User question..."},
    {"role": "assistant", "content": "Previous response..."},
    {"role": "user", "content": "Current question..."}
]
```

### Error Handling

| Error Type | Behavior | Example |
|------------|----------|---------|
| `NetworkError` | Fallback to next provider | Connection timeout, DNS failure |
| `AuthError` | Fallback to next provider | Invalid API key |
| `RateLimitError` | **No fallback** - return error | 429 Too Many Requests |
| `ValidationError` | Return error | Invalid parameters |

---

## Message Processing Pipeline

### Pipeline Stages

**Location**: `backend/src/app/services/chatbot_service.py`

```
1. INPUT VALIDATION
   └── Sanitize user message
   └── Check message length
   └── Detect potential jailbreak attempts

2. SESSION MANAGEMENT
   └── Load/create session
   └── Retrieve chat history
   └── Apply token budget for memory

3. KNOWLEDGE BASE RETRIEVAL
   └── Generate query embedding
   └── Search vector store (Qdrant)
   └── Rank and filter results
   └── Apply annotation boosting

4. CONTEXT BUILDING
   └── Select grounding mode (STRICT/GUIDED/FLEXIBLE)
   └── Build system prompt with context
   └── Include greeting/behavior rules
   └── Apply variables substitution

5. LLM INFERENCE
   └── Select provider (Secret AI default)
   └── Send structured messages
   └── Handle streaming/non-streaming
   └── Apply fallback on failure

6. RESPONSE PROCESSING
   └── Save to session history
   └── Update metrics
   └── Return response to user
```

### Context Building

The system prompt is built dynamically based on:

1. **Base system prompt** (user-configured)
2. **Grounding instructions** (based on mode)
3. **Retrieved KB context** (RAG results)
4. **Behavior rules** (restrictions, greeting)
5. **Variable substitutions** (custom variables)

```python
# Context template structure
context_template = """
{base_system_prompt}

{grounding_instructions}

CONTEXT FROM KNOWLEDGE BASE:
{kb_context}

{behavior_rules}
"""
```

---

## RAG/Knowledge Base Retrieval

### Search Strategies

**Location**: `backend/src/app/services/retrieval_service.py`

| Strategy | Description | Weight | Best For |
|----------|-------------|--------|----------|
| `vector` | Pure semantic similarity | 100% vector | General questions, conceptual queries |
| `keyword` | BM25 keyword matching | 100% keyword | Technical terms, codes, exact phrases |
| `hybrid_search` | Combined approach | 70% vector, 30% keyword | **DEFAULT - Most balanced** |
| `mmr` | Maximum Marginal Relevance | Diversity-focused | Avoiding redundant results |
| `threshold` | Score-filtered | Min score cutoff | High precision requirements |

### Default Configuration

```python
# RAG Defaults
DEFAULT_STRATEGY = "hybrid_search"
DEFAULT_TOP_K = 5
DEFAULT_SCORE_THRESHOLD = 0.7
DEFAULT_RERANK_ENABLED = False

# Hybrid weights
VECTOR_WEIGHT = 0.7
KEYWORD_WEIGHT = 0.3
```

### Configuration Priority Chain

```
Caller Override (API request)
         │
         ▼
KB-Level Config (per knowledge base)
         │
         ▼
Service Defaults (code constants)
```

### Annotation Boosting

Human-verified content receives score multipliers:

| Annotation Type | Boost Multiplier |
|-----------------|------------------|
| `verified` | 1.2x |
| `important` | 1.4x |
| `critical` | 1.8x |
| `outdated` | 0.5x (penalty) |

---

## Session and Memory Management

### Session Storage

**Location**: `backend/src/app/services/session_service.py`

- **Storage**: Redis with 24-hour TTL
- **Key Pattern**: `session:{session_id}`
- **Default History**: Last 10 messages

### Token Budget Management

The system prevents context overflow by:

1. Calculating tokens for system prompt
2. Calculating tokens for current message
3. Adding history messages newest-first until budget exhausted

```python
MAX_CONTEXT_TOKENS = 4000  # Reserve space for response

def get_messages_within_budget(session_id, system_prompt, current_message):
    available = MAX_CONTEXT_TOKENS - count_tokens(system_prompt) - count_tokens(current_message)

    messages = []
    for msg in get_history_newest_first(session_id):
        if available - count_tokens(msg) < 0:
            break
        messages.insert(0, msg)
        available -= count_tokens(msg)

    return messages
```

---

## Configuration Reference

### AI Configuration (`ai_config`)

```python
ai_config = {
    "provider": "secret_ai",  # secret_ai, openai, gemini, deepseek, ollama
    "model": "DeepSeek-R1-Distill-Llama-70B",
    "temperature": 0.7,       # 0.0 = deterministic, 1.0 = creative
    "max_tokens": 2000,       # Maximum response length
    "top_p": 1.0,             # Nucleus sampling
    "frequency_penalty": 0.0, # Reduce repetition
    "presence_penalty": 0.0   # Encourage new topics
}
```

### Prompt Configuration (`prompt_config`)

```python
prompt_config = {
    "system_prompt": "You are a helpful AI assistant...",
    "greeting_message": "Hello! How can I help you today?",
    "fallback_message": "I'm sorry, I don't have information about that.",
    "grounding_mode": "strict",  # strict, guided, flexible
}
```

### KB Configuration (`kb_config`)

```python
kb_config = {
    "knowledge_base_ids": ["kb-uuid-1", "kb-uuid-2"],
    "retrieval_config": {
        "strategy": "hybrid_search",
        "top_k": 5,
        "score_threshold": 0.7,
        "rerank_enabled": False
    }
}
```

### Behavior Configuration (`behavior_config`)

```python
behavior_config = {
    "restrictions": [
        "Never discuss competitors",
        "Avoid providing medical advice"
    ],
    "allowed_topics": ["product support", "pricing", "features"],
    "tone": "professional",
    "language": "en"
}
```

---

## Grounding Modes

### STRICT Mode (Recommended for KB-only responses)

The AI will **ONLY** answer using information from the knowledge base. If the answer is not found, it will explicitly state this.

```python
STRICT_PROMPT = """You are an AI assistant that ONLY answers using the provided context.

CRITICAL RULES:
1. If the answer is NOT in the context, respond: "I don't have information about that in my knowledge base."
2. NEVER use information from your training data
3. ALWAYS cite which part of the context you're using
4. If partially covered, answer only what's in context and state what's missing

Context:
{context}"""
```

**Use Case**: Customer support bots, documentation bots, compliance-critical applications.

### GUIDED Mode

The AI prioritizes KB context but may supplement with general knowledge when necessary, always disclosing when it does.

```python
GUIDED_PROMPT = """You are an AI assistant that prioritizes the provided context.

RULES:
1. Always check context first for answers
2. If context is insufficient, you may supplement with general knowledge but MUST disclose this
3. Prefer context over general knowledge when there's conflict

Context:
{context}"""
```

**Use Case**: General assistants, educational bots.

### FLEXIBLE Mode

The AI uses KB context to enhance responses but can freely use general knowledge.

```python
FLEXIBLE_PROMPT = """You are an AI assistant with access to a knowledge base.

RULES:
1. Use the provided context to enhance your responses
2. You may use general knowledge when context is insufficient
3. Prioritize accuracy over completeness

Context:
{context}"""
```

**Use Case**: Creative assistants, brainstorming bots.

---

## Security Considerations

### Input Sanitization

```python
def sanitize_user_input(message: str) -> str:
    """Remove potential injection attempts and enforce limits."""
    MAX_INPUT_LENGTH = 4000

    # Remove excessive whitespace
    message = " ".join(message.split())

    # Truncate if too long
    if len(message) > MAX_INPUT_LENGTH:
        message = message[:MAX_INPUT_LENGTH] + "..."

    return message
```

### Jailbreak Detection

Common patterns to detect and block:

```python
JAILBREAK_PATTERNS = [
    r"ignore.*instructions",
    r"pretend.*you.*are",
    r"act.*as.*if",
    r"disregard.*previous",
    r"forget.*everything",
    r"you.*are.*now",
    r"new.*persona",
    r"roleplay.*as",
]

def detect_jailbreak(message: str) -> bool:
    message_lower = message.lower()
    return any(re.search(pattern, message_lower) for pattern in JAILBREAK_PATTERNS)
```

### Rate Limiting

Recommended limits:

| Scope | Limit | Window |
|-------|-------|--------|
| Per IP | 30 requests | 1 minute |
| Per Session | 100 requests | 1 hour |
| Per Organization | 1000 requests | 1 hour |

---

## Best Practices

### 1. Always Use STRICT Mode for KB-Dependent Bots

If your bot should ONLY answer from the knowledge base, always use STRICT grounding mode. This prevents hallucination and ensures accurate responses.

### 2. Optimize RAG Configuration

```python
# Recommended for most use cases
retrieval_config = {
    "strategy": "hybrid_search",  # Best balance of semantic + keyword
    "top_k": 5,                   # Not too few, not too many
    "score_threshold": 0.7,       # Filter low-quality matches
    "rerank_enabled": True        # If using a reranker model
}
```

### 3. Monitor Token Usage

- Track token usage per request
- Set alerts for high-token sessions
- Implement token budgets per organization

### 4. Implement Proper Error Handling

```python
# User-friendly error messages
USER_FRIENDLY_ERRORS = {
    "no_context_found": "I couldn't find relevant information for your question.",
    "rate_limited": "Please wait a moment before sending another message.",
    "service_unavailable": "I'm having trouble connecting. Please try again.",
}
```

### 5. Use Secret AI as Default

Secret AI provides:
- Privacy-focused inference in TEEs
- No data retention
- Compliance-friendly architecture

---

## Troubleshooting Guide

### Issue: AI Answering Outside KB

**Symptoms**: Bot provides answers not found in knowledge base.

**Solutions**:
1. Enable STRICT grounding mode
2. Strengthen system prompt with explicit restrictions
3. Lower score threshold to get more KB results
4. Add jailbreak detection

### Issue: Poor Search Results

**Symptoms**: Relevant KB content not being retrieved.

**Solutions**:
1. Check embedding model matches between indexing and search
2. Try `hybrid_search` strategy instead of pure vector
3. Lower score threshold (e.g., 0.5 instead of 0.7)
4. Verify content is properly chunked

### Issue: Context Window Overflow

**Symptoms**: Errors about token limits, truncated responses.

**Solutions**:
1. Implement token-aware memory management
2. Reduce `top_k` for fewer KB results
3. Summarize long context before sending to LLM
4. Limit chat history length

### Issue: High Latency

**Symptoms**: Slow response times.

**Solutions**:
1. Check provider status (Secret AI, fallbacks)
2. Optimize vector search (add indices)
3. Cache embeddings for common queries
4. Use streaming responses

### Issue: Provider Fallback Loop

**Symptoms**: All providers failing.

**Solutions**:
1. Check API keys for all providers
2. Verify network connectivity
3. Check rate limits across providers
4. Ensure Ollama is running if used as fallback

---

## Appendix: File References

| Purpose | File |
|---------|------|
| Multi-provider inference | `services/inference_service.py` |
| Message processing | `services/chatbot_service.py` |
| RAG retrieval | `services/retrieval_service.py` |
| Session management | `services/session_service.py` |
| Vector embeddings | `services/embedding_service_v2.py` |
| Qdrant operations | `services/qdrant_service.py` |
| Chatbot API routes | `api/v1/routes/chatbot.py` |
| Public chat API | `api/v1/routes/public.py` |
| Draft management | `services/draft_service.py` |

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: Claude Code Assistant*
