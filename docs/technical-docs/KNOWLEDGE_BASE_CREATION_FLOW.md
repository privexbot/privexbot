# Knowledge Base Creation & Management Architecture

**Complete guide for KB creation from multiple sources with annotations, chunking, and indexing**

---

## Table of Contents

1. [Overview](#overview)
2. [Import Sources](#import-sources)
3. [Combined Knowledge Sources](#combined-sources)
4. [Document Annotations](#annotations)
5. [Chunking Configuration](#chunking)
6. [Indexing Settings](#indexing)
7. [Retrieval Settings](#retrieval)
8. [KB Creation Flow](#creation-flow)
9. [Background Processing](#background-processing)
10. [Implementation Guide](#implementation)

---

## 1. Overview {#overview}

### What is a Knowledge Base?

A Knowledge Base (KB) is a **centralized repository** of documents that power RAG (Retrieval-Augmented Generation) for chatbots and chatflows.

**Key Features:**

- **Multiple Sources**: Import from files, websites, Google Docs, Notion, Google Sheets, direct paste
- **Combined Sources**: Merge data from different sources into one KB
- **Smart Annotations**: Help AI understand document context and purpose
- **Flexible Chunking**: Configure how content is split (per document or per KB)
- **Advanced Indexing**: Hybrid search, semantic search, keyword search
- **Preview System**: See chunks before finalizing
- **Sync Capabilities**: Keep cloud sources (Notion, Google Docs) in sync

---

## 2. Import Sources {#import-sources}

### Supported Source Types

#### 1. File Upload

**WHY:** Direct file import for PDFs, Word docs, text files, etc.

**Tools Used:**
- **Unstructured.io** - Universal document parser
- **PyMuPDF** - PDF extraction
- **python-docx** - Word documents
- **Verba** - Multi-format support

**Supported Formats:**
- PDF (`.pdf`)
- Word (`.docx`, `.doc`)
- Text (`.txt`, `.md`)
- CSV (`.csv`)
- JSON (`.json`)

**Example:**

```python
@router.post("/kb/{kb_id}/documents/upload")
async def upload_document(
    kb_id: UUID,
    file: UploadFile,
    chunking_config: ChunkingConfigSchema | None = None,
    annotations: DocumentAnnotations | None = None,
    current_user: User = Depends(get_current_user)
):
    """
    Upload file to knowledge base.

    WHY: Allow direct file uploads
    HOW: Parse using Unstructured.io, chunk, embed
    """

    # Verify KB access
    kb = get_kb_or_404(kb_id, current_user)

    # Save file
    file_path = save_uploaded_file(file, kb.id)

    # Create document
    doc = Document(
        knowledge_base_id=kb.id,
        name=file.filename,
        source_type="file_upload",
        file_path=file_path,
        source_metadata={
            "original_filename": file.filename,
            "file_size": file.size,
            "mime_type": file.content_type,
            "file_hash": calculate_hash(file)
        },
        chunking_config=chunking_config,
        annotations=annotations,
        status="pending",
        created_by=current_user.id
    )

    db.add(doc)
    db.commit()

    # Queue processing task (async)
    process_document.delay(doc.id)

    return {"document_id": doc.id, "status": "pending"}
```

---

#### 2. Website Scraping

**WHY:** Import web pages and documentation sites

**Tools Used:**
- **Crawl4AI** - LLM-ready web scraping (recommended)
- **Firecrawl** - Fast web scraping with JS support
- **Jina Reader** - Clean markdown extraction

**Features:**
- Set crawl depth (number of pages)
- Include/exclude subdomains
- Add/remove specific pages
- Extract as markdown or JSON

**Example:**

```python
@router.post("/kb/{kb_id}/documents/website")
async def import_website(
    kb_id: UUID,
    url: str,
    crawl_config: WebsiteCrawlConfig,
    current_user: User = Depends(get_current_user)
):
    """
    Import website content.

    WHY: Scrape and import web pages
    HOW: Use Crawl4AI/Firecrawl, parse to markdown, chunk
    """

    kb = get_kb_or_404(kb_id, current_user)

    # Crawl website (background task)
    task = crawl_website.delay(
        url=url,
        max_pages=crawl_config.max_pages,
        include_subdomains=crawl_config.include_subdomains,
        excluded_paths=crawl_config.excluded_paths,
        kb_id=kb.id
    )

    return {"task_id": task.id, "status": "crawling"}
```

**Crawl Configuration:**

```python
class WebsiteCrawlConfig(BaseModel):
    max_pages: int = 10  # Number of pages to crawl
    include_subdomains: bool = False
    excluded_paths: list[str] = []  # Paths to skip
    included_paths: list[str] = []  # Specific paths to include
    wait_for_js: bool = True  # Wait for JS rendering
    extract_images: bool = False
    tool: Literal["crawl4ai", "firecrawl", "jina"] = "crawl4ai"
```

**Crawl4AI Implementation:**

```python
import asyncio
from crawl4ai import AsyncWebCrawler

async def crawl_website_crawl4ai(url: str, config: WebsiteCrawlConfig):
    """
    Crawl website using Crawl4AI.

    WHY: LLM-ready content extraction
    HOW: Async crawling with markdown output
    """

    async with AsyncWebCrawler() as crawler:
        # Crawl pages
        pages = await crawler.crawl_multiple(
            urls=[url],
            max_pages=config.max_pages,
            include_subdomains=config.include_subdomains,
            excluded_patterns=config.excluded_paths
        )

        documents = []
        for page in pages:
            # Extract markdown content
            content = page.markdown

            # Create document
            doc = {
                "name": page.title or page.url,
                "source_url": page.url,
                "content": content,
                "source_metadata": {
                    "crawled_at": datetime.utcnow(),
                    "crawl_depth": page.depth,
                    "word_count": len(content.split())
                }
            }
            documents.append(doc)

        return documents
```

---

#### 3. Google Docs

**WHY:** Sync with Google Workspace

**Tools Used:**
- **Google Docs API** - Official API
- **google-auth** - OAuth authentication

**Features:**
- Auto-sync on document updates
- Preserve formatting
- Extract comments and suggestions

**Example:**

```python
@router.post("/kb/{kb_id}/documents/google-docs")
async def import_google_doc(
    kb_id: UUID,
    doc_id: str,
    auto_sync: bool = False,
    current_user: User = Depends(get_current_user)
):
    """
    Import Google Doc.

    WHY: Sync with Google Workspace
    HOW: Use Google Docs API, convert to markdown
    """

    kb = get_kb_or_404(kb_id, current_user)

    # Get user's Google credentials
    credentials = get_google_credentials(current_user.id)

    # Fetch document
    service = build('docs', 'v1', credentials=credentials)
    doc = service.documents().get(documentId=doc_id).execute()

    # Extract content
    content = extract_google_doc_content(doc)

    # Create document
    document = Document(
        knowledge_base_id=kb.id,
        name=doc.get('title'),
        source_type="google_docs",
        source_url=f"https://docs.google.com/document/d/{doc_id}",
        source_metadata={
            "google_doc_id": doc_id,
            "last_synced_at": datetime.utcnow(),
            "auto_sync": auto_sync
        },
        content=content,
        status="pending"
    )

    db.add(document)
    db.commit()

    # Queue processing
    process_document.delay(document.id)

    # Setup webhook for auto-sync
    if auto_sync:
        setup_google_docs_webhook(doc_id, kb.id)

    return {"document_id": document.id}
```

---

#### 4. Notion

**WHY:** Import Notion pages and databases

**Tools Used:**
- **Notion API** - Official API
- **notion-client** - Python SDK

**Features:**
- Import pages and sub-pages
- Sync databases
- Preserve hierarchical structure

**Example:**

```python
@router.post("/kb/{kb_id}/documents/notion")
async def import_notion_page(
    kb_id: UUID,
    page_id: str,
    include_subpages: bool = True,
    auto_sync: bool = False,
    current_user: User = Depends(get_current_user)
):
    """
    Import Notion page.

    WHY: Sync with Notion workspace
    HOW: Use Notion API, convert blocks to markdown
    """

    kb = get_kb_or_404(kb_id, current_user)

    # Get user's Notion credentials
    notion_token = get_notion_token(current_user.id)
    client = NotionClient(auth=notion_token)

    # Fetch page
    page = client.pages.retrieve(page_id)
    blocks = client.blocks.children.list(page_id)

    # Convert to markdown
    content = notion_blocks_to_markdown(blocks)

    # Create document
    document = Document(
        knowledge_base_id=kb.id,
        name=page['properties']['title']['title'][0]['plain_text'],
        source_type="notion",
        source_url=page['url'],
        source_metadata={
            "notion_page_id": page_id,
            "last_synced_at": datetime.utcnow(),
            "auto_sync": auto_sync
        },
        content=content,
        status="pending"
    )

    db.add(document)
    db.commit()

    process_document.delay(document.id)

    return {"document_id": document.id}
```

---

#### 5. Google Sheets

**WHY:** Import tabular data

**Tools Used:**
- **Google Sheets API** - Official API
- **pandas** - Data processing

**Features:**
- Import specific sheets/ranges
- Convert to structured text
- Auto-sync on updates

**Example:**

```python
@router.post("/kb/{kb_id}/documents/google-sheets")
async def import_google_sheet(
    kb_id: UUID,
    spreadsheet_id: str,
    sheet_name: str | None = None,
    current_user: User = Depends(get_current_user)
):
    """
    Import Google Sheet.

    WHY: Import structured data
    HOW: Use Google Sheets API, convert to text
    """

    kb = get_kb_or_404(kb_id, current_user)

    credentials = get_google_credentials(current_user.id)
    service = build('sheets', 'v4', credentials=credentials)

    # Fetch sheet data
    range_name = sheet_name or 'Sheet1'
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()

    rows = result.get('values', [])

    # Convert to markdown table
    content = rows_to_markdown_table(rows)

    # Create document
    document = Document(
        knowledge_base_id=kb.id,
        name=f"Google Sheet: {sheet_name}",
        source_type="google_sheets",
        source_url=f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}",
        content=content,
        status="pending"
    )

    db.add(document)
    db.commit()

    process_document.delay(document.id)

    return {"document_id": document.id}
```

---

#### 6. Direct Text Paste

**WHY:** Quick manual input for FAQs, policies, etc.

**Formats Supported:**
- Plain text
- Markdown
- JSON

**Example:**

```python
@router.post("/kb/{kb_id}/documents/text")
def create_text_document(
    kb_id: UUID,
    name: str,
    content: str,
    format: Literal["text", "markdown", "json"] = "text",
    current_user: User = Depends(get_current_user)
):
    """
    Create document from direct text input.

    WHY: Quick manual entry
    HOW: Store text directly, chunk and embed
    """

    kb = get_kb_or_404(kb_id, current_user)

    document = Document(
        knowledge_base_id=kb.id,
        name=name,
        source_type="text_input",
        content=content,
        source_metadata={
            "format": format,
            "input_method": "manual_paste"
        },
        status="pending"
    )

    db.add(document)
    db.commit()

    process_document.delay(document.id)

    return {"document_id": document.id}
```

---

## 3. Combined Knowledge Sources {#combined-sources}

### Overview

**WHY:** Users often need to combine data from multiple sources into one unified knowledge base.

**Example Use Case:**
- Import product specs from Notion
- Add FAQ from Google Docs
- Include pricing from Google Sheets
- Add manual notes via text paste
- Scrape help docs from website

**All combined into one "Product Knowledge Base"**

---

### Combined KB Creation Flow

#### Step 1: Create Knowledge Base (Container)

```python
@router.post("/kb")
def create_knowledge_base(
    kb_data: KnowledgeBaseCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create empty KB (container for documents).

    WHY: KB holds documents from multiple sources
    HOW: Create KB first, then add documents
    """

    kb = KnowledgeBase(
        workspace_id=kb_data.workspace_id,
        name=kb_data.name,
        description=kb_data.description,
        embedding_config=kb_data.embedding_config,
        vector_store_config=kb_data.vector_store_config,
        context_settings=kb_data.context_settings,
        created_by=current_user.id
    )

    db.add(kb)
    db.commit()

    # Initialize vector store collection
    vector_store_service.create_collection(kb)

    return kb
```

---

#### Step 2: Add Documents from Multiple Sources

**User can add documents sequentially or in batch:**

```python
# Example: Combine sources
kb_id = create_kb("Product Knowledge Base")

# 1. Import Notion page
notion_doc = import_notion_page(kb_id, notion_page_id)

# 2. Import Google Doc
google_doc = import_google_doc(kb_id, google_doc_id)

# 3. Scrape website
website_docs = import_website(kb_id, "https://example.com/docs")

# 4. Upload PDF
pdf_doc = upload_document(kb_id, "manual.pdf")

# 5. Paste text
text_doc = create_text_document(kb_id, "FAQ", faq_content)

# All documents are now part of the same KB
```

---

#### Step 3: Preview Combined Knowledge

**Frontend UI:**

```javascript
// LeadsDashboard.jsx analog for KB
function KnowledgeSourcePreview({ kbId }) {
  const [documents, setDocuments] = useState([]);
  const [chunks, setChunks] = useState([]);

  useEffect(() => {
    // Fetch all documents in KB
    fetchDocuments(kbId);

    // Fetch chunk preview
    fetchChunkPreview(kbId, { limit: 100 });
  }, [kbId]);

  return (
    <div>
      {/* KB Summary */}
      <KBSummaryCard
        name="Combined Knowledge Source"
        type="combined"
        status="ready"
        size="12.5 KB"
        chunks={chunks.length}
        lastUpdated="01/10/2025"
      />

      {/* Document Sources List */}
      <SourcesList>
        <SourceItem
          name="Text Content 1"
          type="text"
          category="Manual input"
          tags={["text", "manual"]}
        />
        <SourceItem
          name="Homepage"
          type="website"
          source="https://example.com"
          tags={["website", "scrape"]}
        />
        <SourceItem
          name="Product Specifications"
          type="notion"
          status="ready"
          tags={["notion", "integration", "product"]}
        />
      </SourcesList>

      {/* Chunk Settings (Global) */}
      <ChunkSettings
        type="general"
        maxLength={1200}
        overlap={250}
      />

      {/* Content Preview */}
      <ContentPreview chunks={chunks} />
    </div>
  );
}
```

**API Endpoint:**

```python
@router.get("/kb/{kb_id}/preview")
def preview_kb_content(
    kb_id: UUID,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """
    Preview KB content before finalizing.

    WHY: Show chunks from all sources
    HOW: Return first N chunks across all documents
    """

    kb = get_kb_or_404(kb_id, current_user)

    # Get all documents
    documents = db.query(Document).filter(
        Document.knowledge_base_id == kb_id
    ).all()

    # Get chunk preview (first N chunks)
    chunks = db.query(Chunk).join(Document).filter(
        Document.knowledge_base_id == kb_id
    ).order_by(Chunk.position).limit(limit).all()

    return {
        "kb": {
            "name": kb.name,
            "type": "combined" if len(documents) > 1 else "single",
            "status": kb.status,
            "total_size": sum(d.character_count for d in documents),
            "total_chunks": kb.total_chunks,
            "last_updated": kb.updated_at
        },
        "sources": [
            {
                "name": doc.name,
                "type": doc.source_type,
                "status": doc.status,
                "chunks": doc.chunk_count,
                "annotations": doc.annotations
            }
            for doc in documents
        ],
        "chunk_preview": [
            {
                "id": chunk.id,
                "content": chunk.content[:200],  # Preview
                "document_name": chunk.document.name,
                "position": chunk.position,
                "page_number": chunk.page_number
            }
            for chunk in chunks
        ]
    }
```

---

## 4. Document Annotations {#annotations}

### Purpose

**WHY:** Help the inference service (Secret AI) understand document context, purpose, and constraints.

**HOW:** Attach metadata to each document that guides AI behavior during retrieval and response generation.

---

### Annotation Structure

Added to Document model as `annotations` JSONB field (see updated document.py model).

**Example Annotations:**

```json
{
  "enabled": true,
  "category": "document",
  "importance": "medium",
  "purpose": "File upload",
  "context": "Uploaded file: Invoice-GTP00010-1.10.2025.pdf",
  "tags": ["file", "uploaded", "invoice", "billing"],
  "notes": "Automatically uploaded file",
  "usage_instructions": "Use for invoice-related queries only",
  "constraints": "Q4 2024 data only"
}
```

---

### How Annotations Are Used

#### 1. During Retrieval

**Relevance Boosting:**

```python
def search_with_annotations(kb: KnowledgeBase, query: str):
    """
    Search with annotation-based boosting.

    WHY: Higher importance docs get higher relevance
    HOW: Boost scores based on importance level
    """

    # Get base results from vector search
    results = vector_store_service.search(kb, query)

    # Apply annotation boosting
    for result in results:
        chunk = result['chunk']
        doc = chunk.document

        if doc.annotations and doc.annotations['enabled']:
            importance = doc.annotations['importance']

            # Boost score based on importance
            if importance == "critical":
                result['score'] *= 1.5
            elif importance == "high":
                result['score'] *= 1.3
            elif importance == "medium":
                result['score'] *= 1.1

    # Re-sort by boosted scores
    results.sort(key=lambda x: x['score'], reverse=True)

    return results
```

---

#### 2. During Response Generation

**Context Injection:**

```python
def build_prompt_with_annotations(query: str, chunks: list):
    """
    Build prompt with annotation context.

    WHY: Give AI more context about sources
    HOW: Include annotations in system prompt
    """

    # Build context from chunks
    context_parts = []

    for chunk in chunks:
        doc = chunk.document
        annotations = doc.annotations

        # Add annotation context if enabled
        if annotations and annotations.get('enabled'):
            context_part = f"""
[Source: {doc.name}]
Category: {annotations.get('category', 'N/A')}
Purpose: {annotations.get('purpose', 'N/A')}
Usage Instructions: {annotations.get('usage_instructions', 'No restrictions')}
Constraints: {annotations.get('constraints', 'None')}

Content:
{chunk.content}
"""
        else:
            context_part = f"""
[Source: {doc.name}]
{chunk.content}
"""

        context_parts.append(context_part)

    # Build final prompt
    system_prompt = f"""
You are a helpful assistant. Use the following sources to answer the user's question.
Pay attention to the source annotations, usage instructions, and constraints.

Sources:
{chr(10).join(context_parts)}

User Question: {query}
"""

    return system_prompt
```

---

### Annotation UI

**Frontend Component:**

```javascript
function DocumentAnnotationForm({ documentId }) {
  const [annotations, setAnnotations] = useState({
    enabled: false,
    category: "document",
    importance: "medium",
    purpose: "",
    context: "",
    tags: [],
    notes: "",
    usage_instructions: "",
    constraints: ""
  });

  const handleSave = async () => {
    await updateDocument(documentId, { annotations });
  };

  return (
    <Form>
      <Toggle
        label="Enable Annotations"
        checked={annotations.enabled}
        onChange={(val) => setAnnotations({ ...annotations, enabled: val })}
      />

      <Select
        label="Category"
        value={annotations.category}
        options={["document", "workspace", "policy", "guide", "faq", "api_docs"]}
      />

      <Select
        label="Importance"
        value={annotations.importance}
        options={["low", "medium", "high", "critical"]}
      />

      <Input
        label="Purpose"
        value={annotations.purpose}
        placeholder="e.g., File upload, Integration with Notion"
      />

      <TextArea
        label="Context"
        value={annotations.context}
        placeholder="Additional context about this document"
      />

      <TagInput
        label="Tags"
        value={annotations.tags}
        placeholder="Separate with commas"
      />

      <TextArea
        label="Usage Instructions"
        value={annotations.usage_instructions}
        placeholder="How should AI use this document?"
      />

      <TextArea
        label="Constraints"
        value={annotations.constraints}
        placeholder="Any limitations or warnings"
      />

      <Button onClick={handleSave}>Save Annotations</Button>
    </Form>
  );
}
```

---

## 5. Chunking Configuration {#chunking}

### Overview

**WHY:** Content must be split into chunks for embedding and retrieval.

**HOW:** Configure chunking strategy at KB level (default) or document level (override).

---

### Chunking Strategies

#### 1. Size-Based (General)

**WHY:** Fixed-size chunks with overlap
**USE:** Generic documents, articles, manuals

```python
{
    "strategy": "size_based",
    "max_characters": 1000,
    "overlap": 200,
    "delimiter": "\n\n"  # Split on paragraphs
}
```

---

#### 2. By Heading

**WHY:** Preserve document structure
**USE:** Structured docs with headings (Markdown, HTML)

```python
{
    "strategy": "by_heading",
    "heading_levels": [1, 2, 3],  # H1, H2, H3
    "max_characters": 1500,
    "preserve_hierarchy": true
}
```

---

#### 3. By Page

**WHY:** Keep pages together
**USE:** PDFs, presentations

```python
{
    "strategy": "by_page",
    "combine_pages": false,  # One chunk per page
    "max_characters": 2000
}
```

---

#### 4. By Similarity (Semantic)

**WHY:** Group semantically similar sentences
**USE:** Advanced use cases

```python
{
    "strategy": "by_similarity",
    "similarity_threshold": 0.75,
    "min_chunk_size": 500,
    "max_chunk_size": 1500
}
```

---

### Configuration Levels

**1. KB-Level (Default):**

Applied to all documents unless overridden.

```python
kb = KnowledgeBase(
    name="Product Docs",
    chunking_config={
        "strategy": "size_based",
        "max_characters": 1000,
        "overlap": 200
    }
)
```

**2. Document-Level (Override):**

Specific chunking for individual documents.

```python
document = Document(
    knowledge_base_id=kb_id,
    name="API Reference",
    chunking_config={
        "strategy": "by_heading",  # Override KB default
        "heading_levels": [1, 2]
    }
)
```

---

### Chunking Service

```python
# backend/src/app/services/chunking_service.py

class ChunkingService:
    """
    Chunk documents based on strategy.

    WHY: Different docs need different chunking
    HOW: Strategy pattern with multiple chunkers
    """

    def chunk_document(self, document: Document) -> list[Chunk]:
        """
        Chunk document based on config.

        PRIORITY:
        1. Document-level config (if set)
        2. KB-level config (fallback)
        3. Default config
        """

        # Get config
        config = document.chunking_config or \
                 document.knowledge_base.chunking_config or \
                 DEFAULT_CHUNKING_CONFIG

        # Select strategy
        strategy = config['strategy']

        if strategy == "size_based":
            return self.chunk_by_size(document, config)
        elif strategy == "by_heading":
            return self.chunk_by_heading(document, config)
        elif strategy == "by_page":
            return self.chunk_by_page(document, config)
        elif strategy == "by_similarity":
            return self.chunk_by_similarity(document, config)

    def chunk_by_size(self, document: Document, config: dict) -> list[Chunk]:
        """
        Fixed-size chunking with overlap.
        """

        content = document.content
        max_chars = config['max_characters']
        overlap = config['overlap']

        chunks = []
        start = 0

        while start < len(content):
            end = start + max_chars
            chunk_text = content[start:end]

            chunk = Chunk(
                document_id=document.id,
                content=chunk_text,
                position=len(chunks),
                chunk_metadata={
                    "strategy": "size_based",
                    "start_char": start,
                    "end_char": end
                }
            )
            chunks.append(chunk)

            # Move forward with overlap
            start = end - overlap

        return chunks

    def chunk_by_heading(self, document: Document, config: dict) -> list[Chunk]:
        """
        Chunk by headings (Markdown/HTML).
        """

        import re

        content = document.content
        heading_levels = config.get('heading_levels', [1, 2, 3])

        # Build regex pattern for headings
        patterns = [f"^{'#' * level} " for level in heading_levels]
        pattern = '|'.join(patterns)

        # Split by headings
        sections = re.split(f'({pattern})', content, flags=re.MULTILINE)

        chunks = []
        current_heading = None
        current_content = []

        for section in sections:
            if re.match(pattern, section):
                # Save previous chunk
                if current_heading and current_content:
                    chunk = Chunk(
                        document_id=document.id,
                        content=current_heading + '\n' + ''.join(current_content),
                        position=len(chunks),
                        chunk_metadata={
                            "strategy": "by_heading",
                            "heading": current_heading.strip('# ')
                        }
                    )
                    chunks.append(chunk)

                # Start new chunk
                current_heading = section
                current_content = []
            else:
                current_content.append(section)

        # Save last chunk
        if current_heading and current_content:
            chunk = Chunk(
                document_id=document.id,
                content=current_heading + '\n' + ''.join(current_content),
                position=len(chunks),
                chunk_metadata={
                    "strategy": "by_heading",
                    "heading": current_heading.strip('# ')
                }
            )
            chunks.append(chunk)

        return chunks
```

---

### Chunk Preview UI

```javascript
function ChunkConfigurationPanel({ kbId, documentId }) {
  const [config, setConfig] = useState({
    strategy: "size_based",
    max_characters: 1000,
    overlap: 200
  });

  const [preview, setPreview] = useState([]);

  const handlePreview = async () => {
    // Generate preview chunks (without saving)
    const chunks = await previewChunks(documentId, config);
    setPreview(chunks);
  };

  return (
    <div>
      <h3>Chunk Settings</h3>

      <Select
        label="Chunk Type"
        value={config.strategy}
        options={["size_based", "by_heading", "by_page", "by_similarity"]}
        onChange={(val) => setConfig({ ...config, strategy: val })}
      />

      <Slider
        label="Max Chunk Length"
        value={config.max_characters}
        min={100}
        max={2000}
        step={100}
        onChange={(val) => setConfig({ ...config, max_characters: val })}
      />

      <Slider
        label="Chunk Overlap"
        value={config.overlap}
        min={0}
        max={500}
        step={50}
        onChange={(val) => setConfig({ ...config, overlap: val })}
      />

      <Button onClick={handlePreview}>Preview Chunks</Button>

      {/* Chunk Preview */}
      <ChunkPreviewList chunks={preview} />
    </div>
  );
}
```

---

## 6. Indexing Settings {#indexing}

### Overview

**WHY:** Control how content is indexed in vector store.

**HOW:** Configure indexing method, top K, threshold, reranking.

---

### Indexing Methods

#### 1. Embedding Only

**WHY:** Pure semantic search
**HOW:** Embed chunks, search by vector similarity

```python
{
    "method": "embedding",
    "model": "text-embedding-ada-002",
    "top_k": 5,
    "threshold": 0.7
}
```

---

#### 2. Keyword Only

**WHY:** Exact keyword matching
**HOW:** BM25 or TF-IDF index

```python
{
    "method": "keyword",
    "algorithm": "bm25",
    "top_k": 10
}
```

---

#### 3. Hybrid

**WHY:** Best of both worlds
**HOW:** Combine semantic + keyword, rerank

```python
{
    "method": "hybrid",
    "embedding_weight": 0.7,
    "keyword_weight": 0.3,
    "reranking_enabled": true,
    "reranking_model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
    "top_k": 10,
    "threshold": 0.7
}
```

---

### Indexing Service

```python
# backend/src/app/services/indexing_service.py

class IndexingService:
    """
    Index chunks in vector store.

    WHY: Enable fast retrieval
    HOW: Embed + store in vector DB
    """

    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store_service = VectorStoreService()

    async def index_document(self, document: Document):
        """
        Index all chunks of a document.

        WHY: Concurrent processing for speed
        HOW: Batch embed + upsert
        """

        # Get all chunks
        chunks = db.query(Chunk).filter(
            Chunk.document_id == document.id
        ).all()

        if not chunks:
            return

        # Get KB config
        kb = document.knowledge_base
        batch_size = kb.embedding_config.get('batch_size', 100)

        # Process in batches
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]

            # Embed batch (concurrent)
            embeddings = await self.embedding_service.embed_batch(
                kb=kb,
                texts=[chunk.content for chunk in batch]
            )

            # Prepare vector records
            records = []
            for chunk, embedding in zip(batch, embeddings):
                record = {
                    "id": str(chunk.id),
                    "embedding": embedding,
                    "content": chunk.content,
                    "metadata": {
                        "document_id": str(chunk.document_id),
                        "document_name": chunk.document.name,
                        "position": chunk.position,
                        "page_number": chunk.page_number,
                        "chunk_metadata": chunk.chunk_metadata,
                        "annotations": chunk.document.annotations
                    }
                }
                records.append(record)

                # Update chunk
                chunk.embedding_id = str(chunk.id)
                chunk.embedding_metadata = {
                    "model": kb.embedding_config['model'],
                    "dimensions": len(embedding)
                }

            # Upsert to vector store
            await self.vector_store_service.upsert_batch(kb, records)

            db.commit()

        # Update document status
        document.status = "completed"
        db.commit()
```

---

## 7. Retrieval Settings {#retrieval}

### Overview

**WHY:** Control how content is retrieved during queries.

**HOW:** Configure search type, max results, context window.

---

### Retrieval Configuration

**Global (KB-level):**

```python
{
    "search_type": "hybrid",
    "max_results": 10,
    "context_window": 4000,  # Total chars to return
    "similarity_threshold": 0.7,
    "reranking": true
}
```

**Per-Document Override:**

Users can set different retrieval settings for specific documents.

```python
document.retrieval_config = {
    "priority_boost": 1.5,  # Boost this doc's results
    "max_results_per_doc": 3  # Limit results from this doc
}
```

---

### Retrieval Service

```python
# backend/src/app/services/retrieval_service.py

class RetrievalService:
    """
    Retrieve relevant chunks for queries.

    WHY: Core RAG functionality
    HOW: Vector search + reranking + annotation boosting
    """

    async def retrieve(
        self,
        kb: KnowledgeBase,
        query: str,
        top_k: int = 10,
        filters: dict | None = None
    ) -> list[dict]:
        """
        Retrieve relevant chunks.

        FLOW:
        1. Embed query
        2. Vector search
        3. Apply filters
        4. Boost by annotations
        5. Rerank (if enabled)
        6. Return top K
        """

        # 1. Embed query
        query_embedding = await self.embedding_service.embed_text(kb, query)

        # 2. Vector search
        results = await self.vector_store_service.search(
            kb=kb,
            query_embedding=query_embedding,
            top_k=top_k * 2,  # Get more for reranking
            filters=filters
        )

        # 3. Apply annotation boosting
        results = self.apply_annotation_boosting(results)

        # 4. Rerank (if enabled)
        if kb.retrieval_config.get('reranking'):
            results = await self.rerank_results(query, results)

        # 5. Return top K
        return results[:top_k]

    def apply_annotation_boosting(self, results: list) -> list:
        """
        Boost scores based on document annotations.
        """

        for result in results:
            annotations = result['metadata'].get('annotations', {})

            if annotations.get('enabled'):
                importance = annotations.get('importance', 'medium')

                if importance == "critical":
                    result['score'] *= 1.5
                elif importance == "high":
                    result['score'] *= 1.3
                elif importance == "medium":
                    result['score'] *= 1.1

        # Re-sort
        results.sort(key=lambda x: x['score'], reverse=True)

        return results

    async def rerank_results(self, query: str, results: list) -> list:
        """
        Rerank results using cross-encoder.

        WHY: Improve relevance beyond vector similarity
        HOW: Use cross-encoder model to score query-document pairs
        """

        from sentence_transformers import CrossEncoder

        model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

        # Prepare pairs
        pairs = [(query, result['content']) for result in results]

        # Get reranking scores
        scores = model.predict(pairs)

        # Update scores
        for result, score in zip(results, scores):
            result['rerank_score'] = score

        # Sort by rerank score
        results.sort(key=lambda x: x['rerank_score'], reverse=True)

        return results
```

---

## 8. KB Creation Flow {#creation-flow}

### Complete Flow (Frontend → Backend → Background)

#### Step 1: Create KB (Container)

**Frontend:**

```javascript
async function createKnowledgeBase(workspaceId, kbData) {
  const response = await fetch(`/api/v1/kb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      name: kbData.name,
      description: kbData.description,
      embedding_config: kbData.embeddingConfig,
      vector_store_config: kbData.vectorStoreConfig
    })
  });

  const kb = await response.json();
  return kb.id;
}
```

---

#### Step 2: Add Documents (Multiple Sources)

**Frontend:**

```javascript
async function addDocumentsToKB(kbId, sources) {
  const documentIds = [];

  for (const source of sources) {
    let docId;

    if (source.type === 'file') {
      docId = await uploadFile(kbId, source.file, source.config);
    } else if (source.type === 'website') {
      docId = await importWebsite(kbId, source.url, source.config);
    } else if (source.type === 'notion') {
      docId = await importNotion(kbId, source.pageId, source.config);
    } else if (source.type === 'google_docs') {
      docId = await importGoogleDoc(kbId, source.docId, source.config);
    } else if (source.type === 'text') {
      docId = await createTextDocument(kbId, source.name, source.content);
    }

    documentIds.push(docId);
  }

  return documentIds;
}
```

---

#### Step 3: Configure & Annotate

**Frontend:**

```javascript
async function configureDocuments(documentIds, config) {
  for (const docId of documentIds) {
    // Set chunking config
    await updateDocument(docId, {
      chunking_config: config.chunking,
      annotations: config.annotations
    });
  }
}
```

---

#### Step 4: Preview Chunks

**Frontend:**

```javascript
async function previewKBChunks(kbId) {
  const response = await fetch(`/api/v1/kb/${kbId}/preview`);
  const data = await response.json();

  return {
    sources: data.sources,
    chunks: data.chunk_preview,
    stats: {
      totalSize: data.kb.total_size,
      totalChunks: data.kb.total_chunks,
      status: data.kb.status
    }
  };
}
```

---

#### Step 5: Finalize & Process

**Frontend:**

```javascript
async function finalizeKB(kbId) {
  // Trigger background processing
  const response = await fetch(`/api/v1/kb/${kbId}/process`, {
    method: 'POST'
  });

  const task = await response.json();
  return task.task_id;  // For status polling
}
```

**Backend:**

```python
@router.post("/kb/{kb_id}/process")
def process_kb(
    kb_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Process all documents in KB.

    WHY: Background processing for all docs
    HOW: Queue Celery task
    """

    kb = get_kb_or_404(kb_id, current_user)

    # Queue processing task
    task = process_knowledge_base.delay(kb_id)

    return {"task_id": task.id, "status": "processing"}
```

---

## 9. Background Processing {#background-processing}

### Overview

**WHY:** Document processing (parsing, chunking, embedding) is slow and should not block API requests.

**HOW:** Use **Celery** for background task queue with **Redis** as broker.

---

### Architecture

```
API Request → Create Document (status: pending) → Queue Task → Return Immediately
                                                       ↓
                                                  Celery Worker
                                                       ↓
                                            1. Parse document
                                            2. Extract text
                                            3. Chunk content
                                            4. Generate embeddings
                                            5. Store in vector DB
                                            6. Update status: completed
```

---

### Celery Configuration

**Setup:**

```python
# backend/src/app/celery_app.py

from celery import Celery

celery_app = Celery(
    'privexbot',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)
```

---

### Background Tasks

```python
# backend/src/app/tasks/document_tasks.py

from app.celery_app import celery_app
from app.services.document_processing_service import DocumentProcessingService

@celery_app.task(bind=True)
def process_document(self, document_id: str):
    """
    Process a single document.

    FLOW:
    1. Parse content (PDF, Word, etc.)
    2. Chunk content
    3. Generate embeddings
    4. Store in vector DB
    5. Update status
    """

    service = DocumentProcessingService()

    try:
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()

        if not document:
            return {"error": "Document not found"}

        # Update status
        document.status = "processing"
        db.commit()

        # 1. Parse content
        self.update_state(state='PROGRESS', meta={'step': 'parsing', 'progress': 10})
        content = service.parse_document(document)

        # 2. Chunk content
        self.update_state(state='PROGRESS', meta={'step': 'chunking', 'progress': 30})
        chunks = service.chunk_content(document, content)

        # 3. Generate embeddings
        self.update_state(state='PROGRESS', meta={'step': 'embedding', 'progress': 50})
        await service.embed_chunks(document, chunks)

        # 4. Store in vector DB
        self.update_state(state='PROGRESS', meta={'step': 'indexing', 'progress': 80})
        await service.index_chunks(document, chunks)

        # 5. Update status
        document.status = "completed"
        document.processing_progress = 100
        db.commit()

        return {"status": "completed", "document_id": document_id}

    except Exception as e:
        # Mark as failed
        document.status = "failed"
        document.error_message = str(e)
        db.commit()

        raise


@celery_app.task
def process_knowledge_base(kb_id: str):
    """
    Process all documents in KB.

    WHY: Batch processing for multiple documents
    HOW: Process in parallel (multiple workers)
    """

    # Get all pending documents
    documents = db.query(Document).filter(
        Document.knowledge_base_id == kb_id,
        Document.status == "pending"
    ).all()

    # Queue individual tasks
    for doc in documents:
        process_document.delay(str(doc.id))

    return {"queued_documents": len(documents)}


@celery_app.task
def crawl_website(url: str, config: dict, kb_id: str):
    """
    Crawl website and create documents.

    WHY: Long-running operation
    HOW: Async crawling with Crawl4AI
    """

    import asyncio

    # Crawl website
    pages = asyncio.run(crawl_website_crawl4ai(url, config))

    # Create documents for each page
    for page in pages:
        document = Document(
            knowledge_base_id=kb_id,
            name=page['name'],
            source_type="website",
            source_url=page['source_url'],
            content=page['content'],
            source_metadata=page['source_metadata'],
            status="pending"
        )

        db.add(document)
        db.commit()

        # Queue processing
        process_document.delay(str(document.id))

    return {"pages_crawled": len(pages)}
```

---

### Task Status Polling

**Frontend:**

```javascript
function DocumentProcessingStatus({ documentId }) {
  const [status, setStatus] = useState('pending');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await fetchDocumentStatus(documentId);

      setStatus(data.status);
      setProgress(data.progress);
      setCurrentStep(data.current_step);

      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
      }
    }, 2000);  // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [documentId]);

  return (
    <div>
      <ProgressBar value={progress} />
      <p>Status: {status}</p>
      <p>Step: {currentStep}</p>
    </div>
  );
}
```

**API Endpoint:**

```python
@router.get("/documents/{document_id}/status")
def get_document_status(
    document_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Get document processing status.

    WHY: Real-time status updates
    HOW: Return current status + progress
    """

    document = get_document_or_404(document_id, current_user)

    return {
        "status": document.status,
        "progress": document.processing_progress,
        "current_step": get_current_step(document),
        "error": document.error_message
    }
```

---

### Concurrent Processing (Best Practice)

**WHY:** Process multiple documents simultaneously for speed.

**HOW:** Celery workers process tasks in parallel.

**Configuration:**

```bash
# Start multiple Celery workers
celery -A app.celery_app worker --loglevel=info --concurrency=4
```

**Task Priority:**

```python
# High priority for small documents
process_document.apply_async(
    args=[document_id],
    priority=9  # 0-9, higher = more priority
)

# Low priority for large documents
process_document.apply_async(
    args=[document_id],
    priority=1
)
```

---

## 10. Implementation Guide {#implementation}

### Step-by-Step Implementation

#### Step 1: Install Dependencies

```bash
pip install \
  celery redis \
  crawl4ai firecrawl-py jina-reader \
  unstructured python-docx pymupdf \
  google-api-python-client notion-client \
  sentence-transformers
```

---

#### Step 2: Setup Celery

```python
# backend/src/app/celery_app.py

from celery import Celery

celery_app = Celery(
    'privexbot',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

celery_app.autodiscover_tasks(['app.tasks'])
```

---

#### Step 3: Create Services

**Services to implement:**

1. `DocumentProcessingService` - Parse, chunk, embed
2. `ChunkingService` - Multiple chunking strategies
3. `IndexingService` - Embed + vector store upsert
4. `RetrievalService` - Search + rerank + boost
5. `CrawlingService` - Website scraping (Crawl4AI, Firecrawl)
6. `IntegrationService` - Google Docs, Notion, Sheets

---

#### Step 4: Create API Endpoints

**Endpoints needed:**

```python
# KB Management
POST   /api/v1/kb
GET    /api/v1/kb/{kb_id}
PATCH  /api/v1/kb/{kb_id}
DELETE /api/v1/kb/{kb_id}

# Document Import
POST   /api/v1/kb/{kb_id}/documents/upload
POST   /api/v1/kb/{kb_id}/documents/website
POST   /api/v1/kb/{kb_id}/documents/google-docs
POST   /api/v1/kb/{kb_id}/documents/notion
POST   /api/v1/kb/{kb_id}/documents/google-sheets
POST   /api/v1/kb/{kb_id}/documents/text

# Document Management
GET    /api/v1/documents/{document_id}
PATCH  /api/v1/documents/{document_id}
DELETE /api/v1/documents/{document_id}
GET    /api/v1/documents/{document_id}/status

# Preview & Processing
GET    /api/v1/kb/{kb_id}/preview
POST   /api/v1/kb/{kb_id}/process
GET    /api/v1/kb/{kb_id}/chunks

# Annotations
PATCH  /api/v1/documents/{document_id}/annotations
```

---

#### Step 5: Frontend Components

**Components needed:**

1. `KBCreationWizard` - Multi-step KB creation
2. `SourceSelector` - Choose source type
3. `DocumentUploader` - File upload
4. `WebsiteCrawler` - Website import config
5. `CloudIntegration` - Google Docs, Notion auth
6. `DocumentAnnotationForm` - Annotation UI
7. `ChunkConfigPanel` - Chunking settings
8. `ChunkPreview` - Preview chunks
9. `ProcessingStatus` - Real-time status
10. `KnowledgeSourcePreview` - Combined source view

---

### Folder Structure Updates

```
backend/
├── src/app/
│   ├── tasks/
│   │   ├── document_tasks.py       # NEW - Celery tasks
│   │   ├── crawling_tasks.py       # NEW - Website crawling
│   │   └── sync_tasks.py           # NEW - Cloud sync (Notion, Google)
│   ├── services/
│   │   ├── document_processing_service.py  # NEW
│   │   ├── chunking_service.py             # NEW
│   │   ├── indexing_service.py             # NEW
│   │   ├── retrieval_service.py            # NEW
│   │   ├── crawling_service.py             # NEW
│   │   └── integration_service.py          # NEW
│   ├── integrations/
│   │   ├── crawl4ai_adapter.py     # NEW
│   │   ├── firecrawl_adapter.py    # NEW
│   │   ├── jina_adapter.py         # NEW
│   │   ├── google_adapter.py       # NEW
│   │   ├── notion_adapter.py       # NEW
│   │   └── unstructured_adapter.py # NEW
│   └── celery_app.py               # NEW

frontend/
├── src/
│   ├── pages/
│   │   ├── KBCreationWizard.jsx    # NEW
│   │   └── KnowledgeSourcePreview.jsx  # NEW (from user's example)
│   └── components/
│       ├── kb/
│       │   ├── SourceSelector.jsx
│       │   ├── DocumentUploader.jsx
│       │   ├── WebsiteCrawler.jsx
│       │   ├── CloudIntegration.jsx
│       │   ├── AnnotationForm.jsx
│       │   ├── ChunkConfig.jsx
│       │   └── ChunkPreview.jsx
```

---

### Best Practices

✅ **DO:**

- **Process in background** - Never block API requests
- **Use concurrent workers** - Process multiple documents simultaneously
- **Preview before finalizing** - Let users see chunks
- **Validate inputs** - Check file types, URLs, sizes
- **Handle errors gracefully** - Mark documents as failed, show error messages
- **Track progress** - Real-time status updates
- **Auto-annotate** - Set sensible defaults based on source type
- **Cache embeddings** - Don't re-embed unchanged content
- **Batch operations** - Embed and upsert in batches
- **Index metadata** - Enable filtering by source, date, annotations

❌ **DON'T:**

- **Block on processing** - Always use background tasks
- **Re-process unnecessarily** - Check if content changed
- **Ignore errors** - Log and notify users
- **Hardcode configs** - Make chunking/indexing configurable
- **Skip validation** - Validate URLs, file types, sizes
- **Process sequentially** - Use parallel workers
- **Forget cleanup** - Delete vector store data when deleting documents

---

## Summary

**Knowledge Base Creation System:**

1. **Multiple Import Sources** - Files, websites, Google Docs, Notion, Sheets, text
2. **Combined Sources** - Merge data from different sources into one KB
3. **Smart Annotations** - Help AI understand document context
4. **Flexible Chunking** - Multiple strategies (size, heading, page, semantic)
5. **Advanced Indexing** - Hybrid search with reranking
6. **Background Processing** - Celery workers for async processing
7. **Preview System** - See chunks before finalizing
8. **Real-time Status** - Track processing progress
9. **Best Practices** - Concurrent processing, caching, error handling

This architecture is **minimal**, **secure**, **robust**, and follows **best practices** for scalable KB management.
