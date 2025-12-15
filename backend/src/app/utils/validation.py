"""
Validation Utilities - Common validation functions.

WHY:
- Reusable validation logic
- Input sanitization
- Security checks
- Data consistency

HOW:
- Regex patterns
- Type checking
- Business logic validation
- Security filters

PSEUDOCODE follows the existing codebase patterns.
"""

import re
from typing import Optional, List, Any, Dict
from urllib.parse import urlparse
from uuid import UUID


class ValidationError(Exception):
    """Validation error exception."""
    pass


def validate_email(email: str) -> bool:
    """
    Validate email address.

    WHY: Ensure valid email format
    HOW: Regex pattern matching

    ARGS:
        email: Email address to validate

    RETURNS:
        True if valid, False otherwise
    """

    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_url(url: str, allowed_schemes: Optional[List[str]] = None) -> bool:
    """
    Validate URL format and scheme.

    WHY: Security - prevent malicious URLs
    HOW: Parse and check scheme

    ARGS:
        url: URL to validate
        allowed_schemes: List of allowed schemes (default: ['http', 'https'])

    RETURNS:
        True if valid, False otherwise
    """

    if allowed_schemes is None:
        allowed_schemes = ['http', 'https']

    try:
        parsed = urlparse(url)
        return parsed.scheme in allowed_schemes and bool(parsed.netloc)
    except Exception:
        return False


def validate_uuid(value: str) -> bool:
    """
    Validate UUID format.

    WHY: Ensure valid UUID
    HOY: Try to parse as UUID

    ARGS:
        value: String to validate as UUID

    RETURNS:
        True if valid UUID, False otherwise
    """

    try:
        UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


def sanitize_html(text: str) -> str:
    """
    Sanitize HTML/script tags from text.

    WHY: Prevent XSS attacks
    HOW: Remove dangerous tags

    ARGS:
        text: Text to sanitize

    RETURNS:
        Sanitized text
    """

    # Remove script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Remove iframe tags
    text = re.sub(r'<iframe[^>]*>.*?</iframe>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Remove onclick/onerror attributes
    text = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)

    return text


def validate_json_structure(data: dict, required_fields: List[str]) -> Tuple[bool, List[str]]:
    """
    Validate JSON structure has required fields.

    WHY: Ensure data completeness
    HOW: Check for required keys

    ARGS:
        data: Dictionary to validate
        required_fields: List of required field names

    RETURNS:
        (is_valid, missing_fields)
    """

    missing_fields = [
        field for field in required_fields
        if field not in data or data[field] is None
    ]

    return len(missing_fields) == 0, missing_fields


def validate_phone_number(phone: str) -> bool:
    """
    Validate phone number format.

    WHY: Basic phone validation
    HOW: Regex pattern for international format

    ARGS:
        phone: Phone number to validate

    RETURNS:
        True if valid format, False otherwise

    NOTE: Accepts formats like:
        - +1234567890
        - +1 (234) 567-8900
        - 1234567890
    """

    # Remove common separators
    cleaned = re.sub(r'[\s\-\(\)\.]+', '', phone)

    # Check if it's all digits (with optional + prefix)
    pattern = r'^\+?[1-9]\d{1,14}$'
    return bool(re.match(pattern, cleaned))


def validate_domain(domain: str) -> bool:
    """
    Validate domain name.

    WHY: Check domain format for allowed_domains
    HOW: Regex pattern matching

    ARGS:
        domain: Domain name (e.g., "example.com")

    RETURNS:
        True if valid, False otherwise
    """

    pattern = r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$'
    return bool(re.match(pattern, domain))


def validate_chatflow_graph(nodes: List[dict], edges: List[dict]) -> Tuple[bool, List[str]]:
    """
    Validate chatflow graph structure.

    WHY: Ensure executable chatflow
    HOW: Check nodes, edges, connectivity

    ARGS:
        nodes: List of node configurations
        edges: List of edge configurations

    RETURNS:
        (is_valid, errors)
    """

    errors = []

    # Check for nodes
    if not nodes:
        errors.append("No nodes found")
        return False, errors

    # Check for required node types
    node_types = [node.get("type") for node in nodes]

    if "trigger" not in node_types:
        errors.append("No trigger node found")

    if "response" not in node_types:
        errors.append("No response node found")

    # Check node IDs are unique
    node_ids = [node.get("id") for node in nodes]
    if len(node_ids) != len(set(node_ids)):
        errors.append("Duplicate node IDs found")

    # Check edges reference valid nodes
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")

        if source not in node_ids:
            errors.append(f"Edge references invalid source node: {source}")

        if target not in node_ids:
            errors.append(f"Edge references invalid target node: {target}")

    return len(errors) == 0, errors


def validate_variable_name(name: str) -> bool:
    """
    Validate variable name format.

    WHY: Ensure valid variable names for {{variable}}
    HOW: Check alphanumeric + underscore

    ARGS:
        name: Variable name

    RETURNS:
        True if valid, False otherwise

    VALID: user_name, userName, user123
    INVALID: user-name, 123user, user name
    """

    pattern = r'^[a-zA-Z_][a-zA-Z0-9_]*$'
    return bool(re.match(pattern, name))


def validate_cron_expression(expression: str) -> bool:
    """
    Validate cron expression format.

    WHY: Ensure valid cron for scheduled tasks
    HOW: Basic cron pattern check

    ARGS:
        expression: Cron expression (e.g., "0 0 * * *")

    RETURNS:
        True if valid format, False otherwise
    """

    parts = expression.split()

    # Cron has 5 parts: minute hour day month weekday
    if len(parts) != 5:
        return False

    # Each part should be number, *, or range
    for part in parts:
        if not re.match(r'^(\*|[0-9,-/]+)$', part):
            return False

    return True


def validate_api_key_format(api_key: str, prefix: Optional[str] = None) -> bool:
    """
    Validate API key format.

    WHY: Check API key structure
    HOW: Pattern matching

    ARGS:
        api_key: API key to validate
        prefix: Expected prefix (e.g., "sk-" for OpenAI)

    RETURNS:
        True if valid format, False otherwise
    """

    if prefix and not api_key.startswith(prefix):
        return False

    # Minimum length check
    if len(api_key) < 20:
        return False

    # Should contain alphanumeric and possibly dashes/underscores
    pattern = r'^[a-zA-Z0-9_\-]+$'
    return bool(re.match(pattern, api_key))


def validate_sql_injection(query: str) -> bool:
    """
    Basic SQL injection detection.

    WHY: Security check for user inputs
    HOW: Check for common SQL injection patterns

    ARGS:
        query: User input to check

    RETURNS:
        True if safe, False if potential SQL injection detected
    """

    # Common SQL injection patterns
    dangerous_patterns = [
        r'(\bunion\b.*\bselect\b)',
        r'(\bdrop\b.*\btable\b)',
        r'(\bdelete\b.*\bfrom\b)',
        r'(\binsert\b.*\binto\b)',
        r'(\bupdate\b.*\bset\b)',
        r'(--)',
        r'(;.*drop)',
        r'(\bexec\b)',
        r'(\bexecute\b)',
    ]

    query_lower = query.lower()

    for pattern in dangerous_patterns:
        if re.search(pattern, query_lower, re.IGNORECASE):
            return False

    return True


def validate_chunking_config(config: dict) -> Tuple[bool, List[str]]:
    """
    Validate chunking configuration.

    WHY: Ensure valid chunking settings
    HOW: Check required fields and ranges

    ARGS:
        config: Chunking configuration dict

    RETURNS:
        (is_valid, errors)
    """

    errors = []

    # Check strategy
    strategy = config.get("strategy")
    if strategy not in ["recursive", "sentence", "token"]:
        errors.append(f"Invalid strategy: {strategy}")

    # Check chunk_size
    chunk_size = config.get("chunk_size", 0)
    if not isinstance(chunk_size, int) or chunk_size < 100 or chunk_size > 10000:
        errors.append("chunk_size must be between 100 and 10000")

    # Check chunk_overlap
    chunk_overlap = config.get("chunk_overlap", 0)
    if not isinstance(chunk_overlap, int) or chunk_overlap < 0:
        errors.append("chunk_overlap must be >= 0")

    # Overlap should be less than chunk_size
    if chunk_overlap >= chunk_size:
        errors.append("chunk_overlap must be less than chunk_size")

    return len(errors) == 0, errors


from typing import Tuple


def validate_rate_limit(
    identifier: str,
    max_requests: int,
    window_seconds: int,
    redis_client: Any
) -> bool:
    """
    Check rate limit for identifier.

    WHY: Prevent abuse
    HOW: Redis counter with expiry

    ARGS:
        identifier: Unique identifier (user_id, ip, etc.)
        max_requests: Maximum requests allowed
        window_seconds: Time window in seconds
        redis_client: Redis client instance

    RETURNS:
        True if within limit, False if exceeded
    """

    key = f"rate_limit:{identifier}"

    # Increment counter
    current = redis_client.incr(key)

    # Set expiry on first request
    if current == 1:
        redis_client.expire(key, window_seconds)

    return current <= max_requests
