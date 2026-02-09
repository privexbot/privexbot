"""
LLM Node - AI text generation node.

WHY:
- Generate AI responses in workflows
- Support system prompts and templates
- Handle context and history
- Token tracking

HOW:
- Call inference_service
- Support variable interpolation
- Track usage metadata
- Handle streaming

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode
from app.services.inference_service import inference_service


class LLMNode(BaseNode):
    """
    LLM text generation node.

    WHY: AI-powered text generation in workflows
    HOW: Call inference service with prompt template
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute LLM generation.

        CONFIG:
            {
                "prompt": "{{input}}",
                "model": null,  # None = use provider default (DeepSeek-R1-Distill-Llama-70B)
                "temperature": 0.7,
                "max_tokens": 2000,
                "system_prompt": "You are a helpful assistant"
            }

        INPUTS:
            {
                "input": "User message text"
            }

        RETURNS:
            {
                "output": "AI generated text",
                "success": True,
                "metadata": {
                    "tokens_used": {...}
                }
            }
        """

        try:
            # Get prompt template
            prompt_template = self.config.get("prompt", "{{input}}")

            # Resolve variables in prompt
            prompt = self.resolve_variable(prompt_template, {
                **context.get("variables", {}),
                **inputs,
                "system_prompt": self.config.get("system_prompt", "")
            })

            # Build structured messages for generate_chat()
            messages = []

            # Add system prompt if configured
            system_prompt = self.config.get("system_prompt", "")
            if system_prompt:
                resolved_system = self.resolve_variable(system_prompt, {
                    **context.get("variables", {}),
                    **inputs
                })
                messages.append({"role": "system", "content": resolved_system})

            # Add chat history if available
            for msg in context.get("history", []):
                # Handle both ChatMessage objects and dicts (preview mode)
                if hasattr(msg, "role"):
                    role_value = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
                    content = msg.content
                elif isinstance(msg, dict):
                    role_value = msg.get("role", "user")
                    content = msg.get("content", "")
                else:
                    continue
                role = "user" if role_value == "user" else "assistant"
                messages.append({"role": role, "content": content})

            # Add the resolved prompt as user message
            messages.append({"role": "user", "content": prompt})

            # Call LLM with structured messages
            result = await inference_service.generate_chat(
                messages=messages,
                model=self.config.get("model"),  # None = use provider default
                temperature=self.config.get("temperature", 0.7),
                max_tokens=self.config.get("max_tokens", 2000)
            )

            return {
                "output": result["text"],
                "success": True,
                "error": None,
                "metadata": {
                    "tokens_used": result["usage"],
                    "model": result.get("model", self.config.get("model")),
                    "prompt_length": len(prompt)
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate LLM node configuration."""

        if not self.config.get("prompt"):
            return False, "Prompt template is required"

        return True, None
