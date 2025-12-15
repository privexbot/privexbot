"""
Database Node - Execute database queries.

WHY:
- Query databases in workflows
- Fetch user data
- Store results
- Data-driven workflows

HOW:
- Use SQLAlchemy
- Support credentials
- Parameterized queries
- Return results

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text

from app.chatflow.nodes.base_node import BaseNode


class DatabaseNode(BaseNode):
    """
    Database query node.

    WHY: Data access in workflows
    HOW: Execute SQL queries safely
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute database query.

        CONFIG:
            {
                "credential_id": "uuid",
                "query": "SELECT * FROM users WHERE email = :email",
                "parameters": {"email": "{{input}}"},
                "operation": "select"  # select, insert, update, delete
            }

        RETURNS:
            {
                "output": [{"col1": "val1"}, ...],
                "success": True,
                "metadata": {
                    "row_count": 5
                }
            }

        SECURITY:
            - Only parameterized queries
            - No string concatenation
            - Limited operations
            - Credential-based access
        """

        try:
            credential_id = self.config.get("credential_id")
            if not credential_id:
                raise ValueError("Credential ID required")

            # Get database credential
            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if not credential or credential.credential_type.value != "database":
                raise ValueError("Invalid database credential")

            cred_data = credential_service.get_decrypted_data(db, credential)

            # Build connection string
            conn_str = self._build_connection_string(cred_data)

            # Get query
            query_template = self.config.get("query", "")
            parameters = self.config.get("parameters", {})

            # Resolve parameters
            resolved_params = {}
            for key, value_template in parameters.items():
                if isinstance(value_template, str):
                    resolved_params[key] = self.resolve_variable(value_template, {
                        **context.get("variables", {}),
                        **inputs
                    })
                else:
                    resolved_params[key] = value_template

            # Execute query
            engine = create_engine(conn_str)
            with engine.connect() as conn:
                result = conn.execute(text(query_template), resolved_params)

                # Get operation type
                operation = self.config.get("operation", "select")

                if operation == "select":
                    # Fetch results
                    rows = result.fetchall()
                    columns = result.keys()

                    # Convert to list of dicts
                    output = [dict(zip(columns, row)) for row in rows]
                    row_count = len(output)

                else:
                    # For insert/update/delete, return affected rows
                    output = {"affected_rows": result.rowcount}
                    row_count = result.rowcount
                    conn.commit()

            return {
                "output": output,
                "success": True,
                "error": None,
                "metadata": {
                    "row_count": row_count,
                    "operation": operation
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def _build_connection_string(self, cred_data: dict) -> str:
        """Build database connection string from credentials."""

        db_type = cred_data.get("type", "postgresql")
        host = cred_data["host"]
        port = cred_data["port"]
        database = cred_data["database"]
        username = cred_data["username"]
        password = cred_data["password"]

        return f"{db_type}://{username}:{password}@{host}:{port}/{database}"


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate database node configuration."""

        if not self.config.get("credential_id"):
            return False, "Credential ID is required"

        if not self.config.get("query"):
            return False, "Query is required"

        # Security check - no raw SQL injection
        query = self.config.get("query", "").upper()
        if "DROP" in query or "TRUNCATE" in query or "ALTER" in query:
            return False, "Dangerous SQL operations not allowed"

        return True, None
