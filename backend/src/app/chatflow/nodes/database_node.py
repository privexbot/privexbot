"""
Database Node - Execute database queries.

WHY:
- Query databases in workflows
- Fetch user data
- Store results
- Data-driven workflows

HOW:
- Use SQLAlchemy with bound (parameterized) values
- Support credentials
- Restrict statements to the declared operation (no DDL, no multi-statement)
- Guard the target host (SSRF) and dispose the engine each run
"""

import re
from typing import Any, Dict
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.chatflow.nodes.base_node import BaseNode
from app.chatflow.utils.ssrf_guard import assert_safe_host

# Operations the node supports (frontend may send "query" as an alias of select).
_ALLOWED_OPERATIONS = {"select", "insert", "update", "delete"}
# Database drivers we build a connection string + connect_args for. Only
# PostgreSQL is supported — psycopg2 is the sole DB driver installed.
_ALLOWED_DB_TYPES = {"postgresql", "postgres"}
# Statement-level keywords that must never appear in a SELECT (closes the
# Postgres `WITH x AS (DELETE ... RETURNING) SELECT` data-modifying-CTE bypass)
# and must not be a second statement under insert/update/delete.
_DML_DDL_TOKENS = (
    "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER",
    "GRANT", "REVOKE", "CREATE", "MERGE", "CALL", "EXECUTE", "COPY",
)

_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT = re.compile(r"--[^\n]*")


def _strip_comments(query: str) -> str:
    """Remove /* block */ and -- line comments so they can't hide keywords."""
    no_block = _BLOCK_COMMENT.sub(" ", query)
    return _LINE_COMMENT.sub(" ", no_block)


def _normalize_operation(operation: str) -> str:
    op = (operation or "select").lower()
    return "select" if op == "query" else op


def _assert_safe_query(query: str, operation: str) -> str:
    """Validate the (static, config-time) SQL against the declared operation.

    Returns the normalized operation, or raises ValueError. Used by both
    validate_config and execute (the query is never variable-resolved, so
    config-time validation is authoritative; execute-time is defense-in-depth).
    """
    op = _normalize_operation(operation)
    if op not in _ALLOWED_OPERATIONS:
        raise ValueError(f"Unsupported database operation: {operation}")

    stripped = _strip_comments(query).strip()
    if not stripped:
        raise ValueError("Query is required")

    # Reject multiple statements: a ';' followed by more SQL.
    body = stripped.rstrip(";").strip()
    if ";" in body:
        raise ValueError("Multiple SQL statements are not allowed")

    upper = body.upper()
    # Leading keyword (first word).
    leading = upper.split(None, 1)[0] if upper.split() else ""

    if op == "select":
        if leading not in ("SELECT", "WITH"):
            raise ValueError("Query must be a SELECT statement for the 'select' operation")
        # No data-modifying keyword anywhere (covers data-modifying CTEs).
        for tok in _DML_DDL_TOKENS:
            if re.search(rf"\b{tok}\b", upper):
                raise ValueError(f"'{tok}' is not allowed in a read (select) query")
    else:
        # insert / update / delete: leading keyword must match the operation,
        # and no second data-modifying/DDL keyword may appear.
        if leading != op.upper():
            raise ValueError(
                f"Query must start with {op.upper()} for the '{op}' operation"
            )
        for tok in _DML_DDL_TOKENS:
            if tok == op.upper():
                continue
            if re.search(rf"\b{tok}\b", upper):
                raise ValueError(f"'{tok}' is not allowed in an {op} query")

    return op


class DatabaseNode(BaseNode):
    """
    Database query node.

    WHY: Data access in workflows
    HOW: Execute SQL queries safely with bound parameters
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
            {"output": [...] | {"affected_rows": n}, "success": True,
             "metadata": {"row_count": n, "operation": op}}
        """
        engine = None
        try:
            credential_id = self.config.get("credential_id")
            if not credential_id:
                raise ValueError("Credential ID required")

            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if not credential or credential.credential_type.value != "database":
                raise ValueError("Invalid database credential")

            cred_data = credential_service.get_decrypted_data(db, credential)

            db_type = (cred_data.get("type", "postgresql") or "postgresql").lower()
            if db_type not in _ALLOWED_DB_TYPES:
                raise ValueError(f"Unsupported database type: {db_type}")

            # Validate the statement against the declared operation BEFORE we
            # touch the network.
            query_template = self.config.get("query", "")
            operation = _assert_safe_query(query_template, self.config.get("operation", "select"))

            # SSRF guard: the credential host is builder-controlled.
            assert_safe_host(str(cred_data.get("host", "")))

            # Resolve bound parameters (values only — never the query string).
            raw_parameters = self.config.get("parameters", {})
            if isinstance(raw_parameters, list):
                parameters = {
                    p["name"]: p.get("value", "")
                    for p in raw_parameters
                    if isinstance(p, dict) and p.get("name")
                }
            else:
                parameters = raw_parameters

            resolved_params = {}
            for key, value_template in parameters.items():
                if isinstance(value_template, str):
                    resolved_params[key] = self.resolve_variable(value_template, {
                        **context.get("variables", {}),
                        **inputs
                    })
                else:
                    resolved_params[key] = value_template

            conn_str = self._build_connection_string(cred_data)
            engine = create_engine(
                conn_str,
                pool_pre_ping=True,
                connect_args=self._connect_args(cred_data),
            )

            with engine.connect() as conn:
                result = conn.execute(text(query_template), resolved_params)

                if operation == "select":
                    rows = result.fetchall()
                    columns = result.keys()
                    output = [dict(zip(columns, row)) for row in rows]
                    row_count = len(output)
                else:
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

        except SQLAlchemyError:
            # Never surface str(e): SQLAlchemy errors can embed the connection
            # string (with password). Return a generic, safe message.
            return {
                "output": None,
                "success": False,
                "error": "Database connection or query failed. Check the credential and query.",
                "metadata": {"node_id": self.node_id, "node_type": self.node_type},
            }
        except Exception as e:
            return self.handle_error(e)
        finally:
            if engine is not None:
                engine.dispose()

    def _connect_args(self, cred_data: dict) -> dict:
        """Driver-specific connect args (timeouts). Empty for drivers we don't
        special-case so unknown keys never raise."""
        db_type = (cred_data.get("type", "postgresql") or "postgresql").lower()
        if db_type in ("postgresql", "postgres"):
            # psycopg2: connection timeout (s) + server-side statement timeout (ms).
            return {"connect_timeout": 10, "options": "-c statement_timeout=30000"}
        if db_type == "mysql":
            return {"connect_timeout": 10}
        return {}

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

        query = self.config.get("query")
        if not query:
            return False, "Query is required"

        try:
            _assert_safe_query(query, self.config.get("operation", "select"))
        except ValueError as e:
            return False, str(e)

        return True, None
