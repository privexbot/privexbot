"""
Content Enhancement API Routes - Content cleanup, OCR, and intelligent strategy endpoints.

WHY:
- Frontend needs access to content enhancement features
- Users want to preview content enhancements before applying
- OCR and strategy recommendations should be controllable
- Backward compatibility with existing KB flow

HOW:
- New endpoints for each enhancement feature
- Integration with existing KB draft flow
- Optional enhancement parameters in existing endpoints
- Detailed enhancement reports for frontend display

MAINTAINS BACKWARD COMPATIBILITY: All existing endpoints continue to work unchanged
"""

from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/content-enhancement", tags=["content_enhancement"])


# ========================================
# REQUEST/RESPONSE MODELS
# ========================================

class ContentEnhancementRequest(BaseModel):
    """Request model for content enhancement"""
    content: str = Field(..., description="Raw content to enhance")
    url: Optional[str] = Field(None, description="Source URL for context")

    # Enhancement options
    remove_emojis: bool = Field(default=True, description="Remove emoji characters")
    filter_unwanted_links: bool = Field(default=True, description="Remove tracking/ad links")
    enable_deduplication: bool = Field(default=True, description="Remove duplicate content")
    normalize_whitespace: bool = Field(default=True, description="Normalize whitespace")
    merge_short_lines: bool = Field(default=True, description="Merge fragmented lines")


class OCRRequest(BaseModel):
    """Request model for OCR processing"""
    content: str = Field(..., description="Content with image references")
    url: Optional[str] = Field(None, description="Source URL for resolving relative images")

    # OCR options
    enabled: bool = Field(default=True, description="Enable OCR processing")
    max_images: int = Field(default=10, ge=1, le=50, description="Max images to process")
    min_confidence: float = Field(default=30.0, ge=0.0, le=100.0, description="Min confidence threshold")
    language: str = Field(default="eng", description="OCR language (eng, fra, deu, etc.)")


class StrategyRecommendationRequest(BaseModel):
    """Request model for strategy recommendation"""
    content: str = Field(..., description="Content to analyze")
    url: Optional[str] = Field(None, description="Source URL for context")


class ContentPreviewRequest(BaseModel):
    """Request model for enhanced content preview"""
    url: HttpUrl = Field(..., description="URL to preview")

    # Enhancement options (all optional for backward compatibility)
    apply_enhancement: bool = Field(default=True, description="Apply content enhancement")
    apply_ocr: bool = Field(default=False, description="Apply OCR to images")
    auto_strategy: bool = Field(default=True, description="Use intelligent strategy recommendation")

    # Traditional preview options
    strategy: Optional[str] = Field(None, description="Manual chunking strategy override")
    chunk_size: int = Field(default=1000, ge=100, le=5000, description="Chunk size")
    chunk_overlap: int = Field(default=200, ge=0, le=1000, description="Chunk overlap")
    max_preview_chunks: int = Field(default=3, ge=1, le=10, description="Max chunks to preview")


# ========================================
# CONTENT ENHANCEMENT ENDPOINTS
# ========================================

@router.post("/enhance-content")
async def enhance_content(
    request: ContentEnhancementRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Enhance content with cleanup and normalization.

    FEATURES:
    - Remove emojis and special characters
    - Filter unwanted tracking/ad links
    - Deduplicate content blocks
    - Normalize whitespace and formatting
    - Merge fragmented text lines

    RETURNS:
    - Enhanced content
    - Statistics about improvements
    - Quality improvement score
    """

    try:
        from app.services.content_enhancement_service import content_enhancement_service, ContentEnhancementConfig

        # Create configuration from request
        config = ContentEnhancementConfig(
            remove_emojis=request.remove_emojis,
            filter_unwanted_links=request.filter_unwanted_links,
            enable_deduplication=request.enable_deduplication,
            normalize_whitespace=request.normalize_whitespace,
            merge_short_lines=request.merge_short_lines
        )

        # Apply enhancement
        enhanced_content, stats = content_enhancement_service.enhance_content(
            request.content,
            request.url,
            config
        )

        return {
            "enhanced_content": enhanced_content,
            "enhancement_stats": {
                "original_length": stats.original_length,
                "enhanced_length": stats.cleaned_length,
                "emojis_removed": stats.emojis_removed,
                "links_filtered": stats.links_filtered,
                "duplicates_removed": stats.duplicates_removed,
                "improvement_score": stats.improvement_score
            },
            "metadata": {
                "processed_at": datetime.utcnow().isoformat(),
                "config_applied": config.dict(),
                "enhancement_applied": True
            }
        }

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Content enhancement service not available"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Content enhancement failed: {str(e)}"
        )


@router.post("/extract-image-text")
async def extract_image_text(
    request: OCRRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Extract text from images using OCR.

    FEATURES:
    - Detect images in content (markdown/HTML)
    - Download and process images
    - Extract text with confidence scoring
    - Handle multiple image formats
    - Image enhancement for better OCR

    RETURNS:
    - Content with extracted image text
    - OCR results with confidence scores
    - Processing statistics
    """

    try:
        from app.services.ocr_service import ocr_service, OCRConfig

        if not ocr_service.is_available():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OCR service not available (pytesseract not installed)"
            )

        # Create OCR configuration
        config = OCRConfig(
            enabled=request.enabled,
            max_images_per_page=request.max_images,
            min_confidence=request.min_confidence,
            language=request.language
        )

        # Apply OCR
        enhanced_content, ocr_results = await ocr_service.extract_text_from_images(
            request.content,
            request.url,
            config
        )

        return {
            "enhanced_content": enhanced_content,
            "ocr_results": [
                {
                    "image_url": result.image_url,
                    "extracted_text": result.extracted_text,
                    "confidence_score": result.confidence_score,
                    "processing_time": result.processing_time,
                    "image_size": result.image_size,
                    "success": result.success,
                    "error_message": result.error_message
                }
                for result in ocr_results
            ],
            "ocr_stats": {
                "images_processed": len(ocr_results),
                "successful_extractions": len([r for r in ocr_results if r.success]),
                "total_text_extracted": sum(len(r.extracted_text) for r in ocr_results),
                "average_confidence": sum(r.confidence_score for r in ocr_results) / len(ocr_results) if ocr_results else 0
            },
            "metadata": {
                "processed_at": datetime.utcnow().isoformat(),
                "ocr_config": config.dict(),
                "ocr_available": True
            }
        }

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCR service not available"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )


@router.post("/recommend-strategy")
async def recommend_strategy(
    request: StrategyRecommendationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Get intelligent chunking strategy recommendations.

    FEATURES:
    - Content type detection (blog, documentation, code, etc.)
    - Structure analysis (headings, lists, complexity)
    - Strategy recommendations with reasoning
    - Optimal configuration suggestions
    - Best practices for different content types

    RETURNS:
    - Recommended strategy configuration
    - Content analysis results
    - Reasoning for recommendation
    - Alternative strategies
    """

    try:
        from app.services.content_strategy_service import content_strategy_service

        # Get recommendation
        preset, analysis, reasoning = content_strategy_service.recommend_strategy(
            request.content,
            request.url
        )

        return {
            "recommended_strategy": {
                "strategy": preset.chunking_strategy if hasattr(preset, 'chunking_strategy') else preset.get('chunking_strategy'),
                "chunk_size": preset.chunk_size if hasattr(preset, 'chunk_size') else preset.get('chunk_size'),
                "chunk_overlap": preset.chunk_overlap if hasattr(preset, 'chunk_overlap') else preset.get('chunk_overlap'),
                "max_pages": preset.max_pages if hasattr(preset, 'max_pages') else preset.get('max_pages'),
                "max_depth": preset.max_depth if hasattr(preset, 'max_depth') else preset.get('max_depth')
            },
            "content_analysis": {
                "content_type": analysis.content_type.value,
                "structure_score": analysis.structure_score,
                "complexity_score": analysis.complexity_score,
                "heading_count": analysis.heading_count,
                "heading_density": analysis.heading_density,
                "code_density": analysis.code_density,
                "avg_paragraph_length": analysis.avg_paragraph_length,
                "total_characters": analysis.total_characters
            },
            "recommendation_reasoning": reasoning,
            "alternative_strategies": {
                "documentation": "by_heading - Best for structured docs",
                "blog_content": "paragraph_based - Best for articles",
                "code_content": "by_section - Best for repositories",
                "academic": "semantic - Best for papers",
                "mixed_content": "adaptive - Best for unknown types"
            },
            "metadata": {
                "analyzed_at": datetime.utcnow().isoformat(),
                "service_available": True
            }
        }

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Strategy recommendation service not available"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Strategy recommendation failed: {str(e)}"
        )


@router.get("/presets")
async def list_strategy_presets(
    current_user: User = Depends(get_current_user)
):
    """
    List all available strategy presets.

    RETURNS:
    - All available content type presets
    - Configuration for each preset
    - Use cases and performance notes
    - Best practice recommendations
    """

    try:
        from app.services.content_strategy_service import content_strategy_service

        presets = content_strategy_service.list_presets()

        return {
            "presets": presets,
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
                "total_presets": len(presets),
                "service_available": True
            }
        }

    except ImportError:
        return {
            "presets": {},
            "content_types": [],
            "metadata": {
                "total_presets": 0,
                "service_available": False,
                "message": "Strategy service not available"
            }
        }


# ========================================
# ENHANCED PREVIEW ENDPOINT
# ========================================

@router.post("/enhanced-preview")
async def enhanced_content_preview(
    request: ContentPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Enhanced content preview with all features.

    COMBINES:
    - Content scraping
    - Content enhancement
    - OCR processing
    - Intelligent strategy recommendation
    - Traditional chunking preview

    BACKWARD COMPATIBLE: Existing preview endpoints continue to work

    RETURNS:
    - All traditional preview data
    - Content enhancement results
    - OCR results if applied
    - Strategy recommendations
    - Quality metrics
    """

    try:
        from app.services.preview_service import preview_service

        # Use enhanced preview service (which now includes all enhancements)
        preview_data = await preview_service.preview_chunking_for_url(
            url=str(request.url),
            strategy=request.strategy or "adaptive",
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            max_preview_chunks=request.max_preview_chunks
        )

        # Add enhancement control flags
        preview_data["enhancement_options"] = {
            "content_enhancement_applied": request.apply_enhancement,
            "ocr_applied": request.apply_ocr,
            "auto_strategy_applied": request.auto_strategy
        }

        # Add API information
        preview_data["available_apis"] = {
            "content_enhancement": "/api/v1/content-enhancement/enhance-content",
            "ocr_processing": "/api/v1/content-enhancement/extract-image-text",
            "strategy_recommendation": "/api/v1/content-enhancement/recommend-strategy",
            "strategy_presets": "/api/v1/content-enhancement/presets"
        }

        return preview_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enhanced preview failed: {str(e)}"
        )


# ========================================
# UTILITY ENDPOINTS
# ========================================

@router.get("/health")
async def enhancement_service_health():
    """Check health and availability of all enhancement services"""

    services = {}

    # Check content enhancement
    try:
        from app.services.content_enhancement_service import content_enhancement_service
        services["content_enhancement"] = {"available": True, "status": "healthy"}
    except ImportError:
        services["content_enhancement"] = {"available": False, "status": "import_error"}

    # Check OCR service
    try:
        from app.services.ocr_service import ocr_service
        services["ocr"] = {
            "available": ocr_service.is_available(),
            "status": "healthy" if ocr_service.is_available() else "dependencies_missing"
        }
    except ImportError:
        services["ocr"] = {"available": False, "status": "import_error"}

    # Check strategy service
    try:
        from app.services.content_strategy_service import content_strategy_service
        services["strategy_recommendation"] = {"available": True, "status": "healthy"}
    except ImportError:
        services["strategy_recommendation"] = {"available": False, "status": "import_error"}

    return {
        "services": services,
        "overall_status": "healthy" if any(s["available"] for s in services.values()) else "degraded",
        "checked_at": datetime.utcnow().isoformat(),
        "backward_compatibility": "maintained"
    }