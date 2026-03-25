# Document Processing Implementation Plan

## Executive Summary

This document provides a detailed implementation plan for adding document processing capabilities to PrivexBot's Knowledge Base system. Currently, **file upload processing is 100% pseudocode** and needs to be implemented from scratch.

---

## Current State Analysis

### What Works ✅

1. **Web URL Scraping** - FULLY FUNCTIONAL
   - `crawl4ai_service.py` - Production-ready with Playwright
   - Stealth mode, markdown extraction, configurable crawling
   - **This is the gold standard implementation to follow**

2. **Draft-First Architecture** - FULLY FUNCTIONAL
   - Redis-based draft storage with 24hr TTL
   - Source management, configuration preview
   - Finalization triggers Celery pipeline

3. **KB Pipeline** - FULLY FUNCTIONAL
   - Celery task orchestration (`process_web_kb_task`)
   - Progress tracking in Redis
   - Chunking → Embedding → Vector indexing flow

4. **Vector Store Integration** - FULLY FUNCTIONAL
   - Qdrant for vector storage
   - Embedding service (OpenAI-based)
   - Multi-strategy retrieval

### What Doesn't Work ❌

1. **File Upload Adapter** - 100% PSEUDOCODE
   - `/backend/src/app/adapters/file_upload_adapter.py`
   - Claims support for 15+ formats
   - Zero actual implementation

2. **Smart Parsing Service** - 100% PSEUDOCODE
   - `/backend/src/app/services/smart_parsing_service.py`
   - Architectural documentation only
   - No working code

3. **Document Processing Service** - UNKNOWN STATUS
   - Referenced in docs but not examined
   - Likely pseudocode

### What Partially Works ⚠️

1. **Unstructured Adapter** - API/Library Wrapper
   - Can use Unstructured.io API (requires API key)
   - Can use local `unstructured` library (requires installation)
   - **This can be leveraged for quick implementation**

---

## Implementation Strategy

### Architecture Decision: Two-Track Approach

**Track 1: Quick Win (Week 1-2)** - Use Unstructured Library
- Leverage existing `unstructured_adapter.py`
- Add missing dependencies
- Support basic formats immediately

**Track 2: Native Implementation (Month 1-3)** - Custom Parsers
- Build format-specific parsers
- Better performance and control
- No external API dependencies

---

## Track 1: Quick Win with Unstructured Library

### Step 1: Install Dependencies

```bash
cd backend
uv add unstructured[all-docs]  # Includes PDF, DOCX, XLSX support
uv add pytesseract             # For OCR
uv add Pillow                  # Image processing
uv add python-magic            # MIME type detection
```

### Step 2: Implement File Upload Adapter Wrapper

**File**: `/backend/src/app/adapters/file_upload_adapter.py`

Replace pseudocode with:

```python
"""
File Upload Adapter - Phase 1 Implementation
Uses Unstructured library for document parsing
"""
from typing import Dict, Any, List, Optional
from pathlib import Path
import magic
from app.integrations.unstructured_adapter import UnstructuredAdapter
from app.schemas.kb_draft import DocumentContent

class FileUploadAdapter:
    """
    Handles file upload processing using Unstructured library.

    Supported formats:
    - Documents: PDF, DOCX, DOC, TXT, RTF, ODT
    - Spreadsheets: XLSX, XLS, CSV, TSV
    - Presentations: PPTX, PPT
    - Web: HTML, XML, MD
    """

    SUPPORTED_FORMATS = {
        # Documents
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.txt': 'text/plain',
        '.rtf': 'application/rtf',

        # Spreadsheets
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.csv': 'text/csv',

        # Web/Markup
        '.html': 'text/html',
        '.xml': 'application/xml',
        '.md': 'text/markdown',

        # Presentations
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.ppt': 'application/vnd.ms-powerpoint',
    }

    def __init__(self):
        self.unstructured = UnstructuredAdapter()
        self.mime = magic.Magic(mime=True)

    async def extract_content(
        self,
        source: Dict[str, Any]
    ) -> DocumentContent:
        """
        Extract content from uploaded file.

        Args:
            source: {
                "file_path": str,  # Path to uploaded file
                "filename": str,   # Original filename
                "options": {
                    "strategy": str,  # "fast" | "hi_res" | "ocr_only"
                    "extract_tables": bool,
                    "extract_images": bool,
                }
            }

        Returns:
            DocumentContent with extracted text and metadata
        """
        file_path = source.get("file_path")
        filename = source.get("filename", Path(file_path).name)
        options = source.get("options", {})

        # Validate file format
        file_ext = Path(filename).suffix.lower()
        if file_ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported file format: {file_ext}")

        # Detect MIME type
        mime_type = self.mime.from_file(file_path)

        # Route to appropriate parser
        if file_ext == '.txt':
            return await self._process_txt(file_path, options)
        elif file_ext == '.csv':
            return await self._process_csv(file_path, options)
        elif file_ext == '.md':
            return await self._process_markdown(file_path, options)
        else:
            # Use Unstructured for complex formats
            return await self._process_with_unstructured(
                file_path, filename, options
            )

    async def _process_txt(
        self,
        file_path: str,
        options: Dict
    ) -> DocumentContent:
        """Process plain text files."""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        return DocumentContent(
            text=content,
            metadata={
                "source_type": "file_upload",
                "format": "txt",
                "word_count": len(content.split()),
                "char_count": len(content),
            }
        )

    async def _process_csv(
        self,
        file_path: str,
        options: Dict
    ) -> DocumentContent:
        """Process CSV files."""
        import pandas as pd

        df = pd.read_csv(file_path)

        # Convert to markdown table
        content = df.to_markdown(index=False)

        return DocumentContent(
            text=content,
            metadata={
                "source_type": "file_upload",
                "format": "csv",
                "rows": len(df),
                "columns": len(df.columns),
                "column_names": list(df.columns),
            }
        )

    async def _process_markdown(
        self,
        file_path: str,
        options: Dict
    ) -> DocumentContent:
        """Process markdown files."""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        return DocumentContent(
            text=content,
            metadata={
                "source_type": "file_upload",
                "format": "markdown",
                "word_count": len(content.split()),
            }
        )

    async def _process_with_unstructured(
        self,
        file_path: str,
        filename: str,
        options: Dict
    ) -> DocumentContent:
        """
        Process complex documents using Unstructured library.
        Handles: PDF, DOCX, XLSX, PPTX, HTML, etc.
        """
        strategy = options.get("strategy", "fast")

        # Call Unstructured adapter
        result = await self.unstructured.parse_document(
            file_path=file_path,
            strategy=strategy
        )

        if "error" in result:
            raise ValueError(f"Failed to parse document: {result['error']}")

        # Extract elements from Unstructured response
        elements = result.get("elements", [])

        # Combine text from all elements
        text_parts = []
        tables = []

        for element in elements:
            element_type = element.get("type")
            text = element.get("text", "")

            if element_type == "Table":
                tables.append(element.get("metadata", {}).get("text_as_html", text))
            else:
                text_parts.append(text)

        full_text = "\n\n".join(text_parts)

        return DocumentContent(
            text=full_text,
            metadata={
                "source_type": "file_upload",
                "format": Path(filename).suffix[1:],
                "filename": filename,
                "element_count": len(elements),
                "table_count": len(tables),
                "word_count": len(full_text.split()),
                "processing_strategy": strategy,
            }
        )
```

### Step 3: Update KB Draft Routes

**File**: `/backend/src/app/api/v1/routes/kb_draft.py`

Add new endpoint:

```python
@router.post("/{draft_id}/sources/file")
async def add_file_source(
    draft_id: str,
    file: UploadFile = File(...),
    options: Optional[str] = Form(None),  # JSON string
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Add a file source to KB draft.

    Process:
    1. Save uploaded file temporarily
    2. Extract content using FileUploadAdapter
    3. Store in draft with preview
    4. Return source details
    """
    import json
    import tempfile
    import shutil
    from app.adapters.file_upload_adapter import FileUploadAdapter

    # Parse options
    upload_options = {}
    if options:
        upload_options = json.loads(options)

    # Save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Extract content
        adapter = FileUploadAdapter()
        document_content = await adapter.extract_content({
            "file_path": tmp_path,
            "filename": file.filename,
            "options": upload_options
        })

        # Get draft
        draft_data = await kb_draft_service.get_draft(draft_id)
        if not draft_data:
            raise HTTPException(status_code=404, detail="Draft not found")

        # Add source to draft
        source = {
            "source_id": str(uuid.uuid4()),
            "type": "file_upload",
            "filename": file.filename,
            "format": Path(file.filename).suffix[1:],
            "content": document_content.text,
            "metadata": document_content.metadata,
            "added_at": datetime.utcnow().isoformat(),
        }

        # Update draft in Redis
        draft_data["sources"] = draft_data.get("sources", [])
        draft_data["sources"].append(source)
        await kb_draft_service.save_draft(draft_id, draft_data)

        return {
            "success": True,
            "source": source,
            "preview": document_content.text[:500],  # First 500 chars
        }

    finally:
        # Cleanup temp file
        if Path(tmp_path).exists():
            Path(tmp_path).unlink()
```

### Step 4: Update Celery Pipeline Task

**File**: `/backend/src/app/tasks/kb_pipeline_tasks.py`

Add file processing branch:

```python
# Inside process_web_kb_task function

# After line 228, add:

# Handle different source types
for source in sources:
    source_type = source.get("type", "web_url")

    if source_type == "web_url":
        # Existing web scraping logic
        pass

    elif source_type == "file_upload":
        # File upload processing
        filename = source.get("filename")
        content = source.get("content")
        metadata = source.get("metadata", {})

        # Create document record
        document = Document(
            kb_id=kb_id,
            source_type="file_upload",
            source_url=None,
            title=filename,
            content_full=content,
            metadata={
                **metadata,
                "filename": filename,
                "uploaded_at": source.get("added_at"),
            },
            status="ready",
        )
        db.add(document)
        db.commit()

        documents.append(document)
```

### Step 5: Testing

Create test file:

```bash
# backend/tests/test_file_upload.py

import pytest
from pathlib import Path
from app.adapters.file_upload_adapter import FileUploadAdapter

@pytest.mark.asyncio
async def test_txt_upload():
    adapter = FileUploadAdapter()

    # Create temp test file
    test_file = Path("/tmp/test.txt")
    test_file.write_text("This is a test document.")

    result = await adapter.extract_content({
        "file_path": str(test_file),
        "filename": "test.txt",
        "options": {}
    })

    assert result.text == "This is a test document."
    assert result.metadata["format"] == "txt"
    assert result.metadata["word_count"] == 5

@pytest.mark.asyncio
async def test_pdf_upload():
    adapter = FileUploadAdapter()

    # Assume test.pdf exists in tests/fixtures/
    result = await adapter.extract_content({
        "file_path": "tests/fixtures/test.pdf",
        "filename": "test.pdf",
        "options": {"strategy": "fast"}
    })

    assert result.text is not None
    assert len(result.text) > 0
    assert result.metadata["format"] == "pdf"
```

---

## Track 2: Native Implementation (Advanced)

### Phase 1: PDF Processing (Weeks 3-4)

**Dependencies**:
```bash
uv add PyMuPDF  # fitz - Best PDF library for Python
uv add pdfplumber  # For table extraction
```

**Implementation**:

```python
async def _process_pdf_native(
    self,
    file_path: str,
    options: Dict
) -> DocumentContent:
    """
    Native PDF processing with PyMuPDF.

    Features:
    - Text extraction with layout preservation
    - Table detection and extraction
    - Image extraction (optional)
    - OCR for scanned PDFs
    """
    import fitz  # PyMuPDF
    import pdfplumber

    doc = fitz.open(file_path)

    pages = []
    tables = []
    images = []

    for page_num, page in enumerate(doc):
        # Extract text with layout
        text = page.get_text("text")

        # Detect if page is mostly image (needs OCR)
        if len(text.strip()) < 50:
            # Apply OCR
            pix = page.get_pixmap()
            img_bytes = pix.tobytes("png")
            text = await self._ocr_image(img_bytes)

        pages.append({
            "page_number": page_num + 1,
            "text": text,
            "word_count": len(text.split()),
        })

        # Extract tables with pdfplumber
        if options.get("extract_tables", True):
            with pdfplumber.open(file_path) as pdf:
                pdf_page = pdf.pages[page_num]
                page_tables = pdf_page.extract_tables()

                for table in page_tables:
                    # Convert table to markdown
                    import pandas as pd
                    df = pd.DataFrame(table[1:], columns=table[0])
                    tables.append(df.to_markdown(index=False))

    # Combine all text
    full_text = "\n\n".join([p["text"] for p in pages])

    # Add tables
    if tables:
        full_text += "\n\n## Tables\n\n" + "\n\n".join(tables)

    return DocumentContent(
        text=full_text,
        metadata={
            "source_type": "file_upload",
            "format": "pdf",
            "page_count": len(pages),
            "table_count": len(tables),
            "word_count": len(full_text.split()),
            "pages": pages,
        }
    )

async def _ocr_image(self, image_bytes: bytes) -> str:
    """OCR processing using Tesseract."""
    from PIL import Image
    import pytesseract
    import io

    image = Image.open(io.BytesIO(image_bytes))
    text = pytesseract.image_to_string(image)

    return text
```

### Phase 2: DOCX Processing (Week 5)

**Dependencies**:
```bash
uv add python-docx
```

**Implementation**:

```python
async def _process_docx_native(
    self,
    file_path: str,
    options: Dict
) -> DocumentContent:
    """
    Native DOCX processing with python-docx.

    Features:
    - Paragraph extraction with styles
    - Table extraction
    - Header/footer extraction
    - Image extraction (optional)
    """
    from docx import Document as DocxDocument

    doc = DocxDocument(file_path)

    # Extract paragraphs
    paragraphs = []
    for para in doc.paragraphs:
        if para.text.strip():
            paragraphs.append({
                "text": para.text,
                "style": para.style.name,
            })

    # Extract tables
    tables = []
    for table in doc.tables:
        data = []
        for row in table.rows:
            row_data = [cell.text for cell in row.cells]
            data.append(row_data)

        # Convert to markdown
        import pandas as pd
        df = pd.DataFrame(data[1:], columns=data[0])
        tables.append(df.to_markdown(index=False))

    # Combine text
    full_text = "\n\n".join([p["text"] for p in paragraphs])

    if tables:
        full_text += "\n\n## Tables\n\n" + "\n\n".join(tables)

    return DocumentContent(
        text=full_text,
        metadata={
            "source_type": "file_upload",
            "format": "docx",
            "paragraph_count": len(paragraphs),
            "table_count": len(tables),
            "word_count": len(full_text.split()),
        }
    )
```

### Phase 3: Excel Processing (Week 6)

**Dependencies**:
```bash
uv add pandas
uv add openpyxl  # For .xlsx
uv add xlrd      # For .xls
```

**Implementation**:

```python
async def _process_excel_native(
    self,
    file_path: str,
    options: Dict
) -> DocumentContent:
    """
    Native Excel processing with pandas.

    Features:
    - All sheets extraction
    - Convert to markdown tables
    - Summary statistics
    """
    import pandas as pd

    # Read all sheets
    excel_file = pd.ExcelFile(file_path)

    sheets = []
    for sheet_name in excel_file.sheet_names:
        df = pd.read_excel(file_path, sheet_name=sheet_name)

        # Convert to markdown
        markdown = f"## {sheet_name}\n\n"
        markdown += df.to_markdown(index=False)

        sheets.append({
            "name": sheet_name,
            "markdown": markdown,
            "rows": len(df),
            "columns": len(df.columns),
        })

    # Combine all sheets
    full_text = "\n\n".join([s["markdown"] for s in sheets])

    return DocumentContent(
        text=full_text,
        metadata={
            "source_type": "file_upload",
            "format": "xlsx" if file_path.endswith(".xlsx") else "xls",
            "sheet_count": len(sheets),
            "sheets": [{"name": s["name"], "rows": s["rows"], "columns": s["columns"]} for s in sheets],
        }
    )
```

---

## Integration with Existing KB Pipeline

### Update Draft Schema

**File**: `/backend/src/app/schemas/kb_draft.py`

Add file upload support:

```python
class FileUploadSource(BaseModel):
    """File upload source configuration."""
    type: Literal["file_upload"] = "file_upload"
    filename: str
    format: str  # pdf, docx, txt, csv, etc.
    file_size: Optional[int] = None
    processing_options: Dict[str, Any] = Field(default_factory=dict)

class KBSourceRequest(BaseModel):
    """Unified source request model."""
    web_urls: Optional[List[WebURLSource]] = None
    file_uploads: Optional[List[FileUploadSource]] = None
    text_inputs: Optional[List[TextInputSource]] = None
```

### Update Pipeline Monitoring

Add file processing stages to pipeline tracker:

```python
# In PipelineProgressTracker class

STAGES = {
    "web_scraping": "Scraping web pages",
    "file_parsing": "Parsing uploaded files",  # NEW
    "text_processing": "Processing text inputs",
    "chunking": "Creating chunks",
    "embedding": "Generating embeddings",
    "indexing": "Indexing to vector store",
}
```

---

## Open-Source Self-Hosted Alternatives

### For Document Processing

1. **Apache Tika** (Java-based)
   - Supports 1000+ file formats
   - Can run as REST API server
   - Python client: `tika-python`

   ```bash
   # Docker deployment
   docker run -p 9998:9998 apache/tika:latest
   ```

2. **Gotenberg** (Go-based)
   - PDF conversion/processing
   - Docker-first design
   - HTML to PDF, Office to PDF

   ```bash
   docker run -p 3000:3000 gotenberg/gotenberg:7
   ```

3. **Pandoc** (Haskell-based)
   - Universal document converter
   - Markdown, DOCX, PDF, HTML, etc.
   - CLI or Python wrapper (`pypandoc`)

4. **Textract** (Python)
   - Pure Python text extraction
   - No external dependencies
   - Supports: PDF, DOCX, XLSX, etc.

   ```bash
   uv add textract
   ```

### For OCR

1. **Tesseract OCR**
   - Industry standard open-source OCR
   - 100+ languages
   - Python wrapper: `pytesseract`

   ```bash
   # Ubuntu/Debian
   apt-get install tesseract-ocr

   # macOS
   brew install tesseract
   ```

2. **OCRmyPDF**
   - Adds OCR text layer to PDFs
   - Uses Tesseract under the hood

   ```bash
   uv add ocrmypdf
   ```

### For Table Extraction

1. **Tabula** (Java-based)
   - PDF table extraction
   - Python wrapper: `tabula-py`

   ```bash
   uv add tabula-py
   ```

2. **Camelot**
   - PDF table extraction (Python)
   - More accurate than Tabula

   ```bash
   uv add camelot-py[cv]
   ```

---

## Recommended Architecture

### Hybrid Approach

```
File Upload
    ↓
Format Detection (python-magic)
    ↓
Router (based on file type)
    ↓
    ├─→ Simple formats (TXT, CSV, MD) → Native Python
    ├─→ Office docs (DOCX, XLSX) → python-docx / pandas
    ├─→ PDF → PyMuPDF + pdfplumber
    ├─→ Complex/Unknown → Unstructured library
    └─→ Scanned images/PDFs → Tesseract OCR
    ↓
Content Normalization
    ↓
Draft Storage (Redis)
    ↓
Finalize → Celery Pipeline
    ↓
Chunking → Embedding → Vector Store
```

### Service Layer Design

```python
# New service file structure
/backend/src/app/services/
├── document_processing/
│   ├── __init__.py
│   ├── base_processor.py           # Abstract base class
│   ├── text_processor.py           # TXT, MD processing
│   ├── csv_processor.py            # CSV, TSV processing
│   ├── pdf_processor.py            # PDF processing
│   ├── docx_processor.py           # DOCX processing
│   ├── excel_processor.py          # XLSX, XLS processing
│   ├── ocr_processor.py            # OCR for images/scanned PDFs
│   └── processor_factory.py        # Factory pattern for routing
```

**Base Processor Interface**:

```python
# base_processor.py
from abc import ABC, abstractmethod
from typing import Dict, Any
from app.schemas.kb_draft import DocumentContent

class BaseDocumentProcessor(ABC):
    """Abstract base class for document processors."""

    @abstractmethod
    async def can_process(self, file_path: str, mime_type: str) -> bool:
        """Check if this processor can handle the file."""
        pass

    @abstractmethod
    async def process(
        self,
        file_path: str,
        options: Dict[str, Any]
    ) -> DocumentContent:
        """Process the document and return content."""
        pass

    @abstractmethod
    def get_supported_formats(self) -> List[str]:
        """Return list of supported file extensions."""
        pass
```

---

## Timeline & Milestones

### Week 1-2: Quick Win
- ✅ Install Unstructured library
- ✅ Implement FileUploadAdapter wrapper
- ✅ Add file upload API endpoint
- ✅ Update Celery pipeline
- ✅ Basic testing (TXT, CSV, PDF)

**Deliverable**: File upload working for basic formats

### Week 3-4: Native PDF Processing
- ✅ Install PyMuPDF + pdfplumber
- ✅ Implement native PDF processor
- ✅ Add table extraction
- ✅ Add OCR detection
- ✅ Testing with various PDFs

**Deliverable**: High-quality PDF processing

### Week 5: Native DOCX Processing
- ✅ Install python-docx
- ✅ Implement DOCX processor
- ✅ Add style preservation
- ✅ Add table extraction
- ✅ Testing

**Deliverable**: DOCX processing with formatting

### Week 6: Excel Processing
- ✅ Install pandas + openpyxl
- ✅ Implement Excel processor
- ✅ Multi-sheet support
- ✅ Testing

**Deliverable**: Excel to markdown conversion

### Week 7-8: OCR & Advanced Features
- ✅ Install Tesseract
- ✅ Implement OCR processor
- ✅ Scanned PDF detection
- ✅ Image-based PDF handling
- ✅ Performance optimization

**Deliverable**: Full OCR support

### Week 9-10: Polish & Production
- ✅ Error handling improvements
- ✅ Comprehensive testing
- ✅ Performance benchmarking
- ✅ Documentation
- ✅ Production deployment

**Deliverable**: Production-ready file upload system

---

## Testing Strategy

### Unit Tests

```python
# tests/unit/test_processors.py

@pytest.mark.asyncio
async def test_txt_processor():
    processor = TextProcessor()
    result = await processor.process("test.txt", {})
    assert result.text is not None

@pytest.mark.asyncio
async def test_pdf_processor_with_tables():
    processor = PDFProcessor()
    result = await processor.process("test_with_tables.pdf", {
        "extract_tables": True
    })
    assert result.metadata["table_count"] > 0
```

### Integration Tests

```python
# tests/integration/test_kb_file_upload.py

@pytest.mark.asyncio
async def test_full_file_upload_flow():
    # 1. Create draft
    draft = await kb_draft_service.create_draft(...)

    # 2. Upload file
    response = await client.post(
        f"/api/v1/kb-drafts/{draft['id']}/sources/file",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")}
    )
    assert response.status_code == 200

    # 3. Finalize
    finalize_response = await client.post(
        f"/api/v1/kb-drafts/{draft['id']}/finalize"
    )
    pipeline_id = finalize_response.json()["pipeline_id"]

    # 4. Wait for processing
    # (poll pipeline status)

    # 5. Verify KB is ready
    kb = await kb_service.get_kb(...)
    assert kb.status == "ready"
```

### Performance Tests

```python
# tests/performance/test_file_processing.py

@pytest.mark.benchmark
async def test_pdf_processing_speed():
    """Process 100-page PDF in < 30 seconds."""
    import time

    start = time.time()
    await processor.process("large_100_pages.pdf", {})
    duration = time.time() - start

    assert duration < 30  # Must process in under 30 seconds
```

---

## Monitoring & Observability

### Metrics to Track

```python
# Add to pipeline tracker
metrics = {
    "file_upload": {
        "total_files_processed": 0,
        "total_pages_processed": 0,
        "total_processing_time_ms": 0,
        "ocr_pages": 0,
        "tables_extracted": 0,
        "errors": 0,
    },
    "by_format": {
        "pdf": {"count": 0, "avg_time_ms": 0},
        "docx": {"count": 0, "avg_time_ms": 0},
        # ...
    }
}
```

### Logging

```python
# Structured logging
logger.info(
    "File processed",
    extra={
        "file_format": "pdf",
        "file_size_mb": 5.2,
        "page_count": 45,
        "processing_time_ms": 2340,
        "ocr_used": False,
        "tables_extracted": 3,
    }
)
```

---

## Security Considerations

### File Upload Security

1. **File Size Limits**
   ```python
   MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
   ```

2. **MIME Type Validation**
   ```python
   # Verify MIME type matches extension
   detected_mime = magic.from_file(file_path, mime=True)
   expected_mime = SUPPORTED_FORMATS[file_ext]
   if detected_mime != expected_mime:
       raise ValueError("MIME type mismatch")
   ```

3. **Virus Scanning** (Optional)
   ```bash
   uv add pyclamd  # ClamAV integration
   ```

4. **Sandboxed Processing**
   - Process files in temporary directory
   - Clean up after processing
   - No execution of embedded scripts

---

## Cost Analysis

### Track 1: Unstructured Library

**Pros**:
- ✅ Fast implementation (1-2 weeks)
- ✅ Supports 15+ formats immediately
- ✅ Good quality extraction

**Cons**:
- ❌ Requires either API key (costs $) or local library (heavy dependencies)
- ❌ Less control over processing
- ❌ Potential API rate limits

**Cost**: $0 (self-hosted) or $29-99/month (API)

### Track 2: Native Implementation

**Pros**:
- ✅ Full control over processing
- ✅ No external API dependencies
- ✅ Better performance for common formats
- ✅ Free and open-source

**Cons**:
- ❌ Longer development time (6-8 weeks)
- ❌ More maintenance burden
- ❌ Need to handle edge cases

**Cost**: $0 (all open-source)

---

## Recommended Decision

**Phase 1 (Now)**: Implement Track 1 for quick launch
- Get file upload working in 2 weeks
- Support basic formats immediately
- Validate user demand

**Phase 2 (Month 2-3)**: Add Track 2 for critical formats
- Replace Unstructured with native PDF processing
- Add native DOCX processing
- Keep Unstructured as fallback for edge cases

**Hybrid Final State**:
- PDF: Native (PyMuPDF + pdfplumber)
- DOCX: Native (python-docx)
- Excel: Native (pandas)
- TXT/CSV/MD: Native (built-in Python)
- Everything else: Unstructured library (fallback)

This gives you the best of both worlds: fast time-to-market + long-term cost efficiency.

---

**Document Version**: 1.0
**Last Updated**: 2025-12-15
**Status**: Ready for Implementation