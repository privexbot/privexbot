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