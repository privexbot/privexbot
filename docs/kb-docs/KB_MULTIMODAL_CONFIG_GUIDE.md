# Knowledge Base Multimodal Configuration Guide

This comprehensive guide covers PrivexBot's multimodal content handling capabilities, including OCR processing, image extraction, file format support, and best practices for different content types.

---

## Table of Contents

1. [Overview](#overview)
2. [Multimodal Architecture](#multimodal-architecture)
3. [Supported Content Types](#supported-content-types)
4. [OCR Configuration](#ocr-configuration)
5. [File Processing Pipeline](#file-processing-pipeline)
6. [Embedding Models](#embedding-models)
7. [Configuration Options](#configuration-options)
8. [Best Practices by Content Type](#best-practices-by-content-type)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Multimodal Processing?

Multimodal processing in PrivexBot refers to the ability to extract, process, and search content from various file formats including:

- **Text documents** (PDF, DOCX, TXT, Markdown)
- **Scanned documents** (PDF images, TIFF, PNG, JPG)
- **Spreadsheets** (XLSX, CSV)
- **Presentations** (PPTX)
- **Web content** (HTML with embedded images)

### Current Capabilities

| Capability | Status | Description |
|------------|--------|-------------|
| **Text Extraction** | Full | 15+ file formats supported |
| **OCR Processing** | Full | Tesseract-based, local processing |
| **Table Extraction** | Full | Structured data from PDFs/spreadsheets |
| **Image Text Extraction** | Full | OCR for images in documents |
| **Visual Embeddings** | Not Available | No CLIP/vision transformer support |
| **Image Search** | Not Available | Cannot search by visual similarity |

### Privacy-First Approach

All multimodal processing happens **locally** within Docker containers:
- No external API calls for OCR
- No cloud-based vision services
- All content stays within your infrastructure

---

## Multimodal Architecture

### Processing Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FILE UPLOAD                                  │
│  (PDF, DOCX, XLSX, Images, etc.)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MIME TYPE DETECTION                          │
│  python-magic library for accurate content-based detection       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     COMPLEXITY ANALYSIS                          │
│  ────────────────────────────────────────────────────────────── │
│  • Fast types (TXT, CSV, JSON): 2-3s processing                 │
│  • Moderate types (Office docs): 5s + 1.5x multiplier           │
│  • High complexity (PDFs with images): 10s + 3-4x multiplier    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APACHE TIKA PROCESSING                       │
│  ────────────────────────────────────────────────────────────── │
│  • Text extraction via /rmeta/text endpoint                      │
│  • OCR via Tesseract (if enabled)                               │
│  • Metadata extraction (author, dates, page count)              │
│  • Table structure preservation                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONTENT NORMALIZATION                        │
│  ────────────────────────────────────────────────────────────── │
│  • Remove excessive whitespace                                   │
│  • Normalize consecutive newlines                               │
│  • Clean OCR artifacts                                          │
│  • Quality check (warn if < 10 characters)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TEXT EMBEDDING                               │
│  sentence-transformers (local, CPU-optimized)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     QDRANT VECTOR STORAGE                        │
│  Searchable with semantic, keyword, or hybrid search            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File Location | Purpose |
|-----------|---------------|---------|
| Tika Service | `backend/src/app/services/tika_service.py` | Universal document parsing |
| OCR Service | `backend/src/app/services/ocr_service.py` | Optical character recognition |
| File Adapter | `backend/src/app/adapters/file_upload_adapter.py` | Format-specific handling |
| Content Enhancement | `backend/src/app/services/content_enhancement_service.py` | Clean and optimize content |
| Embedding Service | `backend/src/app/services/embedding_service_local.py` | Text-to-vector conversion |

---

## Supported Content Types

### Document Formats (15+ Types)

#### Text Documents
| Format | Extension | OCR Needed | Processing Time | Best For |
|--------|-----------|------------|-----------------|----------|
| Plain Text | .txt | No | Fast (2-3s) | Simple text content |
| Markdown | .md | No | Fast (2-3s) | Documentation, notes |
| JSON | .json | No | Fast (2-3s) | Structured data |
| XML | .xml | No | Fast (2-3s) | Configuration, data |
| HTML | .html | No | Fast (3-5s) | Web content |

#### Office Documents
| Format | Extension | OCR Needed | Processing Time | Best For |
|--------|-----------|------------|-----------------|----------|
| Word | .docx, .doc | No | Moderate (5-8s) | Reports, manuals |
| PowerPoint | .pptx, .ppt | No | Moderate (5-10s) | Presentations |
| OpenDocument | .odt, .odp | No | Moderate (5-8s) | Cross-platform docs |
| Rich Text | .rtf | No | Moderate (4-6s) | Formatted text |

#### Spreadsheets
| Format | Extension | OCR Needed | Processing Time | Best For |
|--------|-----------|------------|-----------------|----------|
| Excel | .xlsx, .xls | No | Moderate (5-10s) | Data, tables |
| CSV | .csv | No | Fast (2-4s) | Tabular data |
| OpenDocument | .ods | No | Moderate (5-8s) | Spreadsheets |

#### PDFs
| Type | OCR Needed | Processing Time | Notes |
|------|------------|-----------------|-------|
| Text-based PDF | No | Moderate (8-12s) | Native text extraction |
| Scanned PDF | Yes | High (30-60s) | OCR required, 3x timeout |
| Mixed PDF | Partial | High (20-40s) | OCR for image pages |

#### Images
| Format | Extension | Processing Time | Notes |
|--------|-----------|-----------------|-------|
| PNG | .png | High (10-15s) | OCR for text extraction |
| JPEG | .jpg, .jpeg | High (10-15s) | OCR for text extraction |
| TIFF | .tiff, .tif | High (15-20s) | Multi-page support |
| BMP | .bmp | High (10-15s) | Basic image format |

### File Size Limits

| Category | Limit | Notes |
|----------|-------|-------|
| Single file | 100 MB | Hard limit |
| Recommended | < 20 MB | Best performance |
| Large files | 20-50 MB | Warning displayed |
| Very large | > 50 MB | Suggest splitting |

---

## OCR Configuration

### What is OCR?

Optical Character Recognition (OCR) converts images of text into machine-readable text. PrivexBot uses **Tesseract OCR** running inside the Apache Tika Docker container.

### When OCR is Used

OCR is automatically triggered for:
- Scanned PDF documents
- Image files (PNG, JPG, TIFF, BMP)
- PDF pages containing embedded images instead of text

### OCR Settings

#### Frontend Toggle

Located in the file upload configuration:

```typescript
{
  ocr_enabled: true,        // Default: enabled
  language: 'auto',         // Auto-detect language
  extract_tables: true,     // Extract table structures
  preserve_formatting: true // Maintain document structure
}
```

#### Backend Configuration

```python
# TikaConfig (tika_service.py)
TikaConfig(
    url="http://tika:9998",
    base_timeout=30,           # Base timeout in seconds
    timeout_per_100kb=1.0,     # Additional time per 100KB
    ocr_multiplier=3.0,        # Multiplier for OCR files
    max_timeout=600,           # Maximum 10 minutes
    max_file_size_mb=100,      # 100MB limit
    ocr_enabled=True           # OCR toggle
)

# OCRConfig (ocr_service.py)
OCRConfig(
    enabled=False,             # Disabled by default in service
    max_image_size=(1920, 1080),
    enhance_image=True,
    language='eng',
    psm_mode=3,                # Tesseract page segmentation mode
    min_confidence=30.0,       # Minimum OCR confidence
    min_text_length=10,
    max_images_per_page=10,
    timeout_seconds=30
)
```

### OCR Image Enhancement

Before OCR processing, images are enhanced:

1. **Grayscale conversion** - Remove color noise
2. **Contrast enhancement** (1.5x) - Improve text visibility
3. **Sharpness enhancement** (2.0x) - Clearer edges
4. **Median filter** - Reduce noise
5. **Optional resizing** - Max 1920x1080

### Supported Languages

| Code | Language |
|------|----------|
| `eng` | English (default) |
| `spa` | Spanish |
| `fra` | French |
| `deu` | German |
| `ita` | Italian |
| `por` | Portuguese |
| `auto` | Auto-detect |

### OCR Quality Considerations

| Factor | Impact | Recommendation |
|--------|--------|----------------|
| Image resolution | Higher = better OCR | 300 DPI minimum |
| Text contrast | Higher = better accuracy | Black text on white |
| Font type | Clear fonts = better | Avoid decorative fonts |
| Skew/rotation | Affects accuracy | Scan documents straight |
| Handwriting | Poor recognition | Type content if possible |

---

## File Processing Pipeline

### Stage 1: File Upload & Validation

```
User uploads file
        │
        ▼
┌─────────────────────────────────────┐
│ MIME Type Detection                 │
│ • python-magic content analysis     │
│ • Extension verification            │
│ • Size validation (< 100MB)         │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Complexity Analysis                 │
│ • Detect if OCR needed              │
│ • Calculate timeout multiplier      │
│ • Estimate processing time          │
└─────────────────────────────────────┘
```

### Stage 2: Content Extraction

```
Validated file
        │
        ▼
┌─────────────────────────────────────┐
│ Apache Tika Processing              │
│ • Text extraction                   │
│ • OCR (if enabled and needed)       │
│ • Metadata extraction               │
│ • Table structure preservation      │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Content Normalization               │
│ • Remove OCR artifacts              │
│ • Normalize whitespace              │
│ • Clean special characters          │
│ • Merge fragmented text             │
└─────────────────────────────────────┘
```

### Stage 3: Content Processing

```
Normalized content
        │
        ▼
┌─────────────────────────────────────┐
│ Chunking                            │
│ • Apply selected strategy           │
│ • Preserve code blocks              │
│ • Add enhanced metadata             │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Embedding Generation                │
│ • sentence-transformers model       │
│ • Batch processing (32 chunks)      │
│ • 384/768 dimensional vectors       │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Vector Storage (Qdrant)             │
│ • Store embeddings                  │
│ • Index metadata                    │
│ • Enable search                     │
└─────────────────────────────────────┘
```

### Timeout Calculation

Timeouts are calculated dynamically based on file characteristics:

```python
# Base timeout formula
base_timeout = 30  # seconds

# Size-based addition
size_addition = file_size_kb / 100 * 1.0  # 1s per 100KB

# OCR multiplier (if applicable)
if needs_ocr:
    multiplier = 3.0
else:
    multiplier = 1.0

# Final timeout (capped at 600s)
timeout = min(600, (base_timeout + size_addition) * multiplier)
```

**Example Calculations:**

| File | Size | OCR | Calculation | Timeout |
|------|------|-----|-------------|---------|
| Text file | 100KB | No | (30 + 1) × 1 | 31s |
| Word doc | 2MB | No | (30 + 20) × 1 | 50s |
| Scanned PDF | 5MB | Yes | (30 + 50) × 3 | 240s |
| Large image | 10MB | Yes | (30 + 100) × 3 | 390s |

---

## Embedding Models

### Available Models

All embeddings use **sentence-transformers** running locally on CPU:

| Model | Dimensions | Max Tokens | Speed | Quality | Size |
|-------|------------|------------|-------|---------|------|
| **all-MiniLM-L6-v2** (Default) | 384 | 256 | Fast | Good | 90 MB |
| all-MiniLM-L12-v2 | 384 | 256 | Medium | Better | 120 MB |
| all-mpnet-base-v2 | 768 | 384 | Slow | Best | 420 MB |
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | 128 | Medium | Good | 470 MB |

### Model Selection Guide

| Use Case | Recommended Model | Why |
|----------|-------------------|-----|
| General purpose | all-MiniLM-L6-v2 | Best speed/quality balance |
| Quality-critical | all-mpnet-base-v2 | Highest accuracy |
| Multi-language | paraphrase-multilingual | 50+ language support |
| Resource-limited | all-MiniLM-L6-v2 | Smallest footprint |

### Embedding Configuration

```typescript
// Frontend configuration (KBModelConfig.tsx)
embedding: {
  provider: 'local',           // Local sentence-transformers
  model: 'all-MiniLM-L6-v2',   // Model name
  dimensions: 384,              // Vector dimensions
  batch_size: 32               // Chunks per batch (8-128)
}
```

### Important Notes

1. **Text-Only Embeddings**: All models process text only. Images are converted to text via OCR before embedding.

2. **Model Consistency**: The same model MUST be used for both indexing and querying. Mismatched models will produce poor search results.

3. **No Visual Embeddings**: PrivexBot does not support CLIP or vision transformers. You cannot search for "images similar to X."

---

## Configuration Options

### File Upload Options

| Option | Default | Description |
|--------|---------|-------------|
| `ocr_enabled` | true | Enable OCR for scanned content |
| `file_type` | 'auto' | Auto-detect file type |
| `extract_tables` | true | Preserve table structures |
| `preserve_formatting` | true | Maintain document structure |
| `split_pages` | false | Create separate chunks per page |
| `language` | 'auto' | OCR language detection |

### Processing Options

| Option | Default | Description |
|--------|---------|-------------|
| `enhance_image` | true | Apply image enhancement before OCR |
| `max_image_size` | 1920x1080 | Resize large images |
| `min_confidence` | 30% | Minimum OCR confidence threshold |
| `timeout_seconds` | 30 | Per-image OCR timeout |

### Chunking for Multimodal Content

Different content types benefit from different chunking strategies:

| Content Type | Recommended Strategy | Chunk Size | Why |
|--------------|---------------------|------------|-----|
| Scanned docs | by_heading | 1500 | Preserves document structure |
| Mixed PDFs | adaptive | 1000 | Auto-adjusts to content |
| Data tables | no_chunking | - | Keep tables intact |
| Long forms | paragraph_based | 800 | Natural form sections |
| Images with text | no_chunking | - | Keep OCR text together |

---

## Best Practices by Content Type

### Scanned Documents (PDFs, TIFFs)

**Challenge:** OCR accuracy, processing time

**Recommendations:**

1. **Ensure quality scans**
   - 300 DPI minimum resolution
   - Black text on white background
   - Scan documents straight (no skew)

2. **Configure appropriately**
   ```typescript
   {
     ocr_enabled: true,
     language: 'eng',  // or specific language
     preserve_formatting: true
   }
   ```

3. **Use appropriate chunking**
   - `by_heading` for structured documents
   - `no_chunking` for short forms
   - `paragraph_based` for continuous text

4. **Expect longer processing**
   - 30-60 seconds for typical scanned PDF
   - Up to 10 minutes for large documents

### Mixed PDFs (Text + Images)

**Challenge:** Some pages are text, some are scanned

**Recommendations:**

1. **Enable OCR for all**
   - Tika automatically detects which pages need OCR
   - Text pages process quickly, image pages use OCR

2. **Use adaptive chunking**
   ```typescript
   {
     strategy: 'adaptive',
     chunk_size: 1000,
     chunk_overlap: 200
   }
   ```

3. **Review extracted content**
   - Use content preview to verify OCR quality
   - Edit content if OCR made errors

### Spreadsheets (XLSX, CSV)

**Challenge:** Preserving tabular structure

**Recommendations:**

1. **Keep tables intact**
   ```typescript
   {
     strategy: 'no_chunking',
     extract_tables: true
   }
   ```

2. **Multi-sheet handling**
   - Each sheet processed separately
   - Sheet names preserved in metadata

3. **Column headers**
   - First row typically treated as headers
   - Headers included in each chunk

### Presentations (PPTX)

**Challenge:** Slide structure, speaker notes

**Recommendations:**

1. **Preserve slide structure**
   ```typescript
   {
     preserve_formatting: true,
     split_pages: false  // or true for per-slide chunks
   }
   ```

2. **Speaker notes**
   - Notes are extracted along with slide content
   - Consider if notes should be searchable

### Images with Text

**Challenge:** OCR accuracy, layout preservation

**Recommendations:**

1. **High-resolution images**
   - 300 DPI or higher
   - Clear, readable text

2. **Preprocessing**
   - Image enhancement is automatic
   - Consider preprocessing heavily stylized images

3. **Keep together**
   ```typescript
   {
     strategy: 'no_chunking'  // Keep OCR text together
   }
   ```

### Web Content with Images

**Challenge:** Image references vs. image content

**Recommendations:**

1. **Current behavior**
   - Images extracted as references (URLs, alt text)
   - Image content NOT embedded visually

2. **To include image text**
   - Save webpage as PDF
   - Upload PDF with OCR enabled
   - This extracts visible text from images

---

## Performance Considerations

### Processing Time Estimates

| Content Type | Size | Expected Time |
|--------------|------|---------------|
| Plain text | 10KB | 2-3 seconds |
| Word document | 1MB | 5-8 seconds |
| Text PDF | 5MB | 8-12 seconds |
| Scanned PDF | 5MB | 30-60 seconds |
| Image (OCR) | 2MB | 10-15 seconds |
| Excel (10 sheets) | 1MB | 5-10 seconds |

### Optimization Tips

1. **Split large documents**
   - Break 100+ page PDFs into sections
   - Process separately, add to same KB

2. **Pre-process scanned docs**
   - Use document scanner apps for better quality
   - Ensure consistent orientation

3. **Choose appropriate models**
   - MiniLM-L6 for speed (90% of use cases)
   - MPNet only when quality is critical

4. **Batch similar files**
   - Process all PDFs together
   - Process all spreadsheets together
   - Consistent processing settings

### Resource Usage

| Resource | Usage Pattern | Notes |
|----------|---------------|-------|
| CPU | High during OCR | Tesseract is CPU-intensive |
| Memory | Moderate (1-2GB) | Per document processing |
| Disk | Temporary | Extracted content before storage |
| Network | Minimal | All processing is local |

---

## Troubleshooting

### OCR Not Working

**Symptoms:** No text extracted from scanned documents

**Solutions:**

1. **Verify OCR is enabled**
   - Check file upload configuration
   - Ensure `ocr_enabled: true`

2. **Check Tika container**
   ```bash
   docker ps | grep tika
   # Should show apache/tika:latest-full running
   ```

3. **Verify image quality**
   - Resolution too low (< 150 DPI)
   - Poor contrast
   - Skewed or rotated text

4. **Check timeouts**
   - Large scanned files may timeout
   - Consider splitting document

### Poor OCR Quality

**Symptoms:** Text extracted but with errors

**Solutions:**

1. **Improve source quality**
   - Higher resolution scan
   - Better contrast
   - Cleaner document

2. **Specify language**
   - Set explicit language instead of auto
   - Helps with special characters

3. **Manual correction**
   - Use content preview to review
   - Edit extracted text before finalizing

### Slow Processing

**Symptoms:** Files take very long to process

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Large file size | Split into smaller files |
| Many images/pages | Process in batches |
| Complex layout | Simplify if possible |
| OCR overhead | Consider if OCR is needed |

### File Not Supported

**Symptoms:** "Unsupported file type" error

**Solutions:**

1. **Check file extension**
   - Must match actual content
   - Rename if extension is wrong

2. **Check MIME type**
   - File may be corrupted
   - Try re-exporting from source

3. **Verify file size**
   - Must be < 100MB
   - Split if larger

### Content Missing After Processing

**Symptoms:** Some content not in KB

**Solutions:**

1. **Check chunking strategy**
   - `no_chunking` for short documents
   - Verify chunk size isn't too large

2. **Review content preview**
   - Content may be there but formatted differently
   - OCR may have skipped sections

3. **Check for warnings**
   - Processing logs may show skipped sections
   - Quality warnings for low-confidence OCR

---

## Quick Reference

### Recommended Settings by Document Type

| Document Type | OCR | Chunking | Chunk Size |
|---------------|-----|----------|------------|
| Text PDF | Off | by_heading | 1000 |
| Scanned PDF | On | adaptive | 1500 |
| Word docs | Off | paragraph_based | 1000 |
| Spreadsheets | Off | no_chunking | - |
| Presentations | Off | by_heading | 1200 |
| Images | On | no_chunking | - |
| Mixed content | On | adaptive | 1000 |

### Processing Time Quick Guide

```
Text files:      ██ 2-5 seconds
Office docs:     ████ 5-10 seconds
PDFs (text):     ██████ 10-20 seconds
PDFs (scanned):  ██████████████████ 30-60 seconds
Images (OCR):    ████████████ 10-20 seconds
```

### When to Use OCR

| Content | Use OCR? |
|---------|----------|
| Native PDF text | No |
| Scanned documents | Yes |
| Image files with text | Yes |
| Screenshots | Yes |
| Handwritten notes | Limited success |
| Typed forms | Yes |

---

## Related Documentation

- [KB Creation Guide](./KB_CREATION_GUIDE.md) - Complete KB creation workflow
- [KB File Upload Guide](./KB_FILE_UPLOAD_GUIDE.md) - File upload processing
- [KB Chunking Strategies Guide](./KB_CHUNKING_STRATEGIES_GUIDE.md) - Chunking configuration
- [KB Retrieval Config Guide](./KB_RETRIEVAL_CONFIG_GUIDE.md) - Search configuration

---

*Last Updated: December 2024*
*PrivexBot Knowledge Base System v1.0*
