"""
User-Friendly Error Responses for AI Inference

WHY: Provides consistent, helpful error messages to users
HOW: Maps technical errors to user-friendly messages with suggestions
"""

from enum import Enum
from typing import Optional
from dataclasses import dataclass


class ErrorType(str, Enum):
    """Types of errors that can occur during inference."""

    # Context/KB errors
    NO_CONTEXT_FOUND = "no_context_found"
    KB_NOT_AVAILABLE = "kb_not_available"
    KB_EMPTY = "kb_empty"

    # Rate/limit errors
    RATE_LIMITED = "rate_limited"
    QUOTA_EXCEEDED = "quota_exceeded"
    MESSAGE_TOO_LONG = "message_too_long"

    # Service errors
    SERVICE_UNAVAILABLE = "service_unavailable"
    PROVIDER_ERROR = "provider_error"
    TIMEOUT = "timeout"

    # Input errors
    INVALID_INPUT = "invalid_input"
    JAILBREAK_DETECTED = "jailbreak_detected"

    # Session errors
    SESSION_EXPIRED = "session_expired"
    SESSION_NOT_FOUND = "session_not_found"

    # Generic
    UNKNOWN_ERROR = "unknown_error"


@dataclass
class UserFriendlyError:
    """A user-friendly error with message and suggestion."""
    message: str
    suggestion: Optional[str] = None
    show_retry: bool = True


# Map of error types to user-friendly messages
USER_FRIENDLY_ERRORS: dict[ErrorType, UserFriendlyError] = {
    # Context/KB errors
    ErrorType.NO_CONTEXT_FOUND: UserFriendlyError(
        message="I couldn't find relevant information in my knowledge base for your question.",
        suggestion="Could you try rephrasing your question or asking about a different topic?",
        show_retry=False
    ),
    ErrorType.KB_NOT_AVAILABLE: UserFriendlyError(
        message="I'm having trouble accessing my knowledge base right now.",
        suggestion="This is a temporary issue. Please try again in a moment.",
        show_retry=True
    ),
    ErrorType.KB_EMPTY: UserFriendlyError(
        message="My knowledge base doesn't have any content yet.",
        suggestion="Please check back later once content has been added.",
        show_retry=False
    ),

    # Rate/limit errors
    ErrorType.RATE_LIMITED: UserFriendlyError(
        message="I'm receiving too many requests right now.",
        suggestion="Please wait a moment before sending another message.",
        show_retry=True
    ),
    ErrorType.QUOTA_EXCEEDED: UserFriendlyError(
        message="You've reached the message limit for this period.",
        suggestion="Please try again later or contact support to increase your limit.",
        show_retry=False
    ),
    ErrorType.MESSAGE_TOO_LONG: UserFriendlyError(
        message="Your message is too long for me to process.",
        suggestion="Please try breaking it into smaller parts or shortening your question.",
        show_retry=False
    ),

    # Service errors
    ErrorType.SERVICE_UNAVAILABLE: UserFriendlyError(
        message="I'm having trouble connecting to my AI services.",
        suggestion="This is temporary. Please try again in a few seconds.",
        show_retry=True
    ),
    ErrorType.PROVIDER_ERROR: UserFriendlyError(
        message="Something went wrong while processing your request.",
        suggestion="Please try again. If the problem persists, try rephrasing your question.",
        show_retry=True
    ),
    ErrorType.TIMEOUT: UserFriendlyError(
        message="Your request took too long to process.",
        suggestion="Please try again with a shorter or simpler question.",
        show_retry=True
    ),

    # Input errors
    ErrorType.INVALID_INPUT: UserFriendlyError(
        message="I couldn't understand your message.",
        suggestion="Please try rephrasing your question.",
        show_retry=False
    ),
    ErrorType.JAILBREAK_DETECTED: UserFriendlyError(
        message="I'm designed to be helpful, harmless, and honest.",
        suggestion="How can I actually help you today?",
        show_retry=False
    ),

    # Session errors
    ErrorType.SESSION_EXPIRED: UserFriendlyError(
        message="Your session has expired.",
        suggestion="Please start a new conversation.",
        show_retry=False
    ),
    ErrorType.SESSION_NOT_FOUND: UserFriendlyError(
        message="I couldn't find your conversation.",
        suggestion="Please start a new conversation.",
        show_retry=False
    ),

    # Generic
    ErrorType.UNKNOWN_ERROR: UserFriendlyError(
        message="Something unexpected happened.",
        suggestion="Please try again. If the problem persists, contact support.",
        show_retry=True
    ),
}


def get_user_friendly_error(error_type: ErrorType) -> UserFriendlyError:
    """
    Get a user-friendly error message for the given error type.

    Args:
        error_type: The type of error that occurred

    Returns:
        UserFriendlyError with message and suggestion
    """
    return USER_FRIENDLY_ERRORS.get(
        error_type,
        USER_FRIENDLY_ERRORS[ErrorType.UNKNOWN_ERROR]
    )


def format_error_response(error_type: ErrorType) -> dict:
    """
    Format an error response for API return.

    Args:
        error_type: The type of error that occurred

    Returns:
        Dict with error details for API response
    """
    error = get_user_friendly_error(error_type)

    response = {
        "error": True,
        "error_type": error_type.value,
        "message": error.message,
    }

    if error.suggestion:
        response["suggestion"] = error.suggestion

    response["show_retry"] = error.show_retry

    return response


def map_exception_to_error_type(exception: Exception) -> ErrorType:
    """
    Map a Python exception to an ErrorType.

    Args:
        exception: The exception that was raised

    Returns:
        Appropriate ErrorType for the exception
    """
    exception_name = type(exception).__name__.lower()
    exception_message = str(exception).lower()

    # Check for specific exception types
    if "timeout" in exception_name or "timeout" in exception_message:
        return ErrorType.TIMEOUT

    if "rate" in exception_message and "limit" in exception_message:
        return ErrorType.RATE_LIMITED

    if "auth" in exception_name or "unauthorized" in exception_message:
        return ErrorType.PROVIDER_ERROR

    if "connection" in exception_name or "network" in exception_message:
        return ErrorType.SERVICE_UNAVAILABLE

    if "validation" in exception_name:
        return ErrorType.INVALID_INPUT

    # Default to unknown
    return ErrorType.UNKNOWN_ERROR
