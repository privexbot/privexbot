# Self-Hosted Document Processing Architecture
## 100% Open-Source, Dockerized, Production-Ready Solution

**Version:** 1.0
**Last Updated:** 2025-12-15
**Status:** Production Architecture Specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Format Support Matrix](#format-support-matrix)
7. [Performance Characteristics](#performance-characteristics)
8. [Scaling Strategy](#scaling-strategy)
9. [Security Considerations](#security-considerations)
10. [Cost Analysis](#cost-analysis)

---

## Executive Summary

This document defines the architecture for PrivexBot's document processing system using **100% open-source, self-hosted tools** with **no external API dependencies**. The system supports **15+ document formats** with high performance, reliability, and complete data privacy.

### Key Design Principles

1. **Privacy-First**: All processing happens on-premises, zero external API calls
2. **Open-Source Only**: MIT, Apache 2.0, BSD licenses (commercially safe)
3. **Docker-First**: All components containerized for easy deployment
4. **Queue-Based**: Reliable, scalable async processing with RabbitMQ
5. **Format-Agnostic**: Universal processing through Apache Tika + specialized processors
6. **Performance-Optimized**: CPU-optimized embeddings (4.5x speedup), GPU-ready OCR

### Architecture Highlights

```
Supported Formats: 15+ (PDF, DOCX, XLSX, PPTX, TXT, CSV, MD, HTML, XML, RTF, ODT, ODS, ODP, Images, Scanned PDFs)
Processing Speed: ~3-5 seconds per document (100 pages)
Throughput: 100+ documents/hour (single worker)
Scalability: Horizontal (add workers)
Cost: $0/month (self-hosted)
Latency: <100ms (local network)
Privacy: ✅ Complete (no data leaves infrastructure)
```

---

## Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                              │
│                    (File Upload API Endpoints)                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Redis Draft   │
              │    Storage     │ (24hr TTL)
              └────────────────┘
                       │
                       ▼ Finalize
              ┌────────────────┐
              │   RabbitMQ     │ (Message Broker)
              │   Queues:      │
              │   - high_priority  │
              │   - file_processing│
              │   - embeddings     │
              │   - indexing       │
              └────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│  Celery    │ │  Celery    │ │  Celery    │
│  Worker 1  │ │  Worker 2  │ │  Worker N  │
│  (File)    │ │ (Embed)    │ │ (Index)    │
└────────────┘ └────────────┘ └────────────┘
         │             │             │
         ▼             ▼             ▼
┌─────────────────────────────────────────────┐
│         Document Processing Layer            │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ Apache Tika  │  │   Docling    │         │
│  │  (Primary)   │  │ (AI Parser)  │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ pdfplumber   │  │ python-docx  │         │
│  │  (Tables)    │  │   (DOCX)     │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  openpyxl    │  │ python-pptx  │         │
│  │   (Excel)    │  │   (PPTX)     │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  Tesseract   │  │  PaddleOCR   │         │
│  │  OCR (CPU)   │  │  (GPU-Opt)   │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   Chunking     │
              │   Service      │
              │ (5 strategies) │
              └────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   Embedding    │
              │   Service      │
              │ (sentence-     │
              │ transformers)  │
              └────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │    Qdrant      │
              │ Vector Store   │
              └────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   PostgreSQL   │
              │   (Metadata)   │
              └────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Technology | License |
|-----------|---------------|------------|---------|
| **API Gateway** | File upload, draft management | FastAPI | MIT |
| **Draft Storage** | Temporary storage, 24hr TTL | Redis | BSD-3 |
| **Message Broker** | Reliable task queueing | RabbitMQ | MPL 2.0 |
| **Task Workers** | Async document processing | Celery | BSD |
| **Document Parser** | Universal format detection | Apache Tika | Apache 2.0 |
| **AI Parser** | Structure-aware parsing | Docling (IBM) | MIT |
| **PDF Processor** | Table extraction | pdfplumber | MIT |
| **Office Parser** | DOCX, XLSX, PPTX | python-docx/xl/pptx | MIT |
| **OCR Engine** | Scanned PDFs, images | Tesseract | Apache 2.0 |
| **GPU OCR** | Fast multilingual OCR | PaddleOCR | Apache 2.0 |
| **Chunking** | Smart text splitting | Custom | - |
| **Embeddings** | Vector generation | sentence-transformers | Apache 2.0 |
| **Vector Store** | Similarity search | Qdrant | Apache 2.0 |
| **Database** | Metadata, KB records | PostgreSQL | PostgreSQL |

---

## Technology Stack

### Core Processing Stack

#### 1. Apache Tika (Primary Document Processor)

**Why Apache Tika?**
- ✅ **1000+ format support** (most comprehensive)
- ✅ **100% open-source** (Apache 2.0, no tricks)
- ✅ **Production-proven** (18+ years, Apache Foundation)
- ✅ **Docker-ready** (official images)
- ✅ **Active maintenance** (2024-2025 releases)

**Official Docker Image:**
```yaml
tika-server:
  image: apache/tika:latest-full  # Includes Tesseract OCR
  ports:
    - "9998:9998"
```

**Format Support:**
- Documents: PDF, DOCX, DOC, TXT, RTF, ODT, WPD
- Spreadsheets: XLSX, XLS, ODS, CSV, TSV
- Presentations: PPTX, PPT, ODP
- Web: HTML, XML, XHTML, MHTML
- E-books: EPUB, MOBI, AZW
- Archives: ZIP, TAR, RAR, 7Z
- Images: JPG, PNG, TIFF, BMP, GIF, HEIC (with OCR)
- Email: EML, MSG, PST
- Source Code: Java, Python, C++, etc.
- Databases: DBF, MDB
- Scientific: HDF, NetCDF, FITS
- CAD: DWG, DXF
- **Total: 1000+ MIME types**

**Processing Features:**
- Automatic format detection (MIME type)
- Metadata extraction (author, date, keywords)
- Embedded file extraction (ZIP, attachments)
- Auto OCR for scanned PDFs
- Language detection
- Encoding detection

#### 2. Docling (AI-Powered Parser)

**Why Docling?**
- ✅ **Best-in-class 2024-2025** (IBM Research)
- ✅ **MIT license** (commercially safe)
- ✅ **Structure-aware** (headings, code blocks, tables, math)
- ✅ **LangChain/LlamaIndex ready**
- ✅ **GPU-accelerated** (0.49s/page on L4)

**Performance (2024 Benchmarks):**
```
CPU (Intel x86):    3.1 sec/page
CPU (Apple M3 Max): 1.27 sec/page
GPU (Nvidia L4):    0.49 sec/page
```

**Use Cases:**
- AI/NLP pipeline integration
- Structure preservation needed
- Academic/technical documents
- When Apache Tika extraction isn't sufficient

**Installation:**
```python
pip install docling
```

**Usage:**
```python
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
result = converter.convert("document.pdf")
markdown = result.document.export_to_markdown()
```

#### 3. pdfplumber (Table Extraction Specialist)

**Why pdfplumber?**
- ✅ **Best table extraction** (2024 benchmarks)
- ✅ **MIT license** (vs PyMuPDF's AGPL)
- ✅ **Built on pdfminer.six** (pure Python)
- ✅ **Highly customizable**

**Benchmark Results (2024):**
- Table extraction: ⭐⭐⭐⭐⭐ **Best-in-class**
- Speed: 9.5s/100 pages (acceptable for quality)
- Precision: Superior to Tabula, Camelot

**Installation:**
```bash
pip install pdfplumber
```

**Usage:**
```python
import pdfplumber

with pdfplumber.open("report.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        tables = page.extract_tables()
```

#### 4. Office Document Processors

**python-docx (DOCX)**
```python
from docx import Document

doc = Document("document.docx")
for paragraph in doc.paragraphs:
    print(paragraph.text)
for table in doc.tables:
    # Extract table data
```

**openpyxl (Excel)**
```python
from openpyxl import load_workbook

wb = load_workbook("spreadsheet.xlsx")
for sheet in wb.sheetnames:
    ws = wb[sheet]
    for row in ws.iter_rows(values_only=True):
        print(row)
```

**python-pptx (PowerPoint)**
```python
from pptx import Presentation

prs = Presentation("slides.pptx")
for slide in prs.slides:
    for shape in slide.shapes:
        if hasattr(shape, "text"):
            print(shape.text)
```

#### 5. OCR Engines

**Tesseract OCR (CPU-Optimized)**

**Why Tesseract?**
- ✅ **Industry standard** (Google-maintained)
- ✅ **100+ languages**
- ✅ **Fastest on CPU** (2024 benchmarks)
- ✅ **Best general accuracy**
- ✅ **Apache 2.0 license**

**Installation:**
```bash
# Ubuntu/Debian
apt-get install tesseract-ocr tesseract-ocr-all

# macOS
brew install tesseract

# Python wrapper
pip install pytesseract
```

**Usage:**
```python
import pytesseract
from PIL import Image

text = pytesseract.image_to_string(Image.open("scan.jpg"))
```

**PaddleOCR (GPU-Optimized)**

**Why PaddleOCR?**
- ✅ **95%+ accuracy** in document scenarios
- ✅ **Several times faster with GPU**
- ✅ **Best for non-Latin languages** (Chinese, Arabic)
- ✅ **Apache 2.0 license**

**Installation:**
```bash
pip install paddleocr paddlepaddle-gpu
```

**Usage:**
```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en')
result = ocr.ocr('scan.jpg', cls=True)
```

**When to Use Which OCR:**
- **CPU environment → Tesseract**
- **GPU available → PaddleOCR**
- **Latin languages → Tesseract**
- **Chinese/Arabic → PaddleOCR**
- **Maximum speed → PaddleOCR + GPU**
- **Maximum compatibility → Tesseract**

#### 6. Embedding Models

**sentence-transformers 3.3.0 (Latest)**

**Why sentence-transformers?**
- ✅ **4.5x CPU speedup** (OpenVINO int8 quantization)
- ✅ **Apache 2.0 license**
- ✅ **Hugging Face ecosystem**
- ✅ **Production-proven**

**Recommended Models:**

| Model | Size | Dimensions | Speed | Quality | Use Case |
|-------|------|------------|-------|---------|----------|
| all-MiniLM-L6-v2 | 80MB | 384 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Speed-critical |
| all-mpnet-base-v2 | 420MB | 768 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Quality-critical |
| BGE-large-en-v1.5 | 1.34GB | 1024 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Production RAG |
| BGE-M3 | Medium | 1024 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Multilingual |

**Installation:**
```bash
pip install sentence-transformers>=3.3.0
pip install optimum[openvino]  # For 4.5x CPU speedup
```

**CPU-Optimized Usage (4.5x Speedup):**
```python
from optimum.intel import OVModelForFeatureExtraction
from transformers import AutoTokenizer

model_id = "sentence-transformers/all-MiniLM-L6-v2"

# Export to OpenVINO with int8 quantization
model = OVModelForFeatureExtraction.from_pretrained(
    model_id,
    export=True,
    quantization="int8"
)
tokenizer = AutoTokenizer.from_pretrained(model_id)

# Use normally
inputs = tokenizer("Hello world", return_tensors="pt")
outputs = model(**inputs)
```

**Standard Usage:**
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = model.encode([
    "This is a sentence",
    "This is another sentence"
])
```

#### 7. Queue System

**RabbitMQ + Celery**

**Why RabbitMQ over Redis?**
- ✅ **Reliability**: Persistent messaging, acknowledgments
- ✅ **Advanced routing**: Direct, fanout, topic, headers
- ✅ **Production-proven**: Industry standard for critical workflows
- ✅ **Document processing**: Reliability > Speed

**RabbitMQ Docker:**
```yaml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"    # AMQP
    - "15672:15672"  # Management UI
  environment:
    - RABBITMQ_DEFAULT_USER=admin
    - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}
```

**Celery Configuration:**
```python
# celery_config.py
broker_url = 'amqp://admin:password@rabbitmq:5672'
result_backend = 'redis://redis:6379/0'

task_routes = {
    'tasks.file_processing.*': {'queue': 'file_processing'},
    'tasks.embeddings.*': {'queue': 'embeddings'},
    'tasks.indexing.*': {'queue': 'indexing'},
}

task_annotations = {
    '*': {'rate_limit': '10/s'}  # Prevent queue overload
}

worker_prefetch_multiplier = 1  # Fair task distribution
```

**Queue Structure:**
```
high_priority    → Time-sensitive operations
file_processing  → Document parsing (I/O bound)
embeddings       → Embedding generation (CPU/GPU bound)
indexing         → Vector indexing (CPU bound)
```

#### 8. Vector Database

**Qdrant (Already in Use)**

**Why Qdrant?**
- ✅ **Rust performance** (low latency)
- ✅ **Advanced filtering** (metadata + vector search)
- ✅ **HTTP API** (RESTful, easy integration)
- ✅ **Apache 2.0 license**
- ✅ **10-100ms latency** on 1M-10M vectors

**Docker:**
```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"
  volumes:
    - qdrant_data:/qdrant/storage
```

**Alternatives for Future Consideration:**
- **Milvus**: For billions of vectors (distributed system)
- **Weaviate**: For knowledge graphs + vectors
- **FAISS**: For research/experiments (not production-ready alone)

---

## Component Details

### 1. File Upload Flow

```python
# File Upload API Endpoint
@router.post("/{draft_id}/sources/file")
async def add_file_source(
    draft_id: str,
    file: UploadFile = File(...),
    options: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    Upload file to KB draft.

    Flow:
    1. Validate file (MIME type, size)
    2. Save to temporary storage
    3. Detect format (python-magic)
    4. Route to appropriate processor
    5. Extract content + metadata
    6. Store in Redis draft
    7. Return preview
    """

    # Step 1: Validate
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")

    # Step 2: Save temporarily
    temp_path = await save_upload(file)

    # Step 3: Detect format
    file_format = detect_format(temp_path, file.filename)

    # Step 4: Route to processor
    content = await process_file(temp_path, file_format, options)

    # Step 5: Store in draft
    await kb_draft_service.add_source(draft_id, {
        "type": "file_upload",
        "filename": file.filename,
        "format": file_format,
        "content": content.text,
        "metadata": content.metadata,
    })

    # Step 6: Return preview
    return {
        "success": True,
        "preview": content.text[:500],
        "metadata": content.metadata,
    }
```

### 2. Format Detection

```python
import magic
from pathlib import Path

class FormatDetector:
    """
    Detect document format using MIME type + extension.
    """

    SUPPORTED_FORMATS = {
        # Documents
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/msword': 'doc',
        'text/plain': 'txt',
        'text/markdown': 'md',
        'application/rtf': 'rtf',
        'application/vnd.oasis.opendocument.text': 'odt',

        # Spreadsheets
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-excel': 'xls',
        'text/csv': 'csv',
        'application/vnd.oasis.opendocument.spreadsheet': 'ods',

        # Presentations
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.oasis.opendocument.presentation': 'odp',

        # Web
        'text/html': 'html',
        'application/xml': 'xml',
        'text/xml': 'xml',

        # Images (for OCR)
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/tiff': 'tiff',
        'image/bmp': 'bmp',
    }

    def __init__(self):
        self.mime = magic.Magic(mime=True)

    def detect(self, file_path: str, filename: str) -> str:
        """
        Detect format using MIME type + extension.

        Returns: format code (pdf, docx, txt, etc.)
        """
        # Detect MIME type
        mime_type = self.mime.from_file(file_path)

        # Get extension
        ext = Path(filename).suffix.lower()

        # Validate MIME type is supported
        if mime_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {mime_type}")

        # Validate extension matches MIME type
        detected_format = self.SUPPORTED_FORMATS[mime_type]
        expected_ext = f".{detected_format}"

        if ext != expected_ext and ext not in ['.jpeg', '.jpg', '.tif', '.tiff']:
            # Allow common aliases (jpeg/jpg, tif/tiff)
            raise ValueError(f"Extension mismatch: {ext} vs {expected_ext}")

        return detected_format
```

### 3. File Processing Router

```python
class FileProcessor:
    """
    Routes files to appropriate processors based on format.
    """

    def __init__(self):
        self.tika_service = TikaService()
        self.docling_service = DoclingService()
        self.pdf_service = PDFService()
        self.office_service = OfficeService()
        self.ocr_service = OCRService()
        self.text_service = TextService()

    async def process(
        self,
        file_path: str,
        file_format: str,
        options: dict
    ) -> DocumentContent:
        """
        Route to appropriate processor.

        Processing Strategy:
        1. Simple text formats → Native Python (fastest)
        2. Office docs → python-docx/openpyxl (specialized)
        3. PDFs → pdfplumber (table extraction) OR Docling (AI)
        4. Unknown/Complex → Apache Tika (universal)
        5. Scanned images/PDFs → OCR (Tesseract/Paddle)
        """

        # Route based on format
        if file_format in ['txt', 'md']:
            return await self.text_service.process(file_path, options)

        elif file_format == 'csv':
            return await self.text_service.process_csv(file_path, options)

        elif file_format == 'docx':
            return await self.office_service.process_docx(file_path, options)

        elif file_format == 'xlsx':
            return await self.office_service.process_xlsx(file_path, options)

        elif file_format == 'pptx':
            return await self.office_service.process_pptx(file_path, options)

        elif file_format == 'pdf':
            # Check if scanned (needs OCR)
            if await self.pdf_service.is_scanned(file_path):
                return await self.ocr_service.process_pdf(file_path, options)

            # Check if table extraction needed
            if options.get('extract_tables', True):
                return await self.pdf_service.process_with_tables(file_path, options)

            # Check if AI parsing needed
            if options.get('use_ai_parser', False):
                return await self.docling_service.process(file_path, options)

            # Default: Apache Tika
            return await self.tika_service.process(file_path, options)

        elif file_format in ['jpg', 'png', 'tiff', 'bmp']:
            return await self.ocr_service.process_image(file_path, options)

        else:
            # Unknown format → Apache Tika
            return await self.tika_service.process(file_path, options)
```

---

## Data Flow

### End-to-End Processing Flow

```
1. FILE UPLOAD
   ├─ User uploads file via API
   ├─ FastAPI receives multipart/form-data
   └─ Generate unique source_id

2. FORMAT DETECTION
   ├─ python-magic: Detect MIME type
   ├─ Validate against SUPPORTED_FORMATS
   ├─ Cross-check with file extension
   └─ Determine processing strategy

3. DOCUMENT PROCESSING
   ├─ Route to appropriate processor
   │  ├─ TXT/MD/CSV → Native Python
   │  ├─ DOCX/XLSX/PPTX → Office libraries
   │  ├─ PDF → Tika
   │  ├─ Images → OCR (Tesseract)
   │  └─ Unknown → Apache Tika
   │
   ├─ Extract content
   │  ├─ Text content
   │  ├─ Tables (if applicable)
   │  ├─ Images/diagrams (optional)
   │  └─ Metadata (author, date, etc.)
   │
   └─ Normalize output → DocumentContent schema

4. DRAFT STORAGE
   ├─ Store in Redis: draft:{draft_id}:sources
   ├─ TTL: 24 hours
   ├─ Include preview (first 500 chars)
   └─ Return to user for review/editing

5. USER APPROVAL
   ├─ User reviews content in UI
   ├─ Can edit/approve/reject
   └─ Triggers "Finalize"

6. FINALIZATION
   ├─ Create KB record in PostgreSQL
   ├─ Create Document placeholders
   ├─ Queue Celery task → RabbitMQ
   └─ Return pipeline_id for tracking

7. CELERY PROCESSING (Async)
   ├─ Worker picks task from queue
   │
   ├─ Re-process OR use approved content
   │  ├─ If user edited → use edited content
   │  └─ If not edited → use draft content
   │
   ├─ CHUNKING
   │  ├─ Strategy: by_heading, semantic, adaptive, hybrid, no_chunking
   │  ├─ Apply chunk configs with chunk preview: i.e Chunk size: 512-2048 tokens, chunk overlap, etc
   │  ├─ Overlap: 10-20%
   │  └─ Create Chunk records
   │
   ├─ EMBEDDING GENERATION
   │  ├─ Model: all-MiniLM-L6-v2 (CPU)
   │  ├─ Batch size: 32-64 chunks
   │  ├─ OpenVINO int8 quantization (4.5x speedup)
   │  └─ Generate 384D or 1024D vectors
   │
   ├─ VECTOR INDEXING
   │  ├─ Create Qdrant collection (if not exists)
   │  ├─ Batch insert: 100-500 vectors at a time
   │  ├─ Include metadata (source_id, page_number, etc.)
   │  └─ Wait for indexing confirmation
   │
   ├─ DATABASE UPDATE
   │  ├─ Update Document status → "ready"
   │  ├─ Save Chunk records to PostgreSQL
   │  ├─ Update KB statistics (total_chunks, total_tokens)
   │  └─ Update KB status → "ready"
   │
   └─ PROGRESS TRACKING
      ├─ Update Redis: pipeline:{id}:status
      ├─ Emit events: scraping, parsing, chunking, embedding, indexing
      └─ Frontend polls every 2 seconds

8. COMPLETION
   ├─ KB status: "ready"
   ├─ User can search/query
   └─ Cleanup temp files
```

---

## Format Support Matrix

### Supported Formats (15+ Categories)

| Category | Formats | Processor | Performance | Notes |
|----------|---------|-----------|-------------|-------|
| **Documents** | PDF | pdfplumber/Docling/Tika | 3-5s/100pg | Table extraction supported |
| | DOCX | python-docx | 1-2s | Styles, tables, images |
| | DOC | Tika | 2-3s | Legacy Word |
| | TXT | Native Python | <1s | Fastest |
| | MD | Native Python | <1s | Markdown preserved |
| | RTF | Tika | 1-2s | Rich Text Format |
| | ODT | Tika | 1-2s | OpenDocument |
| **Spreadsheets** | XLSX | openpyxl | 2-3s | All sheets, formulas |
| | XLS | Tika | 2-3s | Legacy Excel |
| | CSV | Native Python/pandas | <1s | Fastest |
| | TSV | Native Python/pandas | <1s | Tab-separated |
| | ODS | Tika | 2-3s | OpenDocument |
| **Presentations** | PPTX | python-pptx | 2-3s | Slides, notes |
| | PPT | Tika | 3-4s | Legacy PowerPoint |
| | ODP | Tika | 2-3s | OpenDocument |
| **Web** | HTML | Tika/BeautifulSoup | 1-2s | Structure preserved |
| | XML | Tika | 1-2s | Schema-aware |
| | MHTML | Tika | 2-3s | Web archives |
| **Images** | JPG/PNG/TIFF/BMP | OCR (Tesseract/Paddle) | 2-5s | Text extraction |
| | Scanned PDFs | OCR + pdfplumber | 5-10s | Combined approach |
| **E-books** | EPUB | Tika | 3-5s | Reflowable layout |
| | MOBI/AZW | Tika | 3-5s | Kindle formats |
| **Email** | EML | Tika | 1-2s | Attachments extracted |
| | MSG | Tika | 2-3s | Outlook |
| **Archives** | ZIP/TAR/RAR/7Z | Tika | Varies | Recursive extraction |

### Processing Time Estimates

**Single Document (100 pages):**
```
TXT/MD/CSV:           < 1 second
DOCX/XLSX/PPTX:       1-3 seconds
PDF (digital):        3-5 seconds
PDF (scanned, OCR):   10-30 seconds
Image (OCR):          2-5 seconds
Complex (archives):   5-15 seconds
```

**Throughput (Single Worker):**
```
Simple formats:       200+ docs/hour
Office formats:       100+ docs/hour
PDFs (digital):       60-100 docs/hour
PDFs (scanned):       20-40 docs/hour
```

**Scaling (Multiple Workers):**
```
3 workers:            300+ docs/hour
5 workers:            500+ docs/hour
10 workers:           1000+ docs/hour
```

---

## Performance Characteristics

### Embedding Generation Performance

**CPU-Only (Recommended Configuration):**
```python
Model: all-MiniLM-L6-v2
Optimization: OpenVINO int8 quantization
Hardware: Intel Xeon / AMD EPYC

Batch Size 32:
- Speed: 4.5x faster than baseline
- Throughput: ~1000 chunks/minute
- Latency: ~60ms per chunk
- Quality loss: <1% (negligible)

Batch Size 64:
- Throughput: ~1500 chunks/minute
- Latency: ~40ms per chunk
```

**GPU Configuration (Optional):**
```python
Model: BGE-large-en-v1.5
Hardware: Nvidia L4 / T4

Batch Size 64:
- Throughput: ~5000 chunks/minute
- Latency: ~12ms per chunk
- Quality: Best-in-class (64.23 avg score)
```

### OCR Performance

**Tesseract (CPU):**
```
Single page (A4): 2-3 seconds
100-page document: 3-5 minutes
Languages: 100+ supported
Quality: 90-95% accuracy (English)
```

**PaddleOCR (GPU):**
```
Single page (A4): 0.5-1 second
100-page document: 1-2 minutes
Languages: Multilingual (excellent for Chinese)
Quality: 95%+ accuracy (document scenarios)
```

### Vector Indexing Performance

**Qdrant:**
```
Batch insert (100 vectors): 50-100ms
Batch insert (500 vectors): 200-400ms
Search latency (1M vectors): 10-30ms
Search latency (10M vectors): 30-100ms
```

### End-to-End Latency

**Document Upload → KB Ready:**
```
Small doc (10 pages):     20-30 seconds
Medium doc (100 pages):   2-3 minutes
Large doc (500 pages):    10-15 minutes
Scanned PDF (100 pages):  5-10 minutes (OCR)
```

**Breakdown:**
```
Upload + validation:      1-2s
Format detection:         <1s
Document processing:      30-80% of total time
Chunking:                 5-10% of total time
Embedding generation:     10-20% of total time
Vector indexing:          5-10% of total time
Database updates:         <5% of total time
```

---

## Scaling Strategy

### Horizontal Scaling

**Worker Scaling:**
```yaml
# Scale by queue type
celery-file-processing:
  replicas: 3  # I/O bound (CPU not bottleneck)

celery-embeddings:
  replicas: 2  # CPU bound (benefit from more cores)

celery-indexing:
  replicas: 2  # CPU bound
```

**Auto-Scaling Rules:**
```
Queue depth > 100 tasks → Add worker
Queue depth < 10 tasks → Remove worker
CPU usage > 80% → Add embedding worker
Memory usage > 85% → Alert + investigate
```

### Vertical Scaling

**Resource Allocation:**
```yaml
# File processing workers
resources:
  cpu: "2"
  memory: "4Gi"

# Embedding workers (CPU-intensive)
resources:
  cpu: "4"
  memory: "8Gi"

# Indexing workers
resources:
  cpu: "2"
  memory: "4Gi"
```

### Load Balancing

**RabbitMQ Competitive Consumer Pattern:**
```
One queue, multiple workers
Broker delivers each message to one consumer only
Auto load-balancing across workers
Fair distribution with prefetch_multiplier=1
```

### Caching Strategy

**Model Caching:**
```yaml
# Cache embedding models
volumes:
  - models_cache:/root/.cache/huggingface

# Prevents re-downloading on worker restart
```

**Document Caching:**
```python
# Cache processed documents in Redis (optional)
cache_key = f"processed:{file_hash}"
cache_ttl = 3600  # 1 hour

if cached_content := redis.get(cache_key):
    return cached_content

content = process_document(file_path)
redis.setex(cache_key, cache_ttl, content)
```

---

## Security Considerations

### File Upload Security

**1. File Size Limits:**
```python
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_TOTAL_SIZE_PER_USER = 500 * 1024 * 1024  # 500 MB
```

**2. MIME Type Validation:**
```python
# Verify MIME type matches extension
detected_mime = magic.from_file(file_path, mime=True)
expected_mime = SUPPORTED_FORMATS.get(file_ext)

if detected_mime != expected_mime:
    raise SecurityError("MIME type mismatch")
```

**3. Virus Scanning (Optional):**
```python
# ClamAV integration
import pyclamd

cd = pyclamd.ClamdUnixSocket()
if not cd.ping():
    raise Exception("ClamAV not running")

scan_result = cd.scan_file(file_path)
if scan_result and scan_result[file_path][0] == 'FOUND':
    raise SecurityError(f"Virus detected: {scan_result[file_path][1]}")
```

**4. Sandboxed Processing:**
```python
# Process in isolated temp directory
with tempfile.TemporaryDirectory() as temp_dir:
    temp_path = Path(temp_dir) / sanitized_filename
    # Process file
    # Auto-cleanup on exit
```

**5. Input Sanitization:**
```python
import re

def sanitize_filename(filename: str) -> str:
    # Remove path traversal attempts
    filename = os.path.basename(filename)

    # Remove special characters
    filename = re.sub(r'[^\w\s.-]', '', filename)

    # Limit length
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext

    return filename
```

### Infrastructure Security

**1. Network Isolation:**
```yaml
# docker-compose.yml
networks:
  backend:
    internal: true  # No external access
  frontend:
    # Public-facing only for API gateway
```

**2. Secret Management:**
```bash
# Use Docker secrets or environment variables
docker secret create rabbitmq_password /run/secrets/rabbitmq_pwd

# Never commit secrets to Git
```

**3. Least Privilege:**
```dockerfile
# Run as non-root user
USER appuser
```

**4. Resource Limits:**
```yaml
# Prevent DoS via resource exhaustion
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

---

## Cost Analysis

### Self-Hosted vs Cloud API

#### Self-Hosted Stack (Recommended)
```
Hardware Requirements:
- CPU: 8 cores (Intel Xeon / AMD EPYC)
- RAM: 32 GB
- Storage: 500 GB SSD
- GPU: Optional (Nvidia T4/L4 for OCR)

Monthly Cost (AWS/GCP/Azure):
- Instance: $200-400/month (c5.2xlarge equivalent)
- Storage: $25-50/month (500GB SSD)
- Bandwidth: $20-100/month (depending on usage)
- TOTAL: $250-550/month

OR

On-Premises:
- Hardware: $3,000-5,000 (one-time)
- Electricity: $50-100/month
- TOTAL: $50-100/month (after amortization)
```

#### Cloud API (Unstructured.io)
```
Pricing: $29-99/month (limited) OR $0.10-0.50 per document
Volume (1000 docs/month): $100-500/month
Volume (10,000 docs/month): $1,000-5,000/month
Privacy: ⚠️ Data leaves infrastructure
```

**Verdict:** Self-hosted is 3-10x cheaper at scale + privacy-preserving

### Cost Breakdown (Self-Hosted)

**Infrastructure Costs:**
```
Server/Instance:     $200-400/month
Storage:             $25-50/month
Networking:          $20-100/month
Monitoring:          $20-50/month (Grafana, Prometheus)
Backups:             $10-30/month
TOTAL:               $275-630/month
```

**Operational Costs:**
```
DevOps time:         4-8 hours/month
Maintenance:         Minimal (Docker auto-updates)
Support:             Community (free)
```

**Per-Document Cost (at scale):**
```
1,000 docs/month:    $0.28-0.63 per document
10,000 docs/month:   $0.03-0.06 per document
100,000 docs/month:  $0.003-0.006 per document
```

---

## Monitoring & Observability

### Key Metrics to Track

**1. Document Processing:**
```python
metrics = {
    "documents_processed_total": Counter,
    "document_processing_duration_seconds": Histogram,
    "document_processing_errors_total": Counter,
    "documents_by_format": Counter,
}
```

**2. Queue Health:**
```python
metrics = {
    "queue_depth": Gauge,
    "queue_processing_rate": Gauge,
    "task_wait_time_seconds": Histogram,
}
```

**3. Embedding Performance:**
```python
metrics = {
    "embedding_generation_duration_seconds": Histogram,
    "embeddings_generated_total": Counter,
    "embedding_batch_size": Histogram,
}
```

**4. System Resources:**
```python
metrics = {
    "cpu_usage_percent": Gauge,
    "memory_usage_bytes": Gauge,
    "disk_usage_bytes": Gauge,
}
```

### Alerting Rules

```yaml
# Prometheus alerts
groups:
  - name: document_processing
    rules:
      - alert: HighQueueDepth
        expr: queue_depth > 100
        for: 5m
        annotations:
          summary: "Queue depth exceeds 100 tasks"

      - alert: HighErrorRate
        expr: rate(document_processing_errors_total[5m]) > 0.1
        annotations:
          summary: "Error rate > 10%"

      - alert: SlowProcessing
        expr: document_processing_duration_seconds > 300
        annotations:
          summary: "Document processing > 5 minutes"
```

---

## Next Steps

This architecture document should be followed by:

1. **Docker Setup Guide** - Complete docker-compose.yml with all services
2. **Implementation Guide** - Step-by-step code implementation
3. **Performance Optimization Guide** - Tuning parameters for production
4. **Testing & Monitoring Guide** - QA and observability setup

See the following documents in this directory for detailed implementation.

---

**Document Version:** 1.0
**Last Updated:** 2025-12-15
**Status:** Ready for Implementation
**Next Document:** `02_DOCKER_SETUP_GUIDE.md`