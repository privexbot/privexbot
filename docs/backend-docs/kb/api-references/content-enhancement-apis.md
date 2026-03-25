# Content Enhancement APIs

**New Features**: Content Enhancement and Optimization

The Content Enhancement APIs provide intelligent content processing, OCR text extraction, and strategy recommendations to improve Knowledge Base quality and effectiveness. These features are automatically integrated into the KB pipeline and also available as standalone endpoints.

## Overview

- **Base Path**: `/api/v1/content-enhancement`
- **Performance**: <500ms for content processing, 2-10s for OCR
- **Purpose**: Improve content quality and extraction completeness
- **Integration**: Automatic in KB pipeline + standalone APIs

## Authentication

All endpoints require authentication:
```http
Authorization: Bearer <jwt_token>
```

## Service Health

### Health Check

Check availability of all enhancement services.

```http
GET /api/v1/content-enhancement/health
```

**Response (200 OK):**
```json
{
  "services": {
    "content_enhancement": {
      "available": true,
      "status": "healthy"
    },
    "ocr": {
      "available": false,
      "status": "dependencies_missing"
    },
    "strategy_recommendation": {
      "available": true,
      "status": "healthy"
    }
  },
  "overall_status": "healthy",
  "checked_at": "2024-11-19T15:45:00Z",
  "backward_compatibility": "maintained"
}
```

**Service Statuses:**
- `healthy`: Service fully operational
- `degraded`: Service available with limitations
- `dependencies_missing`: Optional dependencies not installed
- `error`: Service not available

## Content Enhancement

### Enhance Content

Clean and optimize text content for better KB quality.

```http
POST /api/v1/content-enhancement/enhance-content
```

**Request Body:**
```json
{
  "content": "🎉 Welcome to our API! 😍 Check out these links: https://tracker.example.com/ad?ref=123 and https://analytics.company.com/pixel. This is great content! This is great content!",
  "url": "https://docs.example.com/introduction",
  "remove_emojis": true,
  "filter_unwanted_links": true,
  "enable_deduplication": true,
  "normalize_whitespace": true,
  "merge_short_lines": true
}
```

**Request Parameters:**
- `content` (string, required): Raw content to enhance
- `url` (string, optional): Source URL for context
- `remove_emojis` (bool, default=true): Remove emoji characters
- `filter_unwanted_links` (bool, default=true): Remove tracking/ad links
- `enable_deduplication` (bool, default=true): Remove duplicate content blocks
- `normalize_whitespace` (bool, default=true): Normalize whitespace
- `merge_short_lines` (bool, default=true): Merge fragmented lines

**Response (200 OK):**
```json
{
  "enhanced_content": "Welcome to our API! Check out these links: mailto:info@example.com. This is great content!",
  "enhancement_stats": {
    "original_length": 204,
    "enhanced_length": 98,
    "emojis_removed": 3,
    "links_filtered": 2,
    "duplicates_removed": 1,
    "improvement_score": 0.75
  },
  "metadata": {
    "processed_at": "2024-11-19T15:45:00Z",
    "config_applied": {
      "remove_emojis": true,
      "filter_unwanted_links": true,
      "enable_deduplication": true,
      "normalize_whitespace": true,
      "merge_short_lines": true
    },
    "enhancement_applied": true
  }
}
```

### Enhancement Features

#### 1. Emoji Removal
Removes Unicode emoji characters that can interfere with text processing:
- Standard emojis (😍, 🎉, 🚀)
- Symbol emojis (⭐, ✅, ❌)
- Skin tone modifiers
- Preserves essential symbols (arrows, mathematical symbols)

#### 2. Link Filtering
Removes unwanted tracking and advertising links:
- Analytics trackers (`analytics.`, `ga.`, `gtm.`)
- Ad networks (`doubleclick.`, `googlesyndication.`)
- Tracking parameters (`utm_`, `ref=`, `track=`)
- Preserves useful links (documentation, resources)

#### 3. Content Deduplication
Identifies and removes duplicate content blocks:
- Exact text duplicates
- Similar content with minor variations
- Repeated phrases and sentences
- Preserves intentional repetition (headings, emphasis)

#### 4. Whitespace Normalization
Standardizes spacing and formatting:
- Multiple spaces → single space
- Multiple newlines → double newline
- Tab characters → spaces
- Trailing whitespace removal

#### 5. Line Merging
Merges fragmented text lines:
- PDF extraction artifacts
- Broken sentences across lines
- Hyphenated words at line breaks
- Preserves intentional line breaks (code, lists)

**Error Responses:**
- `503 Service Unavailable`: Content enhancement service not available
- `500 Internal Server Error`: Content enhancement failed

## OCR Text Extraction

### Extract Image Text

Extract text from images using OCR (Optical Character Recognition).

```http
POST /api/v1/content-enhancement/extract-image-text
```

**Request Body:**
```json
{
  "content": "![API Diagram](https://docs.example.com/images/api-flow.png)\n\nThe diagram above shows...",
  "url": "https://docs.example.com/introduction",
  "enabled": true,
  "max_images": 10,
  "min_confidence": 50.0,
  "language": "eng"
}
```

**Request Parameters:**
- `content` (string, required): Content with image references (markdown/HTML)
- `url` (string, optional): Source URL for resolving relative images
- `enabled` (bool, default=true): Enable OCR processing
- `max_images` (int, default=10): Maximum images to process (1-50)
- `min_confidence` (float, default=30.0): Minimum confidence threshold (0.0-100.0)
- `language` (string, default="eng"): OCR language code

**Supported Languages:**
- `eng`: English
- `fra`: French
- `deu`: German
- `spa`: Spanish
- `por`: Portuguese
- `rus`: Russian
- `chi_sim`: Chinese Simplified
- `jpn`: Japanese

**Response (200 OK):**
```json
{
  "enhanced_content": "![API Diagram](https://docs.example.com/images/api-flow.png)\n\nThe diagram above shows...\n\n---\n\n# Extracted Image Text\n\n## Image 1 Text Content\n\n**Source:** https://docs.example.com/images/api-flow.png\n**Confidence:** 87.5%\n\nAPI Request → Authentication → Rate Limiting → Processing → Response",
  "ocr_results": [
    {
      "image_url": "https://docs.example.com/images/api-flow.png",
      "extracted_text": "API Request → Authentication → Rate Limiting → Processing → Response",
      "confidence_score": 87.5,
      "processing_time": 2.3,
      "image_size": [800, 400],
      "success": true,
      "error_message": null
    }
  ],
  "ocr_stats": {
    "images_processed": 1,
    "successful_extractions": 1,
    "total_text_extracted": 68,
    "average_confidence": 87.5
  },
  "metadata": {
    "processed_at": "2024-11-19T15:45:00Z",
    "ocr_config": {
      "enabled": true,
      "max_images_per_page": 10,
      "min_confidence": 50.0,
      "language": "eng"
    },
    "ocr_available": true
  }
}
```

### OCR Configuration Options

#### Image Processing
- `max_image_size`: Maximum dimensions (default: 1920x1080)
- `enhance_image`: Apply preprocessing for better OCR (default: true)
- `supported_formats`: jpg, jpeg, png, gif, bmp, tiff

#### OCR Settings
- `psm_mode`: Page segmentation mode (0-13, default: 3)
- `language`: Tesseract language codes
- `min_confidence`: Filter low-confidence results

#### Content Filtering
- `min_text_length`: Minimum extracted text length (default: 10)
- `filter_noise`: Remove noisy OCR artifacts (default: true)

**Error Responses:**
- `503 Service Unavailable`: OCR service not available (pytesseract not installed)
- `500 Internal Server Error`: OCR processing failed

### OCR Image Enhancement

The service automatically enhances images for better OCR accuracy:

1. **Grayscale Conversion**: Convert to grayscale for better text recognition
2. **Contrast Enhancement**: Increase contrast by 1.5x
3. **Sharpness Enhancement**: Improve text clarity with 2.0x sharpening
4. **Noise Reduction**: Apply median filter to reduce noise
5. **Size Optimization**: Resize large images to optimal dimensions

## Strategy Recommendations

### Get Strategy Recommendation

Get intelligent chunking strategy recommendations based on content analysis.

```http
POST /api/v1/content-enhancement/recommend-strategy
```

**Request Body:**
```json
{
  "content": "# API Documentation\n\n## Authentication\n\nOur API uses JWT tokens for authentication...\n\n## Endpoints\n\n### GET /users\n\nRetrieve user information...",
  "url": "https://docs.example.com/api-reference"
}
```

**Request Parameters:**
- `content` (string, required): Content to analyze
- `url` (string, optional): Source URL for additional context

**Response (200 OK):**
```json
{
  "recommended_strategy": {
    "strategy": "by_heading",
    "chunk_size": 1200,
    "chunk_overlap": 150,
    "max_pages": 100,
    "max_depth": 4
  },
  "content_analysis": {
    "content_type": "documentation",
    "structure_score": 0.85,
    "complexity_score": 0.62,
    "heading_count": 15,
    "heading_density": 0.12,
    "code_density": 0.25,
    "avg_paragraph_length": 89,
    "total_characters": 5432
  },
  "recommendation_reasoning": "Content type detected: documentation. Structure score: 0.85/1.0. High heading density (0.12) indicates well-structured documentation. Moderate code density (0.25) suggests technical content. Recommended strategy: by_heading with larger chunks (1200) to preserve context.",
  "alternative_strategies": {
    "documentation": "by_heading - Best for structured docs",
    "blog_content": "paragraph_based - Best for articles",
    "code_content": "by_section - Best for repositories",
    "academic": "semantic - Best for papers",
    "mixed_content": "adaptive - Best for unknown types"
  },
  "metadata": {
    "analyzed_at": "2024-11-19T15:45:00Z",
    "service_available": true
  }
}
```

### Content Types and Strategies

#### Content Type Detection
- **Documentation**: Structured with headings, moderate complexity
- **Blog**: Narrative flow, lower structure, higher readability
- **Code Repository**: High code density, technical documentation
- **Academic Paper**: Complex structure, formal language, citations
- **Tutorial**: Step-by-step instructions, mixed content types
- **News Article**: Inverted pyramid structure, time-sensitive
- **Reference Manual**: High information density, lookup-focused
- **Forum Discussion**: Conversational, thread-based structure

#### Strategy Mapping
```json
{
  "documentation": {
    "preferred_strategy": "by_heading",
    "chunk_size": 1200,
    "chunk_overlap": 150,
    "reasoning": "Preserve hierarchical structure and context"
  },
  "blog": {
    "preferred_strategy": "paragraph_based",
    "chunk_size": 800,
    "chunk_overlap": 100,
    "reasoning": "Maintain narrative flow and readability"
  },
  "code_repository": {
    "preferred_strategy": "by_section",
    "chunk_size": 1500,
    "chunk_overlap": 200,
    "reasoning": "Keep code blocks and explanations together"
  },
  "academic_paper": {
    "preferred_strategy": "semantic",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "reasoning": "Preserve logical argument structure"
  }
}
```

**Error Responses:**
- `503 Service Unavailable`: Strategy recommendation service not available
- `500 Internal Server Error`: Strategy recommendation failed

---

### List Strategy Presets

Get all available strategy presets and configurations.

```http
GET /api/v1/content-enhancement/presets
```

**Response (200 OK):**
```json
{
  "presets": {
    "documentation": {
      "chunking_strategy": "by_heading",
      "chunk_size": 1200,
      "chunk_overlap": 150,
      "max_pages": 100,
      "max_depth": 4,
      "content_enhancement": {
        "remove_emojis": true,
        "filter_unwanted_links": true,
        "enable_deduplication": true,
        "normalize_whitespace": true,
        "merge_short_lines": true
      },
      "description": "Optimized for structured documentation with clear hierarchy",
      "use_cases": ["API docs", "User guides", "Technical manuals"]
    },
    "blog": {
      "chunking_strategy": "paragraph_based",
      "chunk_size": 800,
      "chunk_overlap": 100,
      "max_pages": 50,
      "max_depth": 2,
      "content_enhancement": {
        "remove_emojis": false,
        "filter_unwanted_links": true,
        "enable_deduplication": true,
        "normalize_whitespace": true,
        "merge_short_lines": false
      },
      "description": "Optimized for narrative content and articles",
      "use_cases": ["Blog posts", "News articles", "Stories"]
    },
    "code_repository": {
      "chunking_strategy": "by_section",
      "chunk_size": 1500,
      "chunk_overlap": 200,
      "max_pages": 200,
      "max_depth": 5,
      "content_enhancement": {
        "remove_emojis": true,
        "filter_unwanted_links": true,
        "enable_deduplication": false,
        "normalize_whitespace": false,
        "merge_short_lines": false
      },
      "description": "Optimized for code repositories and technical content",
      "use_cases": ["GitHub repos", "Code documentation", "README files"]
    }
  },
  "content_types": [
    "documentation",
    "blog",
    "code_repository",
    "academic_paper",
    "tutorial",
    "news_article",
    "reference_manual",
    "forum_discussion",
    "product_specs",
    "unknown"
  ],
  "metadata": {
    "total_presets": 9,
    "service_available": true
  }
}
```

## Enhanced Preview

### Enhanced Content Preview

Get comprehensive preview with all enhancement features applied.

```http
POST /api/v1/content-enhancement/enhanced-preview
```

**Request Body:**
```json
{
  "url": "https://docs.scrt.network/secret-network-documentation/introduction/secret-network-techstack/consensus-for-secret-transactions",
  "apply_enhancement": true,
  "apply_ocr": false,
  "auto_strategy": true,
  "strategy": "adaptive",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "max_preview_chunks": 3
}
```

**Request Parameters:**
- `url` (HttpUrl, required): URL to preview
- `apply_enhancement` (bool, default=true): Apply content enhancement
- `apply_ocr` (bool, default=false): Apply OCR to images
- `auto_strategy` (bool, default=true): Use intelligent strategy recommendation
- `strategy` (string, optional): Manual strategy override
- `chunk_size` (int, default=1000): Chunk size (100-5000)
- `chunk_overlap` (int, default=200): Chunk overlap (0-1000)
- `max_preview_chunks` (int, default=3): Maximum chunks to preview (1-10)

**Response (200 OK):**
```json
{
  "url": "https://docs.scrt.network/secret-network-documentation/introduction/secret-network-techstack/consensus-for-secret-transactions",
  "title": "Consensus for Secret Transactions",
  "strategy": "adaptive",
  "config": {
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "strategy": "by_heading"
  },
  "preview_chunks": [
    {
      "index": 0,
      "content": "# Consensus for Secret Transactions\n\nSecret Network uses a modified version of...",
      "word_count": 145,
      "character_count": 987,
      "full_length": 987
    }
  ],
  "total_chunks_estimated": 13,
  "document_stats": {
    "word_count": 2134,
    "character_count": 14562,
    "estimated_reading_time": "9 minutes"
  },
  "content_enhancement": {
    "applied": true,
    "original_length": 12983,
    "enhanced_length": 12639,
    "emojis_removed": 0,
    "links_filtered": 0,
    "duplicates_removed": 0,
    "improvement_score": 0.50
  },
  "intelligent_analysis": {
    "content_type_detected": "documentation",
    "structure_score": 0.30,
    "complexity_score": 0.45,
    "recommended_strategy": "by_heading",
    "reasoning": "Content type detected: documentation. Structure score: 0.30/1.0. Complexity score: 0.45/1.0. Recommended strategy: by_heading for hierarchical content organization."
  },
  "image_ocr": {
    "applied": false,
    "images_found": 0,
    "text_extracted": 0
  },
  "enhancement_options": {
    "content_enhancement_applied": true,
    "ocr_applied": false,
    "auto_strategy_applied": true
  },
  "available_apis": {
    "content_enhancement": "/api/v1/content-enhancement/enhance-content",
    "ocr_processing": "/api/v1/content-enhancement/extract-image-text",
    "strategy_recommendation": "/api/v1/content-enhancement/recommend-strategy",
    "strategy_presets": "/api/v1/content-enhancement/presets"
  }
}
```

**Enhanced Features Integration:**
- Automatically applies content enhancement before chunking
- Uses intelligent strategy recommendation when `auto_strategy=true`
- Optionally applies OCR to extract text from images
- Provides comprehensive analysis and statistics
- Maintains backward compatibility with existing preview endpoints

## Error Handling

### Common Error Responses

**503 Service Unavailable:**
```json
{
  "detail": "Content enhancement service not available",
  "service": "content_enhancement",
  "reason": "import_error",
  "suggestion": "Service dependencies may not be installed"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Content enhancement failed: Text too large for processing",
  "error_type": "content_size_error",
  "max_size_mb": 10,
  "actual_size_mb": 15.2,
  "suggestion": "Reduce content size or process in chunks"
}
```

### Service Dependencies

#### Content Enhancement
- **Dependencies**: None (always available)
- **Fallback**: Graceful degradation with original content

#### OCR Service
- **Dependencies**: `pytesseract`, `PIL`, `tesseract-ocr`
- **Fallback**: Disabled with clear status reporting
- **Installation**: `apt-get install tesseract-ocr` + `pip install pytesseract`

#### Strategy Recommendation
- **Dependencies**: None (rule-based analysis)
- **Fallback**: Default "adaptive" strategy

### Performance Considerations

#### Content Enhancement
- **Speed**: <500ms for typical web pages
- **Memory**: <100MB for normal content
- **Limitations**: 10MB maximum content size

#### OCR Processing
- **Speed**: 2-10 seconds per image depending on size/complexity
- **Memory**: 200-500MB per image during processing
- **Limitations**: 50 images maximum per request, 1920x1080 max resolution

#### Strategy Recommendation
- **Speed**: <100ms for analysis
- **Memory**: <50MB for content analysis
- **Limitations**: 5MB maximum content for analysis

### Rate Limiting

- **Content Enhancement**: 100 requests/minute per user
- **OCR Processing**: 20 requests/minute per user
- **Strategy Recommendation**: 200 requests/minute per user
- **Enhanced Preview**: 30 requests/minute per user

## Integration Examples

### Pipeline Integration

Content enhancement is automatically integrated into the KB pipeline:

```json
{
  "kb_config": {
    "content_enhancement": {
      "remove_emojis": true,
      "filter_unwanted_links": true,
      "enable_deduplication": true
    },
    "ocr": {
      "enabled": false,
      "language": "eng",
      "min_confidence": 50.0
    },
    "strategy": {
      "auto_recommend": true,
      "fallback_strategy": "adaptive"
    }
  }
}
```

### Frontend Usage

```javascript
// Get strategy recommendation
const recommendation = await fetch('/api/v1/content-enhancement/recommend-strategy', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: sampleContent, url: sourceUrl })
});

// Apply content enhancement
const enhanced = await fetch('/api/v1/content-enhancement/enhance-content', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: rawContent,
    remove_emojis: true,
    filter_unwanted_links: true,
    enable_deduplication: true
  })
});

// Enhanced preview with all features
const preview = await fetch('/api/v1/content-enhancement/enhanced-preview', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: targetUrl,
    apply_enhancement: true,
    apply_ocr: false,
    auto_strategy: true
  })
});
```

---

**Last Updated**: November 2024
**API Version**: 1.0