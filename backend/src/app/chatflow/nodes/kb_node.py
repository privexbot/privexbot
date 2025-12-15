"""
KB Node - Knowledge base retrieval node.

WHY:
- Retrieve context from knowledge bases
- Support RAG workflows
- Filter and rank results
- Apply annotation boosting

HOW:
- Call retrieval_service
- Support multiple KBs
- Configure search parameters
- Return sources with scores

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from uuid import UUID
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode
from app.services.retrieval_service import retrieval_service


class KBNode(BaseNode):
    """
    Knowledge base retrieval node.

    WHY: RAG - retrieve relevant context
    HOW: Search vector store with query
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute KB retrieval.

        CONFIG:
            {
                "kb_id": "uuid",
                "query": "{{input}}",
                "top_k": 5,
                "search_method": "hybrid",
                "threshold": 0.7
            }

        INPUTS:
            {
                "input": "Search query"
            }

        RETURNS:
            {
                "output": "Combined text from chunks",
                "success": True,
                "metadata": {
                    "sources": [...],
                    "chunks_found": 5
                }
            }
        """

        try:
            # Get KB ID
            kb_id = self.config.get("kb_id")
            if not kb_id:
                raise ValueError("KB ID required")

            # Get query
            query_template = self.config.get("query", "{{input}}")
            query = self.resolve_variable(query_template, {
                **context.get("variables", {}),
                **inputs
            })

            # Retrieve from KB
            results = await retrieval_service.search(
                db=db,
                kb_id=UUID(kb_id),
                query=query,
                top_k=self.config.get("top_k", 5),
                search_method=self.config.get("search_method", "hybrid"),
                threshold=self.config.get("threshold", 0.7)
            )

            # Combine chunk content
            combined_text = "\n\n".join([r["content"] for r in results])

            return {
                "output": combined_text,
                "success": True,
                "error": None,
                "metadata": {
                    "sources": results,
                    "chunks_found": len(results),
                    "kb_id": kb_id
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate KB node configuration."""

        if not self.config.get("kb_id"):
            return False, "KB ID is required"

        return True, None
