"""
Lead Capture Node - Structured lead collection within chatflows.

WHY:
- Lead capture exists in chatbot service but NOT as a chatflow node
- Chatflows need explicit control over when and how leads are captured
- Validates fields, stores internally, optionally pushes to CRM

HOW:
- Collects fields from conversation context variables
- Validates required fields and format
- Stores via existing lead service
- Optionally pushes to external CRM via webhook
"""

import re
import time
from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session
import requests

from app.chatflow.nodes.base_node import BaseNode


class LeadCaptureNode(BaseNode):
    """
    Lead capture node for collecting and storing lead data.

    WHY: Structured lead collection with validation and CRM sync
    HOW: Extract fields from context, validate, store, and optionally push
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Capture lead data from conversation context.

        CONFIG:
            {
                "fields": [
                    {"name": "name", "source": "{{user_name}}", "required": true},
                    {"name": "email", "source": "{{user_email}}", "required": true, "validate": "email"},
                    {"name": "phone", "source": "{{user_phone}}", "required": false, "validate": "phone"},
                    {"name": "company", "source": "{{company}}", "required": false},
                    {"name": "message", "source": "{{input}}", "required": false}
                ],
                "store_internally": true,  # Save to PrivexBot leads table
                "crm_webhook_url": "",  # Optional: push to external CRM
                "crm_credential_id": "",  # Optional: auth for CRM webhook
                "duplicate_handling": "update",  # "skip", "update", "create"
                "consent_message": ""  # Optional GDPR consent text
            }

        RETURNS:
            {
                "output": {"name": "John", "email": "john@example.com", ...},
                "success": True,
                "metadata": {
                    "lead_id": "uuid",
                    "fields_captured": 3,
                    "crm_synced": true
                }
            }
        """
        try:
            fields_config = self.config.get("fields", [])
            store_internally = self.config.get("store_internally", True)
            crm_webhook_url = self.config.get("crm_webhook_url", "")
            duplicate_handling = self.config.get("duplicate_handling", "update")

            if not fields_config:
                return self.handle_error(ValueError("No fields configured for lead capture"))

            # Merge context for variable resolution
            vars_ctx = {**context.get("variables", {}), **inputs}

            # Extract and validate fields
            lead_data = {}
            validation_errors = []

            for field in fields_config:
                field_name = field.get("name")
                source = field.get("source", "")
                required = field.get("required", False)
                validate_type = field.get("validate")

                # Resolve the source value
                value = self.resolve_variable(source, vars_ctx) if source else ""
                value = value.strip() if isinstance(value, str) else value

                # Required check
                if required and not value:
                    validation_errors.append(f"'{field_name}' is required but empty")
                    continue

                # Format validation
                if value and validate_type:
                    is_valid, error = self._validate_field(value, validate_type)
                    if not is_valid:
                        validation_errors.append(f"'{field_name}': {error}")
                        continue

                if value:
                    lead_data[field_name] = value

            if validation_errors:
                return {
                    "output": {"validation_errors": validation_errors},
                    "success": False,
                    "error": f"Validation failed: {'; '.join(validation_errors)}",
                    "metadata": {
                        "fields_attempted": len(fields_config),
                        "errors": validation_errors
                    }
                }

            if not lead_data:
                return {
                    "output": None,
                    "success": False,
                    "error": "No lead data captured from conversation",
                    "metadata": {"fields_attempted": len(fields_config)}
                }

            lead_id = None
            crm_synced = False

            # Store internally using lead service
            if store_internally:
                lead_id = await self._store_lead(db, context, lead_data, duplicate_handling)

            # Push to CRM via webhook
            if crm_webhook_url:
                crm_synced = await self._push_to_crm(db, crm_webhook_url, lead_data, vars_ctx)

            return {
                "output": lead_data,
                "success": True,
                "error": None,
                "metadata": {
                    "lead_id": str(lead_id) if lead_id else None,
                    "fields_captured": len(lead_data),
                    "stored_internally": store_internally and lead_id is not None,
                    "crm_synced": crm_synced,
                    "duplicate_handling": duplicate_handling
                }
            }

        except Exception as e:
            return self.handle_error(e)

    def _validate_field(self, value: str, validate_type: str) -> tuple[bool, Optional[str]]:
        """Validate a field value against a type."""
        if validate_type == "email":
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if re.match(pattern, value):
                return True, None
            return False, "Invalid email format"

        elif validate_type == "phone":
            # Accept common phone formats
            cleaned = re.sub(r'[\s\-\(\)\.]', '', value)
            if re.match(r'^\+?\d{7,15}$', cleaned):
                return True, None
            return False, "Invalid phone number"

        elif validate_type == "url":
            if re.match(r'^https?://\S+', value):
                return True, None
            return False, "Invalid URL"

        return True, None

    async def _store_lead(
        self,
        db: Session,
        context: Dict[str, Any],
        lead_data: dict,
        duplicate_handling: str
    ) -> Optional[str]:
        """Store lead in the database using lead service."""
        try:
            from app.services.lead_capture_service import lead_capture_service

            workspace_id = context.get("workspace_id")
            session_id = context.get("session_id")

            # Check for duplicate by email
            email = lead_data.get("email")
            if email and duplicate_handling in ("skip", "update"):
                from app.models.lead import Lead
                existing = db.query(Lead).filter(
                    Lead.workspace_id == workspace_id,
                    Lead.email == email
                ).first()

                if existing:
                    if duplicate_handling == "skip":
                        return str(existing.id)
                    elif duplicate_handling == "update":
                        # Update existing lead
                        for key, value in lead_data.items():
                            if hasattr(existing, key) and value:
                                setattr(existing, key, value)
                        existing.metadata = {
                            **(existing.metadata or {}),
                            "last_session_id": str(session_id) if session_id else None,
                            "updated_via": "chatflow_lead_capture"
                        }
                        db.commit()
                        return str(existing.id)

            # Create new lead
            lead = lead_capture_service.capture_lead(
                db=db,
                workspace_id=workspace_id,
                data={
                    **lead_data,
                    "source": "chatflow",
                    "session_id": str(session_id) if session_id else None,
                }
            )

            return str(lead.id) if lead else None

        except Exception:
            # Don't fail the node if internal storage fails
            return None

    async def _push_to_crm(
        self,
        db: Session,
        crm_url: str,
        lead_data: dict,
        vars_ctx: dict
    ) -> bool:
        """Push lead data to external CRM via webhook."""
        try:
            crm_url = self.resolve_variable(crm_url, vars_ctx)
            headers = {"Content-Type": "application/json"}

            # Apply credential if specified
            credential_id = self.config.get("crm_credential_id")
            if credential_id:
                from app.services.credential_service import credential_service
                from app.models.credential import Credential

                credential = db.query(Credential).get(UUID(credential_id))
                if credential:
                    cred_data = credential_service.get_decrypted_data(db, credential)
                    if "api_key" in cred_data:
                        headers["Authorization"] = f"Bearer {cred_data['api_key']}"

            response = requests.post(crm_url, json=lead_data, headers=headers, timeout=10)
            return response.status_code < 400

        except Exception:
            return False

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate lead capture node configuration."""
        fields = self.config.get("fields", [])
        if not fields:
            return False, "At least one field is required"

        for field in fields:
            if not field.get("name"):
                return False, "Each field must have a name"
            if not field.get("source"):
                return False, f"Field '{field.get('name')}' must have a source"

        duplicate_handling = self.config.get("duplicate_handling", "update")
        if duplicate_handling not in ["skip", "update", "create"]:
            return False, f"Invalid duplicate handling: {duplicate_handling}"

        return True, None
