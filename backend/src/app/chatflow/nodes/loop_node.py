"""
Loop Node - Iterate over arrays/lists.

WHY:
- Process multiple items
- Batch operations
- Map/reduce patterns
- Dynamic workflows

HOW:
- Iterate over input array
- Execute sub-workflow
- Collect results
- Return aggregated output

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import Any, Dict
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class LoopNode(BaseNode):
    """
    Loop/iteration node.

    WHY: Process arrays in workflows
    HOW: Iterate and collect results
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute loop over array.

        CONFIG:
            {
                "array": "{{items}}",  # Variable containing array
                "max_iterations": 100,
                "item_variable": "current_item",
                "index_variable": "index"
            }

        INPUTS:
            {
                "items": [1, 2, 3, 4, 5]
            }

        RETURNS:
            {
                "output": [...],  # Collected results
                "success": True,
                "metadata": {
                    "iterations": 5
                }
            }

        NOTE: In full implementation, this would execute
        a sub-graph for each item. This is simplified.
        """

        try:
            array_template = self.config.get("array", "{{input}}")
            max_iterations = self.config.get("max_iterations", 100)
            item_variable = self.config.get("item_variable", "item")
            index_variable = self.config.get("index_variable", "index")

            # Resolve array
            array_value = self.resolve_variable(array_template, {
                **context.get("variables", {}),
                **inputs
            })

            # Ensure it's an array
            if isinstance(array_value, str):
                import json
                try:
                    array_value = json.loads(array_value)
                except:
                    array_value = [array_value]
            elif not isinstance(array_value, (list, tuple)):
                array_value = [array_value]

            # Limit iterations
            array_value = array_value[:max_iterations]

            # Process each item (simplified - in full version would execute sub-graph)
            results = []
            for index, item in enumerate(array_value):
                # Set loop variables
                context["variables"][item_variable] = item
                context["variables"][index_variable] = index

                # In full implementation, would execute sub-workflow here
                # For now, just collect items
                results.append({
                    "index": index,
                    "item": item,
                    "result": str(item)  # Placeholder
                })

            return {
                "output": results,
                "success": True,
                "error": None,
                "metadata": {
                    "iterations": len(array_value),
                    "max_iterations": max_iterations
                }
            }

        except Exception as e:
            return self.handle_error(e)


    def validate_config(self) -> tuple[bool, str | None]:
        """Validate loop node configuration."""

        if not self.config.get("array"):
            return False, "Array variable is required"

        max_iter = self.config.get("max_iterations", 100)
        if max_iter > 1000:
            return False, "Max iterations cannot exceed 1000"

        return True, None
