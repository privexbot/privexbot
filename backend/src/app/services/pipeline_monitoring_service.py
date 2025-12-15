"""
Pipeline monitoring and debugging service for KB ETL operations.

WHY: Real-time visibility into pipeline execution for debugging and optimization
HOW: Track pipeline status, performance metrics, and error diagnostics
BUILDS ON: Existing patterns from tenant_service.py and background task monitoring

PSEUDOCODE:
-----------
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import uuid

class PipelineStatus(Enum):
    """Pipeline execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class StepStatus(Enum):
    """Individual step status"""
    WAITING = "waiting"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class PipelineStep:
    """Individual pipeline step tracking"""
    step_id: str
    name: str
    status: StepStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    metadata: Dict = None
    metrics: Dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.metrics is None:
            self.metrics = {}

@dataclass
class PipelineExecution:
    """Complete pipeline execution tracking"""
    execution_id: str
    knowledge_base_id: str
    workspace_id: str
    organization_id: str
    status: PipelineStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_duration_seconds: Optional[float] = None
    steps: List[PipelineStep] = None
    configuration: Dict = None
    error_summary: Optional[str] = None
    performance_metrics: Dict = None

    def __post_init__(self):
        if self.steps is None:
            self.steps = []
        if self.configuration is None:
            self.configuration = {}
        if self.performance_metrics is None:
            self.performance_metrics = {}

class PipelineMonitoringService:
    """
    Service for monitoring and debugging KB ETL pipelines.

    PHILOSOPHY: Real-time visibility enables faster debugging and optimization
    BUILDS ON: Existing background task patterns and Redis monitoring
    """

    def __init__(self, redis_client, db_session):
        self.redis = redis_client
        self.db = db_session
        self.execution_prefix = "pipeline:execution:"
        self.metrics_prefix = "pipeline:metrics:"
        self.alerts_prefix = "pipeline:alerts:"

    async def start_pipeline_execution(
        self,
        knowledge_base_id: str,
        workspace_id: str,
        organization_id: str,
        configuration: Dict,
        steps_config: List[Dict]
    ) -> str:
        """
        Initialize pipeline execution tracking.

        PROCESS:
        1. Create execution ID and tracking object
        2. Initialize step tracking based on configuration
        3. Store in Redis for real-time access
        4. Return execution ID for client polling
        """

        execution_id = str(uuid.uuid4())

        # Create execution tracking object
        execution = PipelineExecution(
            execution_id=execution_id,
            knowledge_base_id=knowledge_base_id,
            workspace_id=workspace_id,
            organization_id=organization_id,
            status=PipelineStatus.PENDING,
            created_at=datetime.utcnow(),
            configuration=configuration
        )

        # Initialize steps from configuration
        for i, step_config in enumerate(steps_config):
            step = PipelineStep(
                step_id=f"{execution_id}:step:{i}",
                name=step_config.get("name", f"Step {i+1}"),
                status=StepStatus.WAITING,
                metadata=step_config.get("metadata", {})
            )
            execution.steps.append(step)

        # Store in Redis for real-time access
        await self._store_execution(execution)

        # Initialize performance metrics
        await self._init_metrics(execution_id)

        return execution_id

    async def update_pipeline_status(
        self,
        execution_id: str,
        status: PipelineStatus,
        error_message: Optional[str] = None
    ) -> None:
        """
        Update overall pipeline status.

        PROCESS:
        1. Retrieve current execution from Redis
        2. Update status and timing information
        3. Calculate duration if completed/failed
        4. Store updated execution
        5. Trigger alerts if necessary
        """

        execution = await self._get_execution(execution_id)
        if not execution:
            raise ValueError(f"Pipeline execution {execution_id} not found")

        # Update status and timing
        execution.status = status

        if status == PipelineStatus.RUNNING and not execution.started_at:
            execution.started_at = datetime.utcnow()

        if status in [PipelineStatus.COMPLETED, PipelineStatus.FAILED, PipelineStatus.CANCELLED]:
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                execution.total_duration_seconds = (
                    execution.completed_at - execution.started_at
                ).total_seconds()

        if error_message:
            execution.error_summary = error_message

        await self._store_execution(execution)

        # Handle alerts for failures
        if status == PipelineStatus.FAILED:
            await self._create_alert(execution_id, "pipeline_failed", error_message)

    async def update_step_status(
        self,
        execution_id: str,
        step_index: int,
        status: StepStatus,
        metrics: Optional[Dict] = None,
        error_message: Optional[str] = None
    ) -> None:
        """
        Update individual step status and metrics.

        PROCESS:
        1. Retrieve execution and locate step
        2. Update step status and timing
        3. Store metrics if provided
        4. Calculate step duration
        5. Update execution tracking
        """

        execution = await self._get_execution(execution_id)
        if not execution or step_index >= len(execution.steps):
            raise ValueError(f"Step {step_index} not found in execution {execution_id}")

        step = execution.steps[step_index]
        step.status = status

        # Update timing
        if status == StepStatus.RUNNING and not step.started_at:
            step.started_at = datetime.utcnow()

        if status in [StepStatus.COMPLETED, StepStatus.FAILED, StepStatus.SKIPPED]:
            step.completed_at = datetime.utcnow()
            if step.started_at:
                step.duration_seconds = (
                    step.completed_at - step.started_at
                ).total_seconds()

        # Store metrics and errors
        if metrics:
            step.metrics.update(metrics)

        if error_message:
            step.error_message = error_message

        await self._store_execution(execution)

        # Update aggregated metrics
        await self._update_aggregated_metrics(execution_id, step_index, metrics or {})

    async def get_pipeline_status(
        self,
        execution_id: str,
        user_id: str,
        workspace_id: str
    ) -> Optional[PipelineExecution]:
        """
        Get current pipeline status with tenant verification.

        PROCESS:
        1. Retrieve execution from Redis
        2. Verify user has access to this workspace
        3. Return execution status or None
        """

        execution = await self._get_execution(execution_id)
        if not execution:
            return None

        # Verify tenant access (following existing patterns)
        from app.services.tenant_service import verify_workspace_permission
        if not await verify_workspace_permission(user_id, workspace_id, "view"):
            return None

        # Ensure execution belongs to this workspace
        if execution.workspace_id != workspace_id:
            return None

        return execution

    async def list_pipeline_executions(
        self,
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        status_filter: Optional[PipelineStatus] = None
    ) -> List[PipelineExecution]:
        """
        List recent pipeline executions for workspace.

        PROCESS:
        1. Verify workspace access
        2. Query Redis for executions in workspace
        3. Apply status filtering if requested
        4. Sort by creation time (newest first)
        5. Apply limit and return
        """

        # Verify tenant access
        from app.services.tenant_service import verify_workspace_permission
        if not await verify_workspace_permission(user_id, workspace_id, "view"):
            return []

        # Get all execution keys for workspace
        pattern = f"{self.execution_prefix}*"
        execution_keys = await self.redis.keys(pattern)

        executions = []
        for key in execution_keys:
            execution_data = await self.redis.get(key)
            if execution_data:
                execution = self._deserialize_execution(execution_data)

                # Filter by workspace and status
                if execution.workspace_id == workspace_id:
                    if status_filter is None or execution.status == status_filter:
                        executions.append(execution)

        # Sort by creation time (newest first) and apply limit
        executions.sort(key=lambda x: x.created_at, reverse=True)
        return executions[:limit]

    async def get_performance_metrics(
        self,
        execution_id: str,
        user_id: str,
        workspace_id: str
    ) -> Optional[Dict]:
        """
        Get detailed performance metrics for pipeline execution.

        METRICS INCLUDED:
        - Overall execution time
        - Per-step execution times
        - Memory usage patterns
        - Document processing rates
        - Error rates and patterns
        - Resource utilization
        """

        execution = await self.get_pipeline_status(execution_id, user_id, workspace_id)
        if not execution:
            return None

        # Get aggregated metrics from Redis
        metrics_key = f"{self.metrics_prefix}{execution_id}"
        metrics_data = await self.redis.get(metrics_key)

        base_metrics = {
            "execution_id": execution_id,
            "total_duration": execution.total_duration_seconds,
            "step_count": len(execution.steps),
            "completed_steps": len([s for s in execution.steps if s.status == StepStatus.COMPLETED]),
            "failed_steps": len([s for s in execution.steps if s.status == StepStatus.FAILED]),
            "step_durations": {s.name: s.duration_seconds for s in execution.steps if s.duration_seconds}
        }

        if metrics_data:
            additional_metrics = self._deserialize_metrics(metrics_data)
            base_metrics.update(additional_metrics)

        return base_metrics

    async def get_pipeline_logs(
        self,
        execution_id: str,
        user_id: str,
        workspace_id: str,
        step_filter: Optional[str] = None
    ) -> List[Dict]:
        """
        Get detailed logs for pipeline execution debugging.

        LOG STRUCTURE:
        - Timestamp
        - Step name
        - Log level (INFO, WARNING, ERROR)
        - Message
        - Context metadata
        """

        execution = await self.get_pipeline_status(execution_id, user_id, workspace_id)
        if not execution:
            return []

        # Get logs from Redis
        logs_key = f"pipeline:logs:{execution_id}"
        log_entries = await self.redis.lrange(logs_key, 0, -1)

        logs = []
        for entry in log_entries:
            log_data = self._deserialize_log_entry(entry)

            # Apply step filter if specified
            if step_filter is None or log_data.get("step_name") == step_filter:
                logs.append(log_data)

        return logs

    async def add_pipeline_log(
        self,
        execution_id: str,
        step_name: str,
        level: str,
        message: str,
        metadata: Optional[Dict] = None
    ) -> None:
        """
        Add log entry for pipeline execution.

        PROCESS:
        1. Create structured log entry
        2. Store in Redis list for execution
        3. Apply log retention policy
        4. Trigger alerts for ERROR level logs
        """

        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "execution_id": execution_id,
            "step_name": step_name,
            "level": level,
            "message": message,
            "metadata": metadata or {}
        }

        # Store in Redis
        logs_key = f"pipeline:logs:{execution_id}"
        await self.redis.lpush(logs_key, self._serialize_log_entry(log_entry))

        # Apply retention policy (keep last 1000 logs)
        await self.redis.ltrim(logs_key, 0, 999)

        # Set expiration (logs expire after 30 days)
        await self.redis.expire(logs_key, 30 * 24 * 3600)

        # Create alert for ERROR level logs
        if level == "ERROR":
            await self._create_alert(execution_id, "step_error", message)

    async def cancel_pipeline(
        self,
        execution_id: str,
        user_id: str,
        workspace_id: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Cancel running pipeline execution.

        PROCESS:
        1. Verify user has permission to cancel
        2. Update pipeline status to CANCELLED
        3. Signal background tasks to stop
        4. Clean up resources
        5. Log cancellation event
        """

        execution = await self.get_pipeline_status(execution_id, user_id, workspace_id)
        if not execution:
            return False

        # Verify user has edit permission
        from app.services.tenant_service import verify_workspace_permission
        if not await verify_workspace_permission(user_id, workspace_id, "edit"):
            return False

        # Can only cancel running or pending pipelines
        if execution.status not in [PipelineStatus.RUNNING, PipelineStatus.PENDING]:
            return False

        # Update status
        await self.update_pipeline_status(
            execution_id,
            PipelineStatus.CANCELLED,
            f"Cancelled by user: {reason or 'No reason provided'}"
        )

        # Signal background tasks to stop
        cancellation_key = f"pipeline:cancel:{execution_id}"
        await self.redis.set(cancellation_key, "true", ex=3600)  # 1 hour expiry

        # Log cancellation
        await self.add_pipeline_log(
            execution_id,
            "system",
            "INFO",
            f"Pipeline cancelled by user {user_id}",
            {"reason": reason}
        )

        return True

    async def check_cancellation(self, execution_id: str) -> bool:
        """
        Check if pipeline has been cancelled (for background tasks).

        USAGE: Background tasks call this periodically to check for cancellation
        """

        cancellation_key = f"pipeline:cancel:{execution_id}"
        return await self.redis.exists(cancellation_key)

    async def cleanup_old_executions(self, days_old: int = 30) -> int:
        """
        Clean up old pipeline execution data.

        PROCESS:
        1. Find executions older than specified days
        2. Move to archive storage (optional)
        3. Remove from Redis
        4. Return count of cleaned executions
        """

        cutoff_date = datetime.utcnow() - timedelta(days=days_old)

        # Get all execution keys
        pattern = f"{self.execution_prefix}*"
        execution_keys = await self.redis.keys(pattern)

        cleaned_count = 0
        for key in execution_keys:
            execution_data = await self.redis.get(key)
            if execution_data:
                execution = self._deserialize_execution(execution_data)

                if execution.created_at < cutoff_date:
                    # Optional: Archive to database before deletion
                    await self._archive_execution(execution)

                    # Remove from Redis
                    await self.redis.delete(key)

                    # Clean up related data
                    await self.redis.delete(f"{self.metrics_prefix}{execution.execution_id}")
                    await self.redis.delete(f"pipeline:logs:{execution.execution_id}")

                    cleaned_count += 1

        return cleaned_count

    # Private helper methods
    async def _store_execution(self, execution: PipelineExecution) -> None:
        """Store execution in Redis"""
        key = f"{self.execution_prefix}{execution.execution_id}"
        data = self._serialize_execution(execution)
        await self.redis.set(key, data, ex=7 * 24 * 3600)  # 7 days expiry

    async def _get_execution(self, execution_id: str) -> Optional[PipelineExecution]:
        """Retrieve execution from Redis"""
        key = f"{self.execution_prefix}{execution_id}"
        data = await self.redis.get(key)
        return self._deserialize_execution(data) if data else None

    async def _init_metrics(self, execution_id: str) -> None:
        """Initialize performance metrics tracking"""
        metrics_key = f"{self.metrics_prefix}{execution_id}"
        initial_metrics = {
            "documents_processed": 0,
            "chunks_created": 0,
            "errors_encountered": 0,
            "memory_usage_mb": 0,
            "processing_rate_docs_per_second": 0
        }
        await self.redis.set(metrics_key, self._serialize_metrics(initial_metrics), ex=7 * 24 * 3600)

    async def _update_aggregated_metrics(self, execution_id: str, step_index: int, metrics: Dict) -> None:
        """Update aggregated metrics for execution"""
        metrics_key = f"{self.metrics_prefix}{execution_id}"
        current_data = await self.redis.get(metrics_key)

        if current_data:
            current_metrics = self._deserialize_metrics(current_data)

            # Aggregate metrics based on type
            for key, value in metrics.items():
                if key.endswith("_count") or key.endswith("_processed"):
                    current_metrics[key] = current_metrics.get(key, 0) + value
                elif key.endswith("_rate") or key.endswith("_average"):
                    # For rates and averages, keep the latest value
                    current_metrics[key] = value
                else:
                    current_metrics[key] = value

            await self.redis.set(metrics_key, self._serialize_metrics(current_metrics), ex=7 * 24 * 3600)

    async def _create_alert(self, execution_id: str, alert_type: str, message: str) -> None:
        """Create alert for pipeline issues"""
        alert = {
            "alert_id": str(uuid.uuid4()),
            "execution_id": execution_id,
            "type": alert_type,
            "message": message,
            "created_at": datetime.utcnow().isoformat(),
            "acknowledged": False
        }

        alert_key = f"{self.alerts_prefix}{alert['alert_id']}"
        await self.redis.set(alert_key, self._serialize_alert(alert), ex=7 * 24 * 3600)

    async def _archive_execution(self, execution: PipelineExecution) -> None:
        """Archive execution to database (optional long-term storage)"""
        # This would store execution summary in PostgreSQL for long-term retention
        pass

    def _serialize_execution(self, execution: PipelineExecution) -> str:
        """Serialize execution for Redis storage"""
        import json
        return json.dumps(execution, default=str)

    def _deserialize_execution(self, data: str) -> PipelineExecution:
        """Deserialize execution from Redis storage"""
        import json
        return json.loads(data)  # Would need proper deserialization logic

    def _serialize_metrics(self, metrics: Dict) -> str:
        """Serialize metrics for Redis storage"""
        import json
        return json.dumps(metrics)

    def _deserialize_metrics(self, data: str) -> Dict:
        """Deserialize metrics from Redis storage"""
        import json
        return json.loads(data)

    def _serialize_log_entry(self, log_entry: Dict) -> str:
        """Serialize log entry for Redis storage"""
        import json
        return json.dumps(log_entry)

    def _deserialize_log_entry(self, data: str) -> Dict:
        """Deserialize log entry from Redis storage"""
        import json
        return json.loads(data)

    def _serialize_alert(self, alert: Dict) -> str:
        """Serialize alert for Redis storage"""
        import json
        return json.dumps(alert)
"""