# PrivexBot RAG Retrieval Pipeline

## Overview

RAG (Retrieval-Augmented Generation) is the core technology that enables PrivexBot chatbots to answer questions using custom knowledge bases. When a user sends a message, the system retrieves relevant content from attached knowledge bases and uses it to ground the AI's response.

## Complete RAG Flow

```
USER MESSAGE (Widget/API)
    ↓
[1] RECEIVE & AUTHENTICATE
    ↓
[2] GET/CREATE SESSION
    ↓
[3] RETRIEVE CONTEXT (RAG) ← Knowledge Bases
    ↓
[4] BUILD PROMPT (with context)
    ↓
[5] CALL AI (Secret AI/Akash ML)
    ↓
[6] SAVE & RETURN RESPONSE
```

## Step-by-Step Implementation

### Step 1: Receive Message

```python
# Public API Endpoint
POST /api/v1/public/bots/{bot_id}/chat

# Request
{
    "message": "How do I reset my password?",
    "session_id": "optional_session_id",
    "variables": {"user_name": "John"}
}
```

### Step 2: Session Management

```python
session = session_service.get_or_create_session(
    bot_type="chatbot",
    bot_id=chatbot.id,
    session_id=session_id or f"web_{uuid4().hex[:16]}",
    workspace_id=chatbot.workspace_id
)

# Save user message
user_msg = session_service.save_message(
    session_id=session.id,
    role="user",
    content=user_message
)
```

### Step 3: Context Retrieval (Core RAG)

```python
async def _retrieve_context(chatbot, query):
    all_sources = []
    context_parts = []

    # Iterate through attached knowledge bases
    for kb_config in chatbot.kb_config.get("knowledge_bases", []):
        if not kb_config.get("enabled"):
            continue

        kb_id = kb_config["kb_id"]

        # Apply configuration priority
        override = kb_config.get("retrieval_override", {})
        top_k = override.get("top_k")
        threshold = override.get("score_threshold")
        strategy = override.get("strategy")

        # Search KB
        results = await retrieval_service.search(
            kb_id=kb_id,
            query=query,
            top_k=top_k,           # None = use KB config
            search_method=strategy,
            threshold=threshold
        )

        all_sources.extend(results)
        for result in results:
            context_parts.append(result["content"])

    # Combine context from all KBs
    context = "\n\n".join(context_parts)

    return {
        "context": context,
        "sources": all_sources
    }
```

### Step 4: Build Prompt with Context

```python
def _build_messages(chatbot, user_message, context, history):
    messages = []
    system_parts = []

    # Base system prompt
    system_parts.append(chatbot.prompt_config.get("system_prompt", ""))

    # Persona settings
    persona = chatbot.prompt_config.get("persona", {})
    if persona.get("name"):
        system_parts.append(f"Your name is {persona['name']}.")
    if persona.get("tone"):
        system_parts.append(f"Use a {persona['tone']} tone.")

    # Instructions
    for instruction in chatbot.prompt_config.get("instructions", []):
        if instruction.get("enabled"):
            system_parts.append(f"- {instruction['text']}")

    # KB CONTEXT INJECTION (Core RAG)
    if context:
        grounding_mode = chatbot.kb_config.get("grounding_mode", "strict")

        if grounding_mode == "strict":
            system_parts.append(f"""
KNOWLEDGE BASE CONTEXT:
Use ONLY the following information to answer. If the answer is not in this context, say "I don't have information about that in my knowledge base."

{context}
""")
        elif grounding_mode == "guided":
            system_parts.append(f"""
KNOWLEDGE BASE CONTEXT (PREFERRED):
Prefer using the following information. If you must use other knowledge, clearly disclose this.

{context}
""")
        # flexible mode: no restriction

    # Build message array
    messages.append({
        "role": "system",
        "content": "\n\n".join(system_parts)
    })

    # Add conversation history
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    # Add current message
    messages.append({"role": "user", "content": user_message})

    return messages
```

### Step 5: AI Inference

```python
ai_response = await inference_service.generate_chat(
    messages=messages,
    model=chatbot.ai_config.get("model", "secret-ai-v1"),
    temperature=chatbot.ai_config.get("temperature", 0.7),
    max_tokens=chatbot.ai_config.get("max_tokens", 2000)
)

response_text = ai_response["text"]
tokens_used = ai_response["usage"]
```

### Step 6: Save & Return

```python
# Save assistant message
assistant_msg = session_service.save_message(
    session_id=session.id,
    role="assistant",
    content=response_text,
    response_metadata={
        "sources": sources,
        "model": chatbot.ai_config.get("model"),
        "tokens_used": tokens_used
    }
)

return {
    "response": response_text,
    "sources": sources,  # For citations
    "session_id": str(session.id),
    "message_id": str(assistant_msg.id)
}
```

## Retrieval Strategies

### 1. Vector Search (Semantic)

Pure embedding similarity search.

```python
# Generate query embedding
query_embedding = await embedding_service.generate_embedding(query)

# Search Qdrant
results = await qdrant_service.search(
    kb_id=kb_id,
    query_embedding=query_embedding,
    top_k=5,
    score_threshold=0.7
)
```

### 2. Keyword Search

Full-text search using PostgreSQL or Qdrant text matching.

```python
# PostgreSQL full-text search
chunks = db.query(Chunk).filter(
    func.to_tsvector('english', Chunk.content).match(query)
).limit(top_k).all()
```

### 3. Hybrid Search (Default)

Combines vector and keyword search with weighted fusion.

```python
# Get vector results (70% weight)
vector_results = await _vector_search(query_embedding, top_k, threshold * 0.8)

# Get keyword results (30% weight)
keyword_results = await _keyword_search(query, top_k)

# Combine with weighted scores
for result in vector_results:
    combined[result.id]["score"] = result.score * 0.7

for result in keyword_results:
    if result.id in combined:
        combined[result.id]["score"] += result.score * 0.3
    else:
        combined[result.id]["score"] = result.score * 0.3
```

### 4. MMR (Maximum Marginal Relevance)

Balances relevance with diversity to avoid redundant results.

```python
# MMR Formula: λ * sim(doc, query) - (1-λ) * max(sim(doc, selected))
# λ = 0.7: 70% relevance, 30% diversity

while len(selected) < top_k:
    best_mmr_score = float('-inf')
    for candidate in remaining:
        relevance = candidate.score
        max_sim_to_selected = max(cosine_sim(candidate, s) for s in selected)
        mmr_score = (0.7 * relevance) - (0.3 * max_sim_to_selected)
        if mmr_score > best_mmr_score:
            best = candidate
    selected.append(best)
```

### 5. Threshold Search

Only returns results above strict quality threshold.

```python
results = [r for r in results if r.score >= threshold]
```

## Configuration Priority

Configuration is resolved in priority order:

```
1. Caller Override (API call) → Highest Priority
   └── Explicit parameters in chatbot's KB override

2. KB-Level Config
   └── KB's context_settings.retrieval_config

3. Service Defaults → Lowest Priority
   └── top_k=5, threshold=0.5, strategy="hybrid"
```

Example:
```python
# Chatbot KB config
kb_config = {
    "knowledge_bases": [{
        "kb_id": "uuid",
        "retrieval_override": {
            "top_k": 10,  # Overrides KB default of 5
            "strategy": "semantic_search"
        }
    }]
}
```

## Grounding Modes

Control how strictly AI uses KB content:

### 1. Strict Mode (Recommended)

```
Only answer from KB content.
If not found: "I don't have information about that."
```

Use when: Accuracy is critical, prevent hallucination

### 2. Guided Mode

```
Prefer KB content.
If using general knowledge: Disclose this clearly.
```

Use when: Want flexibility with transparency

### 3. Flexible Mode

```
Use KB to enhance responses.
Free to use general knowledge.
```

Use when: KB supplements rather than restricts

## Annotation Boosting

Chunks with user annotations get score boosts:

```python
def _apply_annotation_boost(results):
    for result in results:
        if result.annotations:
            result.score *= 1.2  # Base boost

            importance = result.annotations.get("importance")
            if importance == "high":
                result.score *= 1.25
            elif importance == "critical":
                result.score *= 1.5

            result.boosted = True
    return results
```

## Source Attribution

Retrieved chunks are returned as sources for citations:

```python
sources = [
    {
        "chunk_id": "uuid",
        "document_id": "uuid",
        "document_title": "Password Reset Guide.pdf",
        "document_url": "https://docs.example.com/password",
        "content": "To reset your password, go to Settings...",
        "score": 0.95,
        "page": 12,
        "annotations": {...},
        "boosted": true
    }
]
```

When `show_citations` is enabled, the AI is instructed to cite sources:
```
[1] Password Reset Guide.pdf - Page 12
```

## Search Result Structure

```python
{
    "chunk_id": "uuid",
    "document_id": "uuid",
    "document_title": "FAQ.pdf",
    "document_url": "https://example.com/faq",
    "content": "Chunk text content...",
    "score": 0.85,           # Similarity score (0-1)
    "page": 5,               # Page number if available
    "annotations": {...},    # User annotations
    "boosted": True          # If annotation boost applied
}
```

## Multi-KB Retrieval

When chatbot has multiple KBs attached:

```python
# Iterate through all attached KBs
for kb_config in chatbot.kb_config.get("knowledge_bases", []):
    if kb_config.get("enabled"):
        results = await retrieval_service.search(kb_id=kb_config["kb_id"], ...)
        all_sources.extend(results)

# Combine context from all KBs
context = "\n\n".join([r["content"] for r in all_sources])
```

### Merge Strategies

- **Priority**: Sort by KB priority, then by score
- **Score**: Sort all results by score regardless of source

## Performance Optimization

### 1. Embedding Caching
Query embeddings cached for repeated queries.

### 2. Batch Retrieval
Multiple KB queries can be parallelized.

### 3. Result Deduplication
Content hash used to deduplicate similar chunks.

### 4. Score Thresholding
Low-scoring results filtered before context building.

## Error Handling

```python
try:
    results = await retrieval_service.search(...)
except Exception as e:
    print(f"Error retrieving from KB {kb_id}: {e}")
    continue  # Skip failed KB, try others
```

KB failures don't crash the entire request - other KBs still queried.

## Summary

PrivexBot's RAG pipeline:

1. **Retrieves** relevant chunks from attached knowledge bases
2. **Applies** configuration priority (caller > KB > defaults)
3. **Supports** 5 search strategies (vector, keyword, hybrid, MMR, threshold)
4. **Boosts** annotated chunks for better relevance
5. **Injects** context into system prompt with grounding mode
6. **Returns** sources for citation display
7. **Handles** multi-KB scenarios with merge strategies
