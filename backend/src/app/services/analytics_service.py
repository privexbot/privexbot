"""
Analytics Service - KB usage analytics and optimization insights.

WHY:
- Monitor KB performance and usage patterns
- Identify optimization opportunities
- Track retrieval quality and user satisfaction
- Provide actionable insights for KB improvement

HOW:
- Collect usage metrics during retrieval
- Analyze chunk popularity and effectiveness
- Generate performance reports
- Suggest optimization recommendations

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk


class AnalyticsService:
    """
    KB analytics and optimization insights.

    WHY: Data-driven KB improvement and monitoring
    HOW: Collect metrics, analyze patterns, generate insights
    """

    async def get_kb_overview(
        self,
        db: Session,
        kb_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get KB overview analytics.

        WHY: High-level KB health and usage summary
        HOW: Aggregate stats from documents, chunks, queries

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            days: Analysis period in days

        RETURNS:
            {
                "total_documents": 50,
                "total_chunks": 1234,
                "total_queries": 5678,
                "avg_retrieval_score": 0.85,
                "storage_size_mb": 12.5,
                "top_documents": [...],
                "query_trends": [...],
                "health_score": 0.92
            }
        """

        # Basic counts
        total_documents = db.query(Document).filter(
            Document.kb_id == kb_id,
            Document.status == "completed"
        ).count()

        total_chunks = db.query(Chunk).filter(
            Chunk.kb_id == kb_id,
            Chunk.is_enabled == True
        ).count()

        # Calculate storage size
        storage_stats = db.query(
            func.sum(Document.character_count).label("total_chars"),
            func.avg(Document.character_count).label("avg_chars")
        ).filter(
            Document.kb_id == kb_id
        ).first()

        storage_size_mb = (storage_stats.total_chars or 0) / (1024 * 1024)

        # Get top performing documents
        top_documents = await self._get_top_documents(db, kb_id, days)

        # Query trends (placeholder - would integrate with query logging)
        query_trends = await self._get_query_trends(db, kb_id, days)

        # Calculate health score
        health_score = await self._calculate_health_score(db, kb_id)

        return {
            "total_documents": total_documents,
            "total_chunks": total_chunks,
            "total_queries": 0,  # Would come from query logs
            "avg_retrieval_score": 0.85,  # Would calculate from retrieval logs
            "storage_size_mb": round(storage_size_mb, 2),
            "avg_document_size": round(storage_stats.avg_chars or 0),
            "top_documents": top_documents,
            "query_trends": query_trends,
            "health_score": health_score,
            "analysis_period_days": days
        }

    async def get_document_analytics(
        self,
        db: Session,
        document_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get detailed document analytics.

        WHY: Understand document performance and usage
        HOW: Analyze chunk retrieval patterns, quality metrics

        ARGS:
            db: Database session
            document_id: Document ID
            days: Analysis period

        RETURNS:
            {
                "document_info": {...},
                "chunk_performance": [...],
                "retrieval_stats": {...},
                "quality_metrics": {...}
            }
        """

        document = db.query(Document).get(document_id)
        if not document:
            raise ValueError("Document not found")

        # Get chunks with retrieval stats
        chunks = db.query(Chunk).filter(
            Chunk.document_id == document_id
        ).all()

        chunk_performance = []
        for chunk in chunks:
            chunk_performance.append({
                "chunk_id": str(chunk.id),
                "position": chunk.position,
                "retrieval_count": chunk.retrieval_count,
                "quality_score": chunk.quality_score,
                "word_count": chunk.word_count,
                "last_retrieved_at": chunk.last_retrieved_at
            })

        # Sort by retrieval count
        chunk_performance.sort(key=lambda x: x["retrieval_count"], reverse=True)

        # Calculate retrieval stats
        total_retrievals = sum(c["retrieval_count"] for c in chunk_performance)
        avg_quality = sum(c["quality_score"] or 0 for c in chunk_performance) / len(chunk_performance) if chunk_performance else 0

        return {
            "document_info": {
                "id": str(document.id),
                "name": document.name,
                "source_type": document.source_type,
                "status": document.status,
                "word_count": document.word_count,
                "chunk_count": document.chunk_count,
                "created_at": document.created_at
            },
            "chunk_performance": chunk_performance[:10],  # Top 10
            "retrieval_stats": {
                "total_retrievals": total_retrievals,
                "avg_quality_score": round(avg_quality, 3),
                "top_performing_chunks": len([c for c in chunk_performance if c["retrieval_count"] > 0]),
                "unused_chunks": len([c for c in chunk_performance if c["retrieval_count"] == 0])
            },
            "quality_metrics": {
                "avg_chunk_quality": round(avg_quality, 3),
                "quality_distribution": await self._get_quality_distribution(chunk_performance)
            }
        }

    async def get_optimization_suggestions(
        self,
        db: Session,
        kb_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Generate KB optimization suggestions.

        WHY: Help users improve KB performance
        HOW: Analyze patterns and suggest improvements

        ARGS:
            db: Database session
            kb_id: Knowledge base ID

        RETURNS:
            [
                {
                    "type": "chunking",
                    "priority": "high",
                    "title": "Optimize chunk size",
                    "description": "...",
                    "action": "...",
                    "impact": "improved_retrieval"
                }
            ]
        """

        suggestions = []

        # Check for unused chunks
        unused_chunks_count = db.query(Chunk).filter(
            Chunk.kb_id == kb_id,
            Chunk.retrieval_count == 0
        ).count()

        total_chunks = db.query(Chunk).filter(
            Chunk.kb_id == kb_id
        ).count()

        if total_chunks > 0 and unused_chunks_count / total_chunks > 0.3:
            suggestions.append({
                "type": "content_optimization",
                "priority": "medium",
                "title": "High unused chunk ratio",
                "description": f"{unused_chunks_count} of {total_chunks} chunks are never retrieved",
                "action": "Review and remove low-quality or duplicate content",
                "impact": "improved_retrieval_speed",
                "metric": f"{round(unused_chunks_count/total_chunks*100)}% unused"
            })

        # Check chunk size distribution
        chunk_sizes = db.query(Chunk.character_count).filter(
            Chunk.kb_id == kb_id
        ).all()

        if chunk_sizes:
            sizes = [size[0] for size in chunk_sizes]
            avg_size = sum(sizes) / len(sizes)

            if avg_size < 200:
                suggestions.append({
                    "type": "chunking",
                    "priority": "high",
                    "title": "Chunks too small",
                    "description": f"Average chunk size is {int(avg_size)} characters",
                    "action": "Increase chunk size to 800-1200 characters",
                    "impact": "better_context_preservation",
                    "metric": f"avg: {int(avg_size)} chars"
                })
            elif avg_size > 2000:
                suggestions.append({
                    "type": "chunking",
                    "priority": "medium",
                    "title": "Chunks too large",
                    "description": f"Average chunk size is {int(avg_size)} characters",
                    "action": "Reduce chunk size to 800-1200 characters",
                    "impact": "improved_retrieval_precision",
                    "metric": f"avg: {int(avg_size)} chars"
                })

        # Check document diversity
        source_types = db.query(
            Document.source_type,
            func.count(Document.id).label("count")
        ).filter(
            Document.kb_id == kb_id
        ).group_by(Document.source_type).all()

        if len(source_types) == 1 and source_types[0][1] > 10:
            suggestions.append({
                "type": "content_diversity",
                "priority": "low",
                "title": "Limited content diversity",
                "description": f"All documents are from {source_types[0][0]}",
                "action": "Add content from different sources (web, docs, etc.)",
                "impact": "improved_knowledge_coverage",
                "metric": f"1 source type"
            })

        # Check for processing errors
        error_count = db.query(Document).filter(
            Document.kb_id == kb_id,
            Document.status == "failed"
        ).count()

        if error_count > 0:
            suggestions.append({
                "type": "error_resolution",
                "priority": "high",
                "title": "Documents with processing errors",
                "description": f"{error_count} documents failed to process",
                "action": "Review and fix failed documents",
                "impact": "complete_knowledge_coverage",
                "metric": f"{error_count} failed"
            })

        return suggestions

    async def get_retrieval_analytics(
        self,
        db: Session,
        kb_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get retrieval performance analytics.

        WHY: Understand how well KB answers queries
        HOW: Analyze retrieval patterns and success rates

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            days: Analysis period

        RETURNS:
            {
                "retrieval_patterns": {...},
                "popular_chunks": [...],
                "query_categories": [...],
                "performance_metrics": {...}
            }
        """

        # Get popular chunks
        popular_chunks = db.query(Chunk).filter(
            Chunk.kb_id == kb_id,
            Chunk.retrieval_count > 0
        ).order_by(desc(Chunk.retrieval_count)).limit(10).all()

        popular_chunks_data = []
        for chunk in popular_chunks:
            popular_chunks_data.append({
                "chunk_id": str(chunk.id),
                "content_preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                "retrieval_count": chunk.retrieval_count,
                "quality_score": chunk.quality_score,
                "document_name": chunk.document.name if chunk.document else "Unknown"
            })

        # Calculate performance metrics
        total_chunks = db.query(Chunk).filter(Chunk.kb_id == kb_id).count()
        active_chunks = db.query(Chunk).filter(
            Chunk.kb_id == kb_id,
            Chunk.retrieval_count > 0
        ).count()

        utilization_rate = (active_chunks / total_chunks) if total_chunks > 0 else 0

        return {
            "retrieval_patterns": {
                "total_retrievals": sum(chunk.retrieval_count for chunk in popular_chunks),
                "active_chunks": active_chunks,
                "total_chunks": total_chunks,
                "utilization_rate": round(utilization_rate, 3)
            },
            "popular_chunks": popular_chunks_data,
            "query_categories": [],  # Would come from query analysis
            "performance_metrics": {
                "avg_chunks_per_query": 3.5,  # Would calculate from logs
                "avg_retrieval_score": 0.85,  # Would calculate from logs
                "user_satisfaction": 0.9  # Would come from feedback
            }
        }

    async def _get_top_documents(
        self,
        db: Session,
        kb_id: UUID,
        days: int
    ) -> List[Dict[str, Any]]:
        """Get top performing documents."""

        # Calculate document popularity based on chunk retrievals
        document_stats = db.query(
            Document.id,
            Document.name,
            Document.chunk_count,
            func.sum(Chunk.retrieval_count).label("total_retrievals")
        ).join(Chunk).filter(
            Document.kb_id == kb_id
        ).group_by(Document.id, Document.name, Document.chunk_count).order_by(
            desc("total_retrievals")
        ).limit(5).all()

        return [
            {
                "document_id": str(doc.id),
                "name": doc.name,
                "chunk_count": doc.chunk_count,
                "total_retrievals": doc.total_retrievals or 0
            }
            for doc in document_stats
        ]

    async def _get_query_trends(
        self,
        db: Session,
        kb_id: UUID,
        days: int
    ) -> List[Dict[str, Any]]:
        """Get query trends over time."""

        # Placeholder - would integrate with query logging
        return [
            {"date": "2025-01-09", "queries": 45},
            {"date": "2025-01-10", "queries": 52},
            {"date": "2025-01-11", "queries": 38}
        ]

    async def _calculate_health_score(
        self,
        db: Session,
        kb_id: UUID
    ) -> float:
        """Calculate overall KB health score."""

        # Get basic stats
        total_documents = db.query(Document).filter(
            Document.kb_id == kb_id
        ).count()

        completed_documents = db.query(Document).filter(
            Document.kb_id == kb_id,
            Document.status == "completed"
        ).count()

        failed_documents = db.query(Document).filter(
            Document.kb_id == kb_id,
            Document.status == "failed"
        ).count()

        if total_documents == 0:
            return 0.0

        # Calculate factors
        completion_rate = completed_documents / total_documents
        error_rate = failed_documents / total_documents

        # Simple health score calculation
        health_score = completion_rate - (error_rate * 0.5)

        return max(0.0, min(1.0, health_score))

    async def _get_quality_distribution(
        self,
        chunk_performance: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """Get distribution of chunk quality scores."""

        distribution = {"high": 0, "medium": 0, "low": 0, "unscored": 0}

        for chunk in chunk_performance:
            score = chunk.get("quality_score")
            if score is None:
                distribution["unscored"] += 1
            elif score >= 0.8:
                distribution["high"] += 1
            elif score >= 0.6:
                distribution["medium"] += 1
            else:
                distribution["low"] += 1

        return distribution


# Global instance
analytics_service = AnalyticsService()