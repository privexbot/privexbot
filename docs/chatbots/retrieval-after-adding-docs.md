Chatbot KB Retrieval Architecture Analysis                                                                          
                                                                                                                     
 Question                                                                                                            
                                                                                                                     
 How do chatbots retrieve context from knowledge bases when users send messages? Does re-chunking happen when new    
 documents are added?                                                                                                
                                                                                                                     
 ---                                                                                                                 
 Answer Summary                                                                                                      
                                                                                                                     
 1. YES - Chatbots CAN Retrieve Context from KBs                                                                     
                                                                                                                     
 The retrieval flow is fully implemented and works as follows:                                                       
                                                                                                                     
 User Message → Public API → Chatbot Service → KB Retrieval → Vector Search → AI with Context                        
                                                                                                                     
 2. NO Re-Chunking of Existing Documents                                                                             
                                                                                                                     
 When you add a new document to an existing KB:                                                                      
 - Only the NEW document is processed (chunked, embedded, indexed)                                                   
 - Existing chunks remain untouched in the vector store                                                              
 - Incremental UPSERT - new chunks are added without rebuilding the collection                                       
                                                                                                                     
 3. New Documents Available Immediately After Pipeline Completes                                                     
                                                                                                                     
 Once KB status changes to ready:                                                                                    
 - All chunks (including new ones) are queryable via Qdrant                                                          
 - Chatbot retrieval automatically includes new document chunks                                                      
 - No manual refresh or re-linking required                                                                          
                                                                                                                     
 ---                                                                                                                 
 Detailed Architecture                                                                                               
                                                                                                                     
 Message Flow (When User Sends Message)                                                                              
                                                                                                                     
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ 1. USER SENDS MESSAGE                                           │                                                 
 │    POST /public/bots/{bot_id}/chat                              │                                                 
 │    { "message": "What is your product?" }                       │                                                 
 └────────────────────────┬────────────────────────────────────────┘                                                 
                          ▼                                                                                          
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ 2. CHATBOT SERVICE (chatbot_service.py:76-250)                  │                                                 
 │    • Get/create chat session                                    │                                                 
 │    • Save user message                                          │                                                 
 │    • RETRIEVE KB CONTEXT (step 3)                               │                                                 
 │    • Get chat history                                           │                                                 
 │    • Build prompt with context                                  │                                                 
 │    • Call AI inference                                          │                                                 
 │    • Return response + sources                                  │                                                 
 └────────────────────────┬────────────────────────────────────────┘                                                 
                          ▼                                                                                          
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ 3. KB RETRIEVAL (chatbot_service.py:454-532)                    │                                                 
 │    For each KB in chatbot.kb_config.knowledge_bases:            │                                                 
 │      • Check if KB enabled                                      │                                                 
 │      • Get per-KB retrieval settings                            │                                                 
 │      • Call retrieval_service.search()                          │                                                 
 │      • Collect results + sources                                │                                                 
 └────────────────────────┬────────────────────────────────────────┘                                                 
                          ▼                                                                                          
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ 4. VECTOR SEARCH (retrieval_service.py:319-481)                 │                                                 
 │    • Generate query embedding                                   │                                                 
 │    • Search Qdrant collection for KB                            │                                                 
 │    • Apply search strategy (hybrid/semantic/keyword/mmr)        │                                                 
 │    • Filter by threshold, return top_k results                  │                                                 
 │    • Return chunks with content + metadata for citations        │                                                 
 └─────────────────────────────────────────────────────────────────┘                                                 
                                                                                                                     
 New Document Processing (When Added to Existing KB)                                                                 
                                                                                                                     
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ PHASE 1: DRAFT (Redis Only)                                     │                                                 
 │ • New source added to Redis draft                               │                                                 
 │ • File parsed with Tika (if file upload)                        │                                                 
 │ • Preview pages created for approval                            │                                                 
 │ • NO database writes yet                                        │                                                 
 └────────────────────────┬────────────────────────────────────────┘                                                 
                          ▼                                                                                          
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ PHASE 2: FINALIZATION                                           │                                                 
 │ • Create Document record in PostgreSQL                          │                                                 
 │ • Queue Celery task: process_web_kb_task()                      │                                                 
 │ • Return pipeline_id for progress monitoring                    │                                                 
 │ • KB status = "processing"                                      │                                                 
 └────────────────────────┬────────────────────────────────────────┘                                                 
                          ▼                                                                                          
 ┌─────────────────────────────────────────────────────────────────┐                                                 
 │ PHASE 3: BACKGROUND PROCESSING (Celery)                         │                                                 
 │ For NEW document ONLY:                                          │                                                 
 │   1. Parse content → markdown                                   │                                                 
 │   2. Chunk content (based on strategy)                          │                                                 
 │   3. Generate embeddings (sentence-transformers)                │                                                 
 │   4. UPSERT to Qdrant (ADD new vectors, don't rebuild)          │                                                 
 │   5. Update Document record with chunk_count                    │                                                 
 │                                                                 │                                                 
 │ EXISTING DOCUMENTS: NOT touched, NOT re-chunked                 │                                                 
 │                                                                 │                                                 
 │ KB status → "ready" when complete                               │                                                 
 └─────────────────────────────────────────────────────────────────┘                                                 
                                                                                                                     
 Key Code Locations                                                                                                  
 ┌───────────────────────┬─────────────────────────────────────┬───────────┐                                         
 │       Component       │                File                 │   Lines   │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Chatbot → KB linkage  │ models/chatbot.py                   │ 141-163   │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Message processing    │ services/chatbot_service.py         │ 76-250    │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ KB context retrieval  │ services/chatbot_service.py         │ 454-532   │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Vector search         │ services/retrieval_service.py       │ 319-481   │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Config priority chain │ services/retrieval_service.py       │ 240-317   │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Chunking strategies   │ services/chunking_service.py        │ 94-500+   │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Embedding generation  │ services/embedding_service_local.py │ 1-500+    │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Background pipeline   │ tasks/kb_pipeline_tasks.py          │ 246-2100+ │                                         
 ├───────────────────────┼─────────────────────────────────────┼───────────┤                                         
 │ Qdrant upsert         │ services/qdrant_service.py          │ 208-270   │                                         
 └───────────────────────┴─────────────────────────────────────┴───────────┘                                         
 Configuration Priority (3-Level System)                                                                             
                                                                                                                     
 LEVEL 1 (Highest): Chatbot Override                                                                                 
   └─ chatbot.kb_config.knowledge_bases[i].retrieval_override                                                        
   └─ Example: { "top_k": 10, "strategy": "semantic_search" }                                                        
                                                                                                                     
 LEVEL 2 (Middle): KB-Level Config                                                                                   
   └─ kb.context_settings.retrieval_config                                                                           
   └─ Example: { "top_k": 5, "strategy": "hybrid_search" }                                                           
                                                                                                                     
 LEVEL 3 (Lowest): Service Defaults                                                                                  
   └─ retrieval_service.py SERVICE_DEFAULTS                                                                          
   └─ { "top_k": 5, "search_method": "hybrid", "threshold": 0.5 }                                                    
                                                                                                                     
 Search Methods Supported                                                                                            
 ┌────────────────────────────┬────────────────────────────────────────┐                                             
 │          Strategy          │              Description               │                                             
 ├────────────────────────────┼────────────────────────────────────────┤                                             
 │ hybrid_search              │ Vector (70%) + Keyword (30%) - Default │                                             
 ├────────────────────────────┼────────────────────────────────────────┤                                             
 │ semantic_search            │ Vector-only similarity                 │                                             
 ├────────────────────────────┼────────────────────────────────────────┤                                             
 │ keyword_search             │ Full-text search only                  │                                             
 ├────────────────────────────┼────────────────────────────────────────┤                                             
 │ mmr                        │ Diversity-aware (avoid similar chunks) │                                             
 ├────────────────────────────┼────────────────────────────────────────┤                                             
 │ similarity_score_threshold │ Strict quality filtering               │                                             
 └────────────────────────────┴────────────────────────────────────────┘                                             
 ---                                                                                                                 
 Consistency Verification                                                                                            
                                                                                                                     
 What's Consistent:                                                                                                  
                                                                                                                     
 1. Chatbot-KB linkage - via kb_config.knowledge_bases[] JSONB                                                       
 2. Retrieval flow - always goes through retrieval_service.search()                                                  
 3. Vector store - Qdrant collection per KB (kb_{uuid})                                                              
 4. Incremental updates - new docs added without rebuilding                                                          
                                                                                                                     
 Potential Issues to Watch:                                                                                          
                                                                                                                     
 1. KB status - Chatbots should only query KBs with status="ready"                                                   
 2. Chunk count display - Frontend fixed to use API's total_chunks                                                   
 3. Embedding model - Must be consistent across KB lifecycle                                                         
                                                                                                                     
 ---                                

 -----------
 -----------


  The plan is now updated with a general solution for Issue 3 that works for ANY instruction, not just name-asking:  
                                                                                                                     
  1. Inject conversation summary immediately before instructions in the system prompt                                
  2. LLM sees context and instructions together - naturally skips completed actions                                  
  3. No pattern matching needed - works for "ask for name", "collect email", "recommend product", etc.               
                                                                                                                     
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Ready to code?                                                                                                      
                                                                                                                     
 Here is Claude's plan:                                                                                              
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Chatbot Quality Issues - Deep Root Cause Analysis & Fixes                                                           
                                                                                                                     
 Executive Summary                                                                                                   
                                                                                                                     
 After deep research, the issues are NOT just prompt engineering - there are three distinct system-level bugs:       
 Issue: Vector search returns 0                                                                                      
 Root Cause: Embedding dimension mismatch                                                                            
 Previous Diagnosis: ❌ Not identified                                                                               
 ────────────────────────────────────────                                                                            
 Issue: Irrelevant KB content                                                                                        
 Root Cause: PostgreSQL FTS syntax bug + no threshold for hybrid                                                     
 Previous Diagnosis: ❌ Misdiagnosed as "just KB content"                                                            
 ────────────────────────────────────────                                                                            
 Issue: Repeated name asking                                                                                         
 Root Cause: LLM system prompt priority (instructions > history)                                                     
 Previous Diagnosis: ⚠️ Partially identified                                                                         
 ---                                                                                                                 
 Issue 1: Vector Search Always Returns 0 Results                                                                     
                                                                                                                     
 Evidence from Logs                                                                                                  
                                                                                                                     
 [QdrantService] Search returned 0 results from kb_caddd1e3_5ba9_44e7_9007_6f6daeac8483                              
 [RetrievalService] Vector search: Qdrant returned 0, after content filter: 0                                        
 [RetrievalService] Hybrid search: vector=0, keyword=3, combined=3                                                   
                                                                                                                     
 Root Cause                                                                                                          
                                                                                                                     
 Embedding dimension mismatch - Silent failure when query embedding dimensions don't match collection dimensions.    
                                                                                                                     
 Flow:                                                                                                               
 1. KB indexed with model X (e.g., 768 dimensions)                                                                   
 2. kb.embedding_config is NULL or doesn't have dimensions saved                                                     
 3. Query defaults to all-MiniLM-L6-v2 (384 dimensions)                                                              
 4. Qdrant receives 384-dim query against 768-dim collection                                                         
 5. Qdrant returns 0 results silently (no error, just empty)                                                         
                                                                                                                     
 Code Location                                                                                                       
                                                                                                                     
 - retrieval_service.py:155-194 - Validates but only WARNS, doesn't prevent                                          
 - retrieval_service.py:397-408 - Gets embedding model from KB config                                                
                                                                                                                     
 Fix                                                                                                                 
                                                                                                                     
 File: retrieval_service.py:187-192                                                                                  
                                                                                                                     
 # BEFORE (warns but continues):                                                                                     
 if kb_dimensions and kb_dimensions != query_dimensions:                                                             
     print(f"[RetrievalService] 🚨 DIMENSION MISMATCH ERROR...")                                                     
     # Don't raise - let search fail naturally                                                                       
                                                                                                                     
 # AFTER (raise error to make it obvious):                                                                           
 if kb_dimensions and kb_dimensions != query_dimensions:                                                             
     print(f"[RetrievalService] 🚨 DIMENSION MISMATCH ERROR for KB {kb.id}:")                                        
     print(f"  → KB indexed dimensions: {kb_dimensions}")                                                            
     print(f"  → Query model dimensions: {query_dimensions}")                                                        
     raise ValueError(f"Embedding dimension mismatch: KB expects {kb_dimensions}, query has {query_dimensions}.      
 Reindex KB or fix embedding config.")                                                                               
                                                                                                                     
 Also add diagnostic endpoint to check KB embedding config vs actual collection dimensions.                          
                                                                                                                     
 ---                                                                                                                 
 Issue 2: Keyword Search Returns Irrelevant Content                                                                  
                                                                                                                     
 Evidence from Logs                                                                                                  
                                                                                                                     
 User: "tell me about what you know" (Secret Network chatbot)                                                        
 Result: "_Founder School Wednesday's Meeting Transcript" about business automation                                  
                                                                                                                     
 Root Cause: CASCADE OF 3 BUGS                                                                                       
                                                                                                                     
 Bug 2a: PostgreSQL FTS Syntax Error                                                                                 
                                                                                                                     
 File: retrieval_service.py:603                                                                                      
                                                                                                                     
 # CURRENT (WRONG):                                                                                                  
 func.to_tsvector('english', Chunk.content).match(query)                                                             
                                                                                                                     
 # The `.match()` expects a tsquery, not a raw string!                                                               
 # This either fails silently or behaves unpredictably                                                               
                                                                                                                     
 Fix:                                                                                                                
 # CORRECT:                                                                                                          
 func.to_tsvector('english', Chunk.content).match(                                                                   
     func.plainto_tsquery('english', query)                                                                          
 )                                                                                                                   
                                                                                                                     
 Bug 2b: Qdrant Text Search Uses Substring Matching                                                                  
                                                                                                                     
 File: qdrant_service.py:699                                                                                         
                                                                                                                     
 match=models.MatchText(text=query_text)  # Matches ANY substring!                                                   
                                                                                                                     
 Query "tell me about what you know" matches documents containing "what", "know", "about", "me", "tell" - any common 
  word.                                                                                                              
                                                                                                                     
 Fix: Split query into significant words, require multiple matches:                                                  
 # Filter out stop words and require at least 2 significant terms to match                                           
 significant_terms = [w for w in query_text.lower().split() if len(w) > 3 and w not in STOP_WORDS]                   
                                                                                                                     
 Bug 2c: Hybrid Search Skips Threshold Filtering                                                                     
                                                                                                                     
 File: retrieval_service.py:475-479                                                                                  
                                                                                                                     
 if effective_search_method != "hybrid":                                                                             
     results = [r for r in results if r["score"] >= effective_threshold]                                             
 else:                                                                                                               
     print(f"[RetrievalService] Skipping threshold filter for hybrid search...")                                     
                                                                                                                     
 Result: Keyword-only results with 0.24 score (0.8 × 0.3) bypass filtering.                                          
                                                                                                                     
 Fix: Apply a minimum threshold for hybrid results:                                                                  
 if effective_search_method != "hybrid":                                                                             
     results = [r for r in results if r["score"] >= effective_threshold]                                             
 else:                                                                                                               
     # Hybrid: apply reduced threshold to filter truly irrelevant results                                            
     min_hybrid_threshold = 0.2  # Minimum combined score                                                            
     results = [r for r in results if r["score"] >= min_hybrid_threshold]                                            
                                                                                                                     
 ---                                                                                                                 
 Issue 3: AI Keeps Repeating Instructions Despite History                                                            
                                                                                                                     
 Evidence                                                                                                            
                                                                                                                     
 User: "im hary" → AI: "Nice to meet you, Hary!"                                                                     
 ...later...                                                                                                         
 User: "yes please" → AI: "I'd like to get your name first"                                                          
                                                                                                                     
 Root Cause                                                                                                          
                                                                                                                     
 LLM Architecture Priority: System prompt instructions are treated as RULES, conversation history is treated as      
 DATA. When they conflict, rules win.                                                                                
                                                                                                                     
 Instructions are in the system prompt EVERY turn, and LLMs prioritize explicit system instructions over implicit    
 conversation context. The advisory text "check conversation history" is just text - not enforcement.                
                                                                                                                     
 General Solution: Inject Conversation Summary BEFORE Instructions                                                   
                                                                                                                     
 Instead of trying to pattern-match specific instructions (too narrow), we inject a conversation summary immediately 
  before instructions. This makes the state EXPLICIT in the same section of the system prompt.                       
                                                                                                                     
 File: chatbot_service.py - Around line 661-673                                                                      
                                                                                                                     
 Before:                                                                                                             
 instruction_text = "\n\nINSTRUCTIONS (check conversation history - don't repeat completed actions):\n"              
 for i, instr in enumerate(instructions, 1):                                                                         
     ...                                                                                                             
                                                                                                                     
 After: Build conversation summary and inject before instructions:                                                   
 # Build conversation state summary from history                                                                     
 if history and len(history) > 0:                                                                                    
     # Create a brief summary of what has happened                                                                   
     summary_parts = []                                                                                              
     for msg in history[-6:]:  # Last 6 messages                                                                     
         role = "User" if msg.role.value == "user" else "Assistant"                                                  
         # Truncate for brevity                                                                                      
         content_preview = msg.content[:80].replace('\n', ' ')                                                       
         summary_parts.append(f"- {role}: {content_preview}...")                                                     
                                                                                                                     
     conversation_summary = "\n".join(summary_parts)                                                                 
     instruction_text = f"""                                                                                         
 CONVERSATION SO FAR:                                                                                                
 {conversation_summary}                                                                                              
                                                                                                                     
 INSTRUCTIONS (DO NOT repeat actions already completed above):                                                       
 """                                                                                                                 
 else:                                                                                                               
     instruction_text = "\n\nINSTRUCTIONS:\n"                                                                        
                                                                                                                     
 for i, instr in enumerate(instructions, 1):                                                                         
     ...                                                                                                             
                                                                                                                     
 Why This Works Better                                                                                               
                                                                                                                     
 1. Summary is in the SYSTEM prompt - Same priority level as instructions                                            
 2. Placed IMMEDIATELY before instructions - LLM reads it right before processing instructions                       
 3. Explicit state - "User: im hary..." is visible right before "Ask for name"                                       
 4. Works for ANY instruction - Not limited to name-asking                                                           
 5. No pattern matching needed - The LLM makes the connection naturally                                              
                                                                                                                     
 Example Output                                                                                                      
                                                                                                                     
 CONVERSATION SO FAR:                                                                                                
 - User: hi...                                                                                                       
 - Assistant: Hello! I'm here to help with Secret Network. What's your name?...                                      
 - User: im hary...                                                                                                  
 - Assistant: Nice to meet you, Hary! How can I help?...                                                             
 - User: tell me about transactions...                                                                               
 - Assistant: I can tell you about... Would you like to know more?...                                                
                                                                                                                     
 INSTRUCTIONS (DO NOT repeat actions already completed above):                                                       
 1. Ask for the user's name                                                                                          
 2. Explain Secret Network features                                                                                  
                                                                                                                     
 The LLM sees "User: im hary" RIGHT BEFORE the instruction to "Ask for name" and naturally skips it.                 
                                                                                                                     
 ---                                                                                                                 
 Files to Modify                                                                                                     
 ┌──────────────────────┬─────────┬──────────────────────────────────────────────────────┐                           
 │         File         │ Line(s) │                        Change                        │                           
 ├──────────────────────┼─────────┼──────────────────────────────────────────────────────┤                           
 │ retrieval_service.py │ 187-192 │ Raise error on dimension mismatch instead of warning │                           
 ├──────────────────────┼─────────┼──────────────────────────────────────────────────────┤                           
 │ retrieval_service.py │ 603     │ Fix PostgreSQL FTS to use plainto_tsquery()          │                           
 ├──────────────────────┼─────────┼──────────────────────────────────────────────────────┤                           
 │ retrieval_service.py │ 475-479 │ Apply minimum threshold for hybrid search            │                           
 ├──────────────────────┼─────────┼──────────────────────────────────────────────────────┤                           
 │ chatbot_service.py   │ 661-673 │ Inject conversation summary before instructions      │                           
 └──────────────────────┴─────────┴──────────────────────────────────────────────────────┘                           
 Note: Qdrant text search stop word filtering is optional (Phase 3) - the main fix is FTS syntax + threshold.        
                                                                                                                     
 ---                                                                                                                 
 Implementation Order                                                                                                
                                                                                                                     
 Phase 1: Critical Retrieval Fixes (Issues 1 & 2)                                                                    
                                                                                                                     
 1. Fix PostgreSQL FTS syntax - use plainto_tsquery() (immediate impact)                                             
 2. Apply minimum threshold to hybrid results (prevents irrelevant content)                                          
 3. Add dimension mismatch error instead of warning (makes debugging obvious)                                        
                                                                                                                     
 Phase 2: Instruction Repetition Fix (Issue 3)                                                                       
                                                                                                                     
 4. Inject conversation summary before instructions (works for ANY instruction)                                      
                                                                                                                     
 Phase 3: Optional Improvements                                                                                      
                                                                                                                     
 5. Improve Qdrant text search with stop word filtering                                                              
 6. Add diagnostic endpoint for KB embedding verification                                                            
                                                                                                                     
 ---                                                                                                                 
 Verification                                                                                                        
                                                                                                                     
 After fixes, test conversation:                                                                                     
 1. "hi" → Greeting (may ask name if instruction exists)                                                             
 2. "im hary" → "Nice to meet you, Hary!"                                                                            
 3. "tell me what you know" → Lists RELEVANT topics from KB (not random docs)                                        
 4. "yes please" → Continues conversation WITHOUT re-asking for name                                                 
 5. Check logs: Vector search should return results (not 0)                                                          
                                                                                                                     
 ---                                                                                                                 
 What We're NOT Doing (Avoiding Over-Engineering)                                                                    
                                                                                                                     
 - ❌ Not adding intent detection service                                                                            
 - ❌ Not adding complex state tracking                                                                              
 - ❌ Not changing the overall retrieval architecture                                                                
 - ❌ Not adding new database tables                                                                                 
 - ✅ Fixing actual bugs in existing code                                                                            
 - ✅ Making existing code work as intended                                                                          
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
                                                                                                                     
 Requested permissions:                                                                                              
   · Bash(prompt: restart backend services)             




All 4 fixes have been implemented. Here's a summary:                                                               
                                                                                                                     
  Changes Made                                                                                                       
                                                                                                                     
  Fix 1: PostgreSQL FTS Syntax (retrieval_service.py:603-607)                                                        
                                                                                                                     
  # BEFORE: .match(query) - expects tsquery, not string                                                              
  # AFTER: .match(func.plainto_tsquery('english', query))                                                            
  This properly converts user queries to PostgreSQL full-text search format.                                         
                                                                                                                     
  Fix 2: Hybrid Search Threshold (retrieval_service.py:475-485)                                                      
                                                                                                                     
  # BEFORE: Skipped threshold filter entirely for hybrid                                                             
  # AFTER: Apply min_hybrid_threshold = 0.25                                                                         
  This filters out keyword-only matches (0.24 score) that lack vector support.                                       
                                                                                                                     
  Fix 3: Dimension Mismatch Error (retrieval_service.py:187-197)                                                     
                                                                                                                     
  # BEFORE: Only warned, let search fail silently                                                                    
  # AFTER: Raises ValueError with clear message                                                                      
  Now dimension mismatch errors are immediately obvious instead of returning 0 results silently.                     
                                                                                                                     
  Fix 4: Conversation Summary Before Instructions (chatbot_service.py:661-696)                                       
                                                                                                                     
  # BEFORE: "INSTRUCTIONS (check history):" - just advisory text                                                     
  # AFTER: Injects actual conversation summary RIGHT BEFORE instructions                                             
  Example output:                                                                                                    
  CONVERSATION SO FAR:                                                                                               
  - User: hi...                                                                                                      
  - Assistant: Hello! What's your name?...                                                                           
  - User: im hary...                                                                                                 
                                                                                                                     
  INSTRUCTIONS (DO NOT repeat actions already completed above):                                                      
  1. Ask for user's name                                                                                             
                                                                                                                     
  ---                                                                                                                
  To verify, restart backend and test:                                                                               
  1. "hi" → Greeting (may ask name)                                                                                  
  2. "im hary" → "Nice to meet you, Hary!"                                                                           
  3. "tell me what you know" → Should return RELEVANT KB content (not random docs)                                   
  4. "yes please" → Should continue WITHOUT re-asking for name                                                       
  5. Check logs: Should see proper FTS queries and threshold filtering   