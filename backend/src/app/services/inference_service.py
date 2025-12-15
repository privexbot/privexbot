"""
Inference Service - Secret AI integration for LLM calls.

WHY:
- Centralized AI API calls (Secret AI)
- Used by both chatbots and chatflows
- Backend-only (never expose API keys to frontend)
- Error handling and retry logic

HOW:
- Call Secret AI API
- Handle streaming responses
- Track token usage
- Retry on failures

PSEUDOCODE follows the existing codebase patterns.
"""

import requests
import json
from typing import AsyncIterator, Optional

from app.core.config import settings


class InferenceError(Exception):
    """Base exception for inference errors."""
    pass


class RateLimitError(InferenceError):
    """Rate limit exceeded."""
    pass


class AuthError(InferenceError):
    """Authentication failed."""
    pass


class InferenceService:
    """
    Secret AI integration for LLM inference.

    WHY: Backend-only AI calls (security)
    HOW: HTTP requests to Secret AI API
    """

    def __init__(self):
        """
        Initialize Secret AI client.

        WHY: Load API key from settings
        HOW: Configure base URL and auth
        """
        self.api_key = settings.SECRET_AI_API_KEY
        self.base_url = getattr(settings, "SECRET_AI_BASE_URL", "https://api.secret.ai/v1")


    async def generate(
        self,
        prompt: str,
        model: str = "secret-ai-v1",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stop: Optional[list[str]] = None
    ) -> dict:
        """
        Generate AI response (non-streaming).

        ARGS:
            prompt: Input prompt
            model: Model name
            temperature: Randomness (0.0 = deterministic, 1.0 = creative)
            max_tokens: Maximum response length
            stop: Stop sequences

        RETURNS:
            {
                "text": "AI response",
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 50,
                    "total_tokens": 150
                }
            }
        """

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stop": stop or []
        }

        try:
            response = requests.post(
                f"{self.base_url}/completions",
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            return {
                "text": data["choices"][0]["text"],
                "usage": data["usage"]
            }

        except requests.exceptions.Timeout:
            raise TimeoutError("Secret AI request timed out")

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                raise RateLimitError("Rate limit exceeded")
            elif e.response.status_code == 401:
                raise AuthError("Invalid API key")
            else:
                raise InferenceError(f"API error: {e}")


    async def generate_stream(
        self,
        prompt: str,
        model: str = "secret-ai-v1",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> AsyncIterator[str]:
        """
        Generate AI response with streaming.

        WHY: Real-time response display in widget
        HOW: Server-sent events (SSE)

        YIELDS:
            Text chunks as they arrive
        """

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        response = requests.post(
            f"{self.base_url}/completions",
            headers=headers,
            json=payload,
            stream=True,
            timeout=60
        )

        response.raise_for_status()

        # Parse SSE stream
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')

                if line.startswith("data: "):
                    data = json.loads(line[6:])

                    if data.get("choices"):
                        chunk = data["choices"][0].get("text", "")
                        if chunk:
                            yield chunk


    async def generate_chat(
        self,
        messages: list[dict],
        model: str = "secret-ai-v1",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> dict:
        """
        Generate response using chat completion API.

        WHY: Better for conversation (understands roles)
        HOW: OpenAI-compatible chat API

        ARGS:
            messages: [
                {"role": "system", "content": "You are..."},
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi!"},
                {"role": "user", "content": "How are you?"}
            ]

        RETURNS:
            {
                "text": "AI response",
                "usage": {...}
            }
        """

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            return {
                "text": data["choices"][0]["message"]["content"],
                "usage": data["usage"]
            }

        except requests.exceptions.Timeout:
            raise TimeoutError("Secret AI request timed out")

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                raise RateLimitError("Rate limit exceeded")
            elif e.response.status_code == 401:
                raise AuthError("Invalid API key")
            else:
                raise InferenceError(f"API error: {e}")


    def generate_sync(
        self,
        prompt: str,
        model: str = "secret-ai-v1",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stop: Optional[list[str]] = None
    ) -> dict:
        """
        Generate AI response (synchronous version).

        WHY: For non-async contexts (Celery tasks, etc.)
        HOW: Same as generate() but without async

        ARGS:
            prompt: Input prompt
            model: Model name
            temperature: Randomness
            max_tokens: Maximum response length
            stop: Stop sequences

        RETURNS:
            {
                "text": "AI response",
                "usage": {...}
            }
        """

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stop": stop or []
        }

        try:
            response = requests.post(
                f"{self.base_url}/completions",
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            return {
                "text": data["choices"][0]["text"],
                "usage": data["usage"]
            }

        except requests.exceptions.Timeout:
            raise TimeoutError("Secret AI request timed out")

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                raise RateLimitError("Rate limit exceeded")
            elif e.response.status_code == 401:
                raise AuthError("Invalid API key")
            else:
                raise InferenceError(f"API error: {e}")


    def generate_chat_sync(
        self,
        messages: list[dict],
        model: str = "secret-ai-v1",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> dict:
        """
        Generate chat response (synchronous version).

        WHY: For non-async contexts
        HOW: Same as generate_chat() but without async

        ARGS:
            messages: Chat messages with roles
            model: Model name
            temperature: Randomness
            max_tokens: Maximum response length

        RETURNS:
            {
                "text": "AI response",
                "usage": {...}
            }
        """

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            return {
                "text": data["choices"][0]["message"]["content"],
                "usage": data["usage"]
            }

        except requests.exceptions.Timeout:
            raise TimeoutError("Secret AI request timed out")

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                raise RateLimitError("Rate limit exceeded")
            elif e.response.status_code == 401:
                raise AuthError("Invalid API key")
            else:
                raise InferenceError(f"API error: {e}")


# Global instance
inference_service = InferenceService()
