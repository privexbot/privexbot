"""
Migration Service - Vector store migration and data portability.

WHY:
- Enable switching between vector store providers
- Support data backup and restore operations
- Facilitate KB migration between environments
- Provide disaster recovery capabilities

HOW:
- Export embeddings from source vector store
- Transform data format if needed
- Import to target vector store
- Verify data integrity throughout process

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Dict, List, Optional, Any, AsyncGenerator
from uuid import UUID
from datetime import datetime
import asyncio
from sqlalchemy.orm import Session

from app.models.knowledge_base import KnowledgeBase
from app.models.chunk import Chunk
from app.services.vector_store_service import vector_store_service
from app.services.embedding_service import embedding_service


class MigrationService:
    """
    Vector store migration and data portability.

    WHY: Enable provider switching and data portability
    HOW: Export, transform, import, verify pattern
    """

    async def migrate_kb_vector_store(
        self,
        db: Session,
        kb_id: UUID,
        target_provider: str,
        target_config: Dict[str, Any],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Migrate KB to different vector store provider.

        WHY: Switch vector store providers without data loss
        HOW: Export from current, import to target, update config

        ARGS:
            db: Database session
            kb_id: Knowledge base to migrate
            target_provider: New vector store provider
            target_config: Target vector store configuration
            batch_size: Chunks to process per batch

        RETURNS:
            {
                "migration_id": "uuid",
                "status": "completed",
                "chunks_migrated": 1234,
                "duration_seconds": 120,
                "old_provider": "faiss",
                "new_provider": "qdrant"
            }
        """

        migration_id = str(UUID.uuid4())
        start_time = datetime.utcnow()

        # Get KB and validate
        kb = db.query(KnowledgeBase).get(kb_id)
        if not kb:
            raise ValueError("Knowledge base not found")

        old_provider = kb.vector_store_config["provider"]

        if old_provider == target_provider:
            raise ValueError("Source and target providers are the same")

        # Initialize target vector store
        await self._initialize_target_vector_store(target_provider, target_config, kb)

        # Export chunks in batches
        total_chunks = 0
        failed_chunks = []

        async for batch in self._export_chunks_batch(db, kb_id, batch_size):
            try:
                # Import batch to target
                await self._import_batch_to_target(
                    target_provider,
                    target_config,
                    batch,
                    kb
                )
                total_chunks += len(batch)

            except Exception as e:
                failed_chunks.extend([chunk["id"] for chunk in batch])
                # Log error but continue with next batch
                print(f"Failed to migrate batch: {e}")

        # Verify migration
        verification_result = await self._verify_migration(
            db, kb_id, target_provider, target_config
        )

        if verification_result["success"]:
            # Update KB configuration
            kb.vector_store_config = {
                "provider": target_provider,
                **target_config
            }

            # Add migration metadata
            kb.metadata = kb.metadata or {}
            kb.metadata["migration_history"] = kb.metadata.get("migration_history", [])
            kb.metadata["migration_history"].append({
                "migration_id": migration_id,
                "from_provider": old_provider,
                "to_provider": target_provider,
                "migrated_at": start_time.isoformat(),
                "chunks_migrated": total_chunks,
                "verification_passed": True
            })

            db.commit()

            # Cleanup old vector store (optional)
            # await self._cleanup_old_vector_store(old_provider, old_config)

        duration = (datetime.utcnow() - start_time).total_seconds()

        return {
            "migration_id": migration_id,
            "status": "completed" if verification_result["success"] else "failed",
            "chunks_migrated": total_chunks,
            "failed_chunks": len(failed_chunks),
            "duration_seconds": int(duration),
            "old_provider": old_provider,
            "new_provider": target_provider,
            "verification": verification_result
        }

    async def export_kb_data(
        self,
        db: Session,
        kb_id: UUID,
        export_format: str = "json",
        include_embeddings: bool = True
    ) -> Dict[str, Any]:
        """
        Export KB data for backup or transfer.

        WHY: Backup data or transfer between systems
        HOW: Extract all KB data in portable format

        ARGS:
            db: Database session
            kb_id: Knowledge base to export
            export_format: "json" | "parquet" | "csv"
            include_embeddings: Whether to include embedding vectors

        RETURNS:
            {
                "export_id": "uuid",
                "file_path": "/exports/kb_uuid.json",
                "size_mb": 12.5,
                "chunks_exported": 1234,
                "format": "json"
            }
        """

        export_id = str(UUID.uuid4())

        # Get KB metadata
        kb = db.query(KnowledgeBase).get(kb_id)
        if not kb:
            raise ValueError("Knowledge base not found")

        # Get all chunks with metadata
        chunks = db.query(Chunk).filter(
            Chunk.kb_id == kb_id
        ).all()

        export_data = {
            "export_metadata": {
                "export_id": export_id,
                "kb_id": str(kb_id),
                "kb_name": kb.name,
                "exported_at": datetime.utcnow().isoformat(),
                "total_chunks": len(chunks),
                "include_embeddings": include_embeddings
            },
            "kb_config": {
                "embedding_config": kb.embedding_config,
                "vector_store_config": kb.vector_store_config,
                "context_settings": kb.context_settings
            },
            "chunks": []
        }

        # Export chunks
        for chunk in chunks:
            chunk_data = {
                "id": str(chunk.id),
                "content": chunk.content,
                "position": chunk.position,
                "word_count": chunk.word_count,
                "character_count": chunk.character_count,
                "metadata": chunk.chunk_metadata,
                "document_id": str(chunk.document_id) if chunk.document_id else None
            }

            if include_embeddings and chunk.embedding:
                chunk_data["embedding"] = chunk.embedding

            export_data["chunks"].append(chunk_data)

        # Save export file
        file_path = await self._save_export_file(export_data, export_format, export_id)
        file_size = await self._get_file_size_mb(file_path)

        return {
            "export_id": export_id,
            "file_path": file_path,
            "size_mb": file_size,
            "chunks_exported": len(chunks),
            "format": export_format,
            "kb_name": kb.name
        }

    async def import_kb_data(
        self,
        db: Session,
        workspace_id: UUID,
        import_file_path: str,
        kb_name: str,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Import KB data from backup file.

        WHY: Restore backup or import from external system
        HOW: Parse import file, create KB, import chunks

        ARGS:
            db: Database session
            workspace_id: Target workspace
            import_file_path: Path to import file
            kb_name: Name for new KB
            user_id: User performing import

        RETURNS:
            {
                "kb_id": "uuid",
                "chunks_imported": 1234,
                "status": "completed"
            }
        """

        # Load and validate import file
        import_data = await self._load_import_file(import_file_path)
        await self._validate_import_data(import_data)

        # Create new KB
        kb = KnowledgeBase(
            workspace_id=workspace_id,
            name=kb_name,
            description=f"Imported from {import_data['export_metadata']['kb_name']}",
            embedding_config=import_data["kb_config"]["embedding_config"],
            vector_store_config=import_data["kb_config"]["vector_store_config"],
            context_settings=import_data["kb_config"]["context_settings"],
            created_by=user_id
        )

        db.add(kb)
        db.commit()
        db.refresh(kb)

        # Initialize vector store
        await vector_store_service.create_collection(kb)

        # Import chunks in batches
        chunks_imported = 0
        batch_size = 100

        chunk_data = import_data["chunks"]
        for i in range(0, len(chunk_data), batch_size):
            batch = chunk_data[i:i + batch_size]

            # Create chunk records
            db_chunks = []
            for chunk_item in batch:
                chunk = Chunk(
                    kb_id=kb.id,
                    content=chunk_item["content"],
                    position=chunk_item["position"],
                    word_count=chunk_item["word_count"],
                    character_count=chunk_item["character_count"],
                    chunk_metadata=chunk_item["metadata"]
                )
                db_chunks.append(chunk)

            db.add_all(db_chunks)
            db.commit()

            # Import to vector store if embeddings available
            if all("embedding" in item for item in batch):
                await self._import_embeddings_batch(kb, db_chunks, batch)

            chunks_imported += len(batch)

        return {
            "kb_id": str(kb.id),
            "chunks_imported": chunks_imported,
            "status": "completed",
            "kb_name": kb.name
        }

    async def _export_chunks_batch(
        self,
        db: Session,
        kb_id: UUID,
        batch_size: int
    ) -> AsyncGenerator[List[Dict[str, Any]], None]:
        """Export chunks in batches to avoid memory issues."""

        offset = 0
        while True:
            chunks = db.query(Chunk).filter(
                Chunk.kb_id == kb_id
            ).offset(offset).limit(batch_size).all()

            if not chunks:
                break

            # Get embeddings from vector store
            batch_data = []
            for chunk in chunks:
                # Get embedding from vector store
                embedding = await vector_store_service.get_embedding(
                    kb_id, str(chunk.id)
                )

                batch_data.append({
                    "id": str(chunk.id),
                    "content": chunk.content,
                    "embedding": embedding,
                    "metadata": {
                        "position": chunk.position,
                        "word_count": chunk.word_count,
                        "character_count": chunk.character_count,
                        "chunk_metadata": chunk.chunk_metadata,
                        "document_id": str(chunk.document_id) if chunk.document_id else None
                    }
                })

            yield batch_data
            offset += batch_size

    async def _initialize_target_vector_store(
        self,
        provider: str,
        config: Dict[str, Any],
        kb: KnowledgeBase
    ) -> None:
        """Initialize target vector store collection."""

        # Temporarily update KB config for initialization
        original_config = kb.vector_store_config
        kb.vector_store_config = {"provider": provider, **config}

        try:
            await vector_store_service.create_collection(kb)
        finally:
            # Restore original config
            kb.vector_store_config = original_config

    async def _import_batch_to_target(
        self,
        provider: str,
        config: Dict[str, Any],
        batch: List[Dict[str, Any]],
        kb: KnowledgeBase
    ) -> None:
        """Import batch of chunks to target vector store."""

        # Temporarily update KB config
        original_config = kb.vector_store_config
        kb.vector_store_config = {"provider": provider, **config}

        try:
            # Prepare vectors for upsert
            vectors = []
            for chunk in batch:
                vectors.append({
                    "id": chunk["id"],
                    "embedding": chunk["embedding"],
                    "metadata": chunk["metadata"]
                })

            await vector_store_service.upsert_vectors(kb, vectors)

        finally:
            # Restore original config
            kb.vector_store_config = original_config

    async def _verify_migration(
        self,
        db: Session,
        kb_id: UUID,
        target_provider: str,
        target_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Verify migration completed successfully."""

        # Count chunks in database
        db_chunk_count = db.query(Chunk).filter(Chunk.kb_id == kb_id).count()

        # Count vectors in target store
        kb = db.query(KnowledgeBase).get(kb_id)
        original_config = kb.vector_store_config
        kb.vector_store_config = {"provider": target_provider, **target_config}

        try:
            vector_count = await vector_store_service.count_vectors(kb)
        finally:
            kb.vector_store_config = original_config

        success = db_chunk_count == vector_count

        return {
            "success": success,
            "db_chunks": db_chunk_count,
            "vector_count": vector_count,
            "match": success
        }

    async def _save_export_file(
        self,
        data: Dict[str, Any],
        format: str,
        export_id: str
    ) -> str:
        """Save export data to file."""

        import json
        import os

        export_dir = "/tmp/exports"
        os.makedirs(export_dir, exist_ok=True)

        if format == "json":
            file_path = f"{export_dir}/kb_export_{export_id}.json"
            with open(file_path, "w") as f:
                json.dump(data, f, indent=2)
        else:
            raise ValueError(f"Unsupported export format: {format}")

        return file_path

    async def _get_file_size_mb(self, file_path: str) -> float:
        """Get file size in MB."""
        import os
        size_bytes = os.path.getsize(file_path)
        return round(size_bytes / (1024 * 1024), 2)

    async def _load_import_file(self, file_path: str) -> Dict[str, Any]:
        """Load import data from file."""
        import json

        with open(file_path, "r") as f:
            return json.load(f)

    async def _validate_import_data(self, data: Dict[str, Any]) -> None:
        """Validate import data structure."""
        required_keys = ["export_metadata", "kb_config", "chunks"]

        for key in required_keys:
            if key not in data:
                raise ValueError(f"Missing required key in import data: {key}")

        if not isinstance(data["chunks"], list):
            raise ValueError("Chunks must be a list")

    async def _import_embeddings_batch(
        self,
        kb: KnowledgeBase,
        db_chunks: List[Chunk],
        chunk_data: List[Dict[str, Any]]
    ) -> None:
        """Import embeddings for a batch of chunks."""

        vectors = []
        for db_chunk, data in zip(db_chunks, chunk_data):
            vectors.append({
                "id": str(db_chunk.id),
                "embedding": data["embedding"],
                "metadata": {
                    "content": db_chunk.content,
                    "position": db_chunk.position,
                    "document_id": str(db_chunk.document_id) if db_chunk.document_id else None
                }
            })

        await vector_store_service.upsert_vectors(kb, vectors)


# Global instance
migration_service = MigrationService()