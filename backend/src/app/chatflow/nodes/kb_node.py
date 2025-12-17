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

CONFIG PRIORITY:
    1. Node Config (explicit in chatflow) - highest
    2. KB-Level Config (kb.context_settings.retrieval_config)
    3. Service Defaults - lowest

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode
from app.services.retrieval_service import retrieval_service


class KBNode(BaseNode):
    """
    Knowledge base retrieval node.

    WHY: RAG - retrieve relevant context
    HOW: Search vector store with query

    CONFIG PRIORITY:
    - Node Config > KB Config > Service Defaults
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
                "kb_id": "uuid",          # Required
                "query": "{{input}}",     # Query template
                "top_k": 5,               # Optional: None = use KB config
                "search_method": "hybrid", # Optional: None = use KB config
                "threshold": 0.7          # Optional: None = use KB config
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

            # Get node config values (may be None to use KB config)
            # Only pass values if explicitly set in node config
            # None values tell retrieval_service to use KB's context_settings.retrieval_config
            node_top_k = self.config.get("top_k")  # None if not set
            node_search_method = self.config.get("search_method")  # None if not set
            node_threshold = self.config.get("threshold")  # None if not set

            # Retrieve from KB with config priority wiring
            # If node config is None, retrieval_service uses KB config
            results = await retrieval_service.search(
                db=db,
                kb_id=UUID(kb_id),
                query=query,
                top_k=node_top_k,  # None = use KB config
                search_method=node_search_method,  # None = use KB config
                threshold=node_threshold  # None = use KB config
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
