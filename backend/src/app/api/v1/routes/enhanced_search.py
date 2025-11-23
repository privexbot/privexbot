"""
Enhanced Search API - Test endpoint for adaptive search functionality.

WHY:
- Test the enhanced search service with real data
- Compare enhanced vs basic search results
- Validate adaptive chunking improvements
- Backward compatible endpoint

HOW:
- Simple POST endpoint that accepts query and KB ID
- Returns enhanced search results with reasoning
- Falls back to basic search if enhanced fails
- Can be used by both chatbots and chatflows
"""

from typing import Dict, List, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_workspace, get_db
from app.models.workspace import Workspace
from app.models.knowledge_base import KnowledgeBase
from app.services.enhanced_search_service import enhanced_search_service, SearchStrategy


# Request/Response models
class EnhancedSearchRequest(BaseModel):
    """Request model for enhanced search"""
    kb_id: UUID
    query: str = Field(..., min_length=1, max_length=1000)
    search_strategy: str = Field(default="adaptive", pattern="^(precise|contextual|hybrid|adaptive)$")
    top_k: int = Field(default=5, ge=1, le=20)
    include_reasoning: bool = Field(default=True)
    requester_type: str = Field(default="api", pattern="^(chatbot|chatflow|api)$")
    requester_id: Optional[UUID] = Field(default=None, description="ID of chatbot or chatflow making the request")


class EnhancedSearchResponse(BaseModel):
    """Response model for enhanced search"""
    results: List[Dict[str, Any]]
    search_strategy_used: str
    total_results: int
    processing_time_ms: Optional[float] = None
    fallback_used: bool = False


# Router
router = APIRouter(prefix="/enhanced-search", tags=["Enhanced Search"])


@router.post("/", response_model=EnhancedSearchResponse)
async def enhanced_search_endpoint(
    request: EnhancedSearchRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
) -> EnhancedSearchResponse:
    """
    Perform enhanced search on a knowledge base.

    This endpoint tests the adaptive search functionality that leverages
    chunking metadata for better results. It's backward compatible and
    falls back to basic search if enhanced features fail.

    Args:
        request: Search request parameters
        workspace: Current workspace (for multi-tenancy)
        db: Database session

    Returns:
        Enhanced search results with reasoning and metadata

    Example usage:
        POST /api/v1/enhanced-search/
        {
            "kb_id": "123e4567-e89b-12d3-a456-426614174000",
            "query": "How do I install the application?",
            "context_type": "chatbot",
            "search_strategy": "adaptive"
        }
    """
    import time

    start_time = time.time()

    # Get KB and verify workspace access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == request.kb_id,
        KnowledgeBase.workspace_id == workspace.id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base {request.kb_id} not found in workspace {workspace.id}"
        )

    # Check KB access control using smart service
    from app.services.smart_kb_service import smart_kb_service

    access_info = smart_kb_service.analyze_kb_access_control(kb)

    # Validate access based on requester type
    if request.requester_type == "chatbot":
        if not access_info.accessible_by_chatbots:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This knowledge base is not accessible by chatbots"
            )
        if access_info.specific_chatbot_ids and request.requester_id not in access_info.specific_chatbot_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This chatbot does not have access to this knowledge base"
            )

    elif request.requester_type == "chatflow":
        if not access_info.accessible_by_chatflows:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This knowledge base is not accessible by chatflows"
            )
        if access_info.specific_chatflow_ids and request.requester_id not in access_info.specific_chatflow_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This chatflow does not have access to this knowledge base"
            )

    # Validate and convert search strategy
    strategy_mapping = {
        "precise": SearchStrategy.PRECISE,
        "contextual": SearchStrategy.CONTEXTUAL,
        "hybrid": SearchStrategy.HYBRID,
        "adaptive": SearchStrategy.ADAPTIVE
    }
    search_strategy = strategy_mapping[request.search_strategy]

    # Determine context type based on requester
    context_type = request.requester_type if request.requester_type in ["chatbot", "chatflow"] else "chatbot"

    try:
        # Perform enhanced search
        enhanced_results = await enhanced_search_service.enhanced_search(
            kb=kb,
            query=request.query,
            search_strategy=search_strategy,
            top_k=request.top_k,
            context_type=context_type
        )

        # Convert results to response format
        if enhanced_results:
            results = []
            for result in enhanced_results:
                result_dict = {
                    "chunk_id": result.chunk_id,
                    "content": result.content,
                    "score": round(result.score, 4),
                    "confidence": round(result.confidence, 4),
                    "document_id": result.document_id,
                    "page_url": result.page_url,
                    "page_title": result.page_title,
                    "content_type": result.content_type,
                    "strategy_used": result.strategy_used,
                    "context_type": result.context_type
                }

                if request.include_reasoning:
                    result_dict["reasoning"] = result.reasoning

                results.append(result_dict)

            processing_time_ms = (time.time() - start_time) * 1000

            return EnhancedSearchResponse(
                results=results,
                search_strategy_used=search_strategy.value,
                total_results=len(results),
                processing_time_ms=round(processing_time_ms, 2),
                fallback_used=False
            )

        else:
            # No enhanced results, try fallback
            fallback_results = await enhanced_search_service.search_with_fallback(
                kb=kb,
                query=request.query,
                top_k=request.top_k,
                context_type=context_type
            )

            processing_time_ms = (time.time() - start_time) * 1000

            return EnhancedSearchResponse(
                results=fallback_results,
                search_strategy_used="fallback_basic",
                total_results=len(fallback_results),
                processing_time_ms=round(processing_time_ms, 2),
                fallback_used=True
            )

    except Exception as e:
        # Error in enhanced search, try basic fallback
        try:
            fallback_results = await enhanced_search_service.search_with_fallback(
                kb=kb,
                query=request.query,
                top_k=request.top_k,
                context_type=context_type
            )

            processing_time_ms = (time.time() - start_time) * 1000

            return EnhancedSearchResponse(
                results=fallback_results,
                search_strategy_used="fallback_basic",
                total_results=len(fallback_results),
                processing_time_ms=round(processing_time_ms, 2),
                fallback_used=True
            )

        except Exception as fallback_error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Both enhanced and fallback search failed: {str(e)}, {str(fallback_error)}"
            )


@router.get("/health")
async def search_health_check():
    """Health check for enhanced search service"""
    return {
        "status": "healthy",
        "service": "enhanced_search_service",
        "features": [
            "adaptive_chunking_analysis",
            "context_aware_search",
            "metadata_filtering",
            "confidence_scoring",
            "backward_compatibility"
        ]
    }