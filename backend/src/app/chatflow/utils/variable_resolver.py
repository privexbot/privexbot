"""
Variable Resolver - Resolve {{variable}} placeholders in strings.

WHY:
- Dynamic content in workflows
- Template support
- Variable interpolation
- Expression evaluation

HOW:
- Parse {{variable}} syntax
- Replace with context values
- Support nested access
- Handle missing variables

PSEUDOCODE follows the existing codebase patterns.
"""

import re
from typing import Any, Dict


class VariableResolver:
    """
    Resolve variable placeholders in strings.

    WHY: Template interpolation for chatflows
    HOW: Regex-based replacement with context lookup
    """

    def __init__(self):
        """
        Initialize variable resolver.

        WHY: Setup regex patterns
        HOW: Compile patterns for performance
        """
        # Pattern: {{variable_name}}
        self.variable_pattern = re.compile(r'\{\{([^}]+)\}\}')


    def resolve(self, template: str, context: Dict[str, Any]) -> str:
        """
        Resolve all variables in template.

        WHY: Replace {{variable}} with actual values
        HOW: Find and replace using context

        ARGS:
            template: String with {{variable}} placeholders
            context: Dictionary of variable values

        RETURNS:
            String with variables replaced

        EXAMPLES:
            resolve("Hello {{name}}", {"name": "John"})
            -> "Hello John"

            resolve("Total: {{price * quantity}}", {"price": 10, "quantity": 2})
            -> "Total: 20" (if expression support enabled)
        """

        if not isinstance(template, str):
            return str(template)

        def replace_variable(match):
            variable_name = match.group(1).strip()

            # Get value from context
            value = self._get_value(variable_name, context)

            return str(value) if value is not None else match.group(0)

        # Replace all variables
        result = self.variable_pattern.sub(replace_variable, template)

        return result


    def _get_value(self, variable_name: str, context: Dict[str, Any]) -> Any:
        """
        Get variable value from context.

        WHY: Support nested access and fallbacks
        HOW: Split by dots and traverse

        EXAMPLES:
            "user_name" -> context["user_name"]
            "user.name" -> context["user"]["name"]
            "items.0.name" -> context["items"][0]["name"]
        """

        # Handle dot notation for nested access
        parts = variable_name.split(".")

        current = context
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, (list, tuple)):
                try:
                    index = int(part)
                    current = current[index]
                except (ValueError, IndexError):
                    return None
            else:
                return None

            if current is None:
                return None

        return current


    def resolve_all(self, data: Any, context: Dict[str, Any]) -> Any:
        """
        Recursively resolve variables in nested data structures.

        WHY: Handle complex objects
        HOW: Traverse and resolve

        ARGS:
            data: Any data type (str, dict, list, etc.)
            context: Variable context

        RETURNS:
            Data with all variables resolved
        """

        if isinstance(data, str):
            return self.resolve(data, context)

        elif isinstance(data, dict):
            return {
                key: self.resolve_all(value, context)
                for key, value in data.items()
            }

        elif isinstance(data, list):
            return [
                self.resolve_all(item, context)
                for item in data
            ]

        else:
            return data


    def extract_variables(self, template: str) -> list[str]:
        """
        Extract all variable names from template.

        WHY: Validate templates
        HOW: Find all {{variable}} patterns

        ARGS:
            template: String with placeholders

        RETURNS:
            List of variable names found

        EXAMPLE:
            extract_variables("Hello {{name}}, {{greeting}}")
            -> ["name", "greeting"]
        """

        if not isinstance(template, str):
            return []

        matches = self.variable_pattern.findall(template)
        return [match.strip() for match in matches]


    def has_variables(self, template: str) -> bool:
        """
        Check if template contains any variables.

        WHY: Quick check for static vs dynamic content
        HOW: Search for pattern

        ARGS:
            template: String to check

        RETURNS:
            True if contains {{variable}} patterns
        """

        if not isinstance(template, str):
            return False

        return bool(self.variable_pattern.search(template))


    def validate_template(
        self,
        template: str,
        available_variables: list[str]
    ) -> tuple[bool, list[str]]:
        """
        Validate template against available variables.

        WHY: Catch missing variables before execution
        HOW: Extract required, check against available

        ARGS:
            template: Template string
            available_variables: List of available variable names

        RETURNS:
            (is_valid, missing_variables)

        EXAMPLE:
            validate_template("Hello {{name}}", ["name", "age"])
            -> (True, [])

            validate_template("Hello {{name}} {{title}}", ["name"])
            -> (False, ["title"])
        """

        required = self.extract_variables(template)
        missing = [var for var in required if var not in available_variables]

        return len(missing) == 0, missing


# Global instance
variable_resolver = VariableResolver()
