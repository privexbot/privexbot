"""
Webhook Node - Send outbound webhooks to external systems.

WHY:
- Universal connector for Zapier, Make, n8n, custom systems
- Push conversation data to any external service
- Enable workflow automation beyond the chatflow
- Simpler than HTTPNode for outbound data push

HOW:
- POST/PUT/PATCH with structured payload templates
- Variable interpolation in URL, headers, and payload
- Retry logic for reliability
- Optional fire-and-forget mode (don't block flow on response)
- Credential support for authenticated webhooks
"""

import time
from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session
import requests

from app.chatflow.nodes.base_node import BaseNode


class WebhookNode(BaseNode):
    """
    Outbound webhook node for pushing data to external systems.

    WHY: Universal connector for external integrations
    HOW: Send HTTP POST with structured payload and retry logic
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute outbound webhook.

        CONFIG:
            {
                "url": "https://hooks.zapier.com/...",
                "method": "POST",  # POST, PUT, PATCH
                "headers": {},  # Optional custom headers
                "payload": {"name": "{{user_name}}", "message": "{{input}}"},
                "credential_id": "uuid",  # Optional
                "retry_count": 1,  # 0-3, default 1
                "timeout": 10,  # 5-30s, default 10
                "fire_and_forget": false  # Don't block on response
            }

        RETURNS:
            {
                "output": {...},  # Response data (or "sent" if fire_and_forget)
                "success": True,
                "metadata": {
                    "status_code": 200,
                    "response_time_ms": 150,
                    "attempts": 1
                }
            }
        """
        try:
            url = self.config.get("url")
            if not url:
                return self.handle_error(ValueError("Webhook URL is required"))

            method = self.config.get("method", "POST").upper()
            headers = dict(self.config.get("headers") or {})
            payload = self.config.get("payload", {})
            retry_count = min(self.config.get("retry_count", 1), 3)
            timeout = min(max(self.config.get("timeout", 10), 5), 30)
            fire_and_forget = self.config.get("fire_and_forget", False)

            # Merge context variables for resolution
            vars_ctx = {**context.get("variables", {}), **inputs}

            # Resolve variables in URL
            url = self.resolve_variable(url, vars_ctx)

            # Resolve variables in headers
            resolved_headers = {"Content-Type": "application/json"}
            for key, value in headers.items():
                if isinstance(value, str):
                    resolved_headers[key] = self.resolve_variable(value, vars_ctx)
                else:
                    resolved_headers[key] = value

            # Resolve variables in payload (recursive)
            resolved_payload = self._resolve_payload(payload, vars_ctx)

            # Apply credential if specified
            credential_id = self.config.get("credential_id")
            if credential_id:
                self._apply_credential(db, credential_id, resolved_headers)

            # Execute with retry
            last_error = None
            attempts = 0

            for attempt in range(retry_count + 1):
                attempts = attempt + 1
                try:
                    start_time = time.time()

                    response = requests.request(
                        method=method,
                        url=url,
                        headers=resolved_headers,
                        json=resolved_payload,
                        timeout=timeout
                    )

                    response_time = int((time.time() - start_time) * 1000)

                    if response.status_code < 400:
                        # Parse response
                        try:
                            output = response.json()
                        except Exception:
                            output = response.text or "OK"

                        return {
                            "output": output if not fire_and_forget else "sent",
                            "success": True,
                            "error": None,
                            "metadata": {
                                "status_code": response.status_code,
                                "response_time_ms": response_time,
                                "url": url,
                                "method": method,
                                "attempts": attempts
                            }
                        }
                    else:
                        last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                        if attempt < retry_count:
                            time.sleep(1 * (attempt + 1))  # Simple backoff

                except requests.exceptions.Timeout:
                    last_error = f"Webhook timeout after {timeout}s"
                    if attempt < retry_count:
                        time.sleep(1 * (attempt + 1))
                except requests.exceptions.ConnectionError:
                    last_error = f"Connection failed to {url}"
                    if attempt < retry_count:
                        time.sleep(1 * (attempt + 1))

            # All retries failed
            if fire_and_forget:
                return {
                    "output": "sent_with_errors",
                    "success": True,
                    "error": None,
                    "metadata": {
                        "warning": last_error,
                        "attempts": attempts,
                        "url": url
                    }
                }

            return {
                "output": None,
                "success": False,
                "error": last_error or "Webhook failed after all retries",
                "metadata": {
                    "attempts": attempts,
                    "url": url,
                    "method": method
                }
            }

        except Exception as e:
            return self.handle_error(e)

    def _resolve_payload(self, data: Any, vars_ctx: dict) -> Any:
        """Recursively resolve variables in payload."""
        if isinstance(data, str):
            return self.resolve_variable(data, vars_ctx)
        elif isinstance(data, dict):
            return {k: self._resolve_payload(v, vars_ctx) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._resolve_payload(item, vars_ctx) for item in data]
        return data

    def _apply_credential(self, db: Session, credential_id: str, headers: dict):
        """Apply credential authentication to headers."""
        from app.services.credential_service import credential_service
        from app.models.credential import Credential

        credential = db.query(Credential).get(UUID(credential_id))
        if credential:
            cred_data = credential_service.get_decrypted_data(db, credential)
            if "api_key" in cred_data:
                headers["Authorization"] = f"Bearer {cred_data['api_key']}"

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate webhook node configuration."""
        if not self.config.get("url"):
            return False, "Webhook URL is required"

        method = self.config.get("method", "POST").upper()
        if method not in ["POST", "PUT", "PATCH"]:
            return False, f"Invalid webhook method: {method}. Use POST, PUT, or PATCH."

        return True, None
