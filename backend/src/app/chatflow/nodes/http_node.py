"""
HTTP Node - Make HTTP requests to external APIs.

WHY:
- Integrate external services
- Fetch data from APIs
- POST data to webhooks
- Support authentication

HOW:
- Use requests library
- Support credentials
- Handle responses
- Error handling

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from uuid import UUID
from sqlalchemy.orm import Session
import requests

from app.chatflow.nodes.base_node import BaseNode


class HTTPNode(BaseNode):
    """
    HTTP request node.

    WHY: API integration in workflows
    HOW: Execute HTTP requests with authentication
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute HTTP request.

        CONFIG:
            {
                "method": "POST",
                "url": "https://api.example.com/endpoint",
                "headers": {"Content-Type": "application/json"},
                "body": {"message": "{{input}}"},
                "credential_id": "uuid",  # Optional
                "timeout": 30
            }

        RETURNS:
            {
                "output": {...},  # Response JSON
                "success": True,
                "metadata": {
                    "status_code": 200,
                    "response_time_ms": 150
                }
            }
        """

        try:
            import time

            method = self.config.get("method", "GET")
            url = self.config.get("url")
            headers = self.config.get("headers", {})
            body = self.config.get("body", {})
            timeout = self.config.get("timeout", 30)

            # Resolve variables in URL and body
            url = self.resolve_variable(url, {**context.get("variables", {}), **inputs})

            # Resolve body variables
            if isinstance(body, dict):
                resolved_body = {}
                for key, value in body.items():
                    if isinstance(value, str):
                        resolved_body[key] = self.resolve_variable(value, {**context.get("variables", {}), **inputs})
                    else:
                        resolved_body[key] = value
                body = resolved_body

            # Get credentials if specified
            credential_id = self.config.get("credential_id")
            if credential_id:
                from app.services.credential_service import credential_service
                from app.models.credential import Credential

                credential = db.query(Credential).get(UUID(credential_id))
                if credential:
                    cred_data = credential_service.get_decrypted_data(db, credential)

                    # Add auth header
                    if "api_key" in cred_data:
                        headers["Authorization"] = f"Bearer {cred_data['api_key']}"

            # Make request
            start_time = time.time()

            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=body if method in ["POST", "PUT", "PATCH"] else None,
                timeout=timeout
            )

            response_time = int((time.time() - start_time) * 1000)

            response.raise_for_status()

            # Parse response
            try:
                output = response.json()
            except:
                output = response.text

            return {
                "output": output,
                "success": True,
                "error": None,
                "metadata": {
                    "status_code": response.status_code,
                    "response_time_ms": response_time,
                    "url": url
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate HTTP node configuration."""

        if not self.config.get("url"):
            return False, "URL is required"

        method = self.config.get("method", "GET")
        if method not in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
            return False, f"Invalid HTTP method: {method}"

        return True, None
