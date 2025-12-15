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
                "prompt": "System: {{system_prompt}}\\n\\nUser: {{input}}\\n\\nAssistant:",
                "model": "secret-ai-v1",
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

            # Resolve variables
            prompt = self.resolve_variable(prompt_template, {
                **context.get("variables", {}),
                **inputs,
                "system_prompt": self.config.get("system_prompt", "")
            })

            # Call LLM
            result = await inference_service.generate(
                prompt=prompt,
                model=self.config.get("model", "secret-ai-v1"),
                temperature=self.config.get("temperature", 0.7),
                max_tokens=self.config.get("max_tokens", 2000)
            )

            return {
                "output": result["text"],
                "success": True,
                "error": None,
                "metadata": {
                    "tokens_used": result["usage"],
                    "model": self.config.get("model"),
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
