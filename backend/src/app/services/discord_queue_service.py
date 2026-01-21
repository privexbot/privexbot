"""
Discord Queue Service - Rate-limited message queue for Discord responses.

WHY:
- Discord has strict rate limits (50 req/sec global, 5 msg/5sec per channel)
- Multiple chatbots sharing one bot token need coordinated sending
- Prevent API bans from rate limit violations
- Ensure fair message delivery across all guilds

HOW:
- Redis queue for pending messages
- Rate limit tracking per channel
- Global rate limit tracking
- Background worker processes queue respecting limits
- Priority support for interactive responses

Rate Limits (Discord):
- Global: 50 requests/second per bot
- Per Channel: 5 messages per 5 seconds
- Webhook: 30 requests per minute per webhook
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import UUID
import httpx

from app.core.config import settings


class DiscordQueueService:
    """
    Queue Discord responses with rate limiting.

    WHY: Prevent Discord API rate limit violations
    HOW: Redis queue + rate limit tracking
    """

    # Rate limits
    GLOBAL_RATE_LIMIT = 50  # requests per second
    CHANNEL_RATE_LIMIT = 5   # messages per 5 seconds
    CHANNEL_WINDOW = 5       # seconds

    def __init__(self):
        """Initialize queue service."""
        self._redis = None

    @property
    def redis(self):
        """Lazy load Redis client."""
        if self._redis is None:
            import redis
            self._redis = redis.from_url(settings.REDIS_URL)
        return self._redis

    async def enqueue_response(
        self,
        guild_id: str,
        channel_id: str,
        message: str,
        priority: int = 0,
        embeds: List[Dict] = None,
        interaction_token: str = None
    ) -> str:
        """
        Add response to queue for sending.

        WHY: Decouple response generation from sending
        HOW: Add to Redis sorted set with timestamp priority

        ARGS:
            guild_id: Discord server ID
            channel_id: Discord channel ID
            message: Message content
            priority: Lower = higher priority (0 = interactive response)
            embeds: Optional list of Discord embeds
            interaction_token: If responding to an interaction

        RETURNS:
            Queue entry ID
        """
        entry_id = f"discord_msg_{int(time.time() * 1000)}"

        payload = {
            "id": entry_id,
            "guild_id": guild_id,
            "channel_id": channel_id,
            "message": message[:2000],  # Discord limit
            "embeds": embeds or [],
            "interaction_token": interaction_token,
            "timestamp": time.time(),
            "attempts": 0
        }

        # Priority score: lower = processed first
        # Use timestamp + priority offset
        score = time.time() + priority

        self.redis.zadd(
            "discord_response_queue",
            {json.dumps(payload): score}
        )

        return entry_id

    def check_channel_rate_limit(self, channel_id: str) -> bool:
        """
        Check if we can send to this channel.

        WHY: Respect Discord per-channel rate limits
        HOW: Track messages in sliding window

        ARGS:
            channel_id: Discord channel ID

        RETURNS:
            True if within limit, False if rate limited
        """
        key = f"discord_rate:channel:{channel_id}"
        current = self.redis.incr(key)

        # Set expiry on first request in window
        if current == 1:
            self.redis.expire(key, self.CHANNEL_WINDOW)

        return current <= self.CHANNEL_RATE_LIMIT

    def check_global_rate_limit(self) -> bool:
        """
        Check global rate limit.

        WHY: Respect Discord global rate limit
        HOW: Track total requests per second

        RETURNS:
            True if within limit, False if rate limited
        """
        key = "discord_rate:global"
        current = self.redis.incr(key)

        # 1 second window
        if current == 1:
            self.redis.expire(key, 1)

        return current <= self.GLOBAL_RATE_LIMIT

    def get_remaining_channel_quota(self, channel_id: str) -> int:
        """
        Get remaining messages allowed for channel.

        ARGS:
            channel_id: Discord channel ID

        RETURNS:
            Number of messages remaining in window
        """
        key = f"discord_rate:channel:{channel_id}"
        current = int(self.redis.get(key) or 0)
        return max(0, self.CHANNEL_RATE_LIMIT - current)

    def get_queue_length(self) -> int:
        """Get number of messages in queue."""
        return self.redis.zcard("discord_response_queue")

    async def process_queue(self):
        """
        Background worker to process queue.

        WHY: Send messages respecting rate limits
        HOW: Pop from queue, check limits, send or requeue
        """
        while True:
            # Pop oldest item (lowest score)
            items = self.redis.zpopmin("discord_response_queue", count=1)

            if not items:
                await asyncio.sleep(0.1)  # No items, wait a bit
                continue

            payload_str, _score = items[0]
            payload = json.loads(payload_str)

            channel_id = payload["channel_id"]

            # Check global rate limit
            if not self.check_global_rate_limit():
                # Re-queue with slight delay
                payload["attempts"] = payload.get("attempts", 0) + 1
                self.redis.zadd(
                    "discord_response_queue",
                    {json.dumps(payload): time.time() + 0.1}
                )
                await asyncio.sleep(0.05)
                continue

            # Check channel rate limit
            if not self.check_channel_rate_limit(channel_id):
                # Re-queue with longer delay
                payload["attempts"] = payload.get("attempts", 0) + 1
                self.redis.zadd(
                    "discord_response_queue",
                    {json.dumps(payload): time.time() + 1}
                )
                continue

            # Send message
            try:
                if payload.get("interaction_token"):
                    await self._send_interaction_response(payload)
                else:
                    await self._send_channel_message(payload)
            except Exception as e:
                # Log error, optionally requeue for retry
                print(f"Discord send error: {e}")
                if payload.get("attempts", 0) < 3:
                    payload["attempts"] = payload.get("attempts", 0) + 1
                    self.redis.zadd(
                        "discord_response_queue",
                        {json.dumps(payload): time.time() + 5}
                    )

    async def _send_channel_message(self, payload: Dict[str, Any]):
        """
        Send message to Discord channel via REST API.

        ARGS:
            payload: Queue entry with channel_id, message, etc.
        """
        channel_id = payload["channel_id"]
        bot_token = settings.DISCORD_SHARED_BOT_TOKEN

        if not bot_token:
            raise ValueError("DISCORD_SHARED_BOT_TOKEN not configured")

        body: Dict[str, Any] = {
            "content": payload["message"]
        }

        if payload.get("embeds"):
            body["embeds"] = payload["embeds"]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://discord.com/api/v10/channels/{channel_id}/messages",
                headers={
                    "Authorization": f"Bot {bot_token}",
                    "Content-Type": "application/json"
                },
                json=body,
                timeout=10.0
            )

            if response.status_code == 429:
                # Rate limited by Discord
                retry_after = response.json().get("retry_after", 1)
                await asyncio.sleep(retry_after)
                raise Exception(f"Rate limited, retry after {retry_after}s")

            response.raise_for_status()

    async def _send_interaction_response(self, payload: Dict[str, Any]):
        """
        Send response to Discord interaction (slash command, button, etc.).

        WHY: Interactions have different endpoint
        HOW: Use interaction token for followup

        ARGS:
            payload: Queue entry with interaction_token, message, etc.
        """
        interaction_token = payload["interaction_token"]
        application_id = settings.DISCORD_SHARED_APPLICATION_ID

        if not application_id:
            raise ValueError("DISCORD_SHARED_APPLICATION_ID not configured")

        body: Dict[str, Any] = {
            "content": payload["message"]
        }

        if payload.get("embeds"):
            body["embeds"] = payload["embeds"]

        async with httpx.AsyncClient() as client:
            # Followup message (initial response already sent with type 5)
            response = await client.post(
                f"https://discord.com/api/v10/webhooks/{application_id}/{interaction_token}",
                headers={"Content-Type": "application/json"},
                json=body,
                timeout=10.0
            )

            if response.status_code == 429:
                retry_after = response.json().get("retry_after", 1)
                await asyncio.sleep(retry_after)
                raise Exception(f"Rate limited, retry after {retry_after}s")

            response.raise_for_status()

    async def send_immediate(
        self,
        channel_id: str,
        message: str,
        embeds: List[Dict] = None
    ) -> bool:
        """
        Send message immediately if within rate limits.

        WHY: For low-latency responses when possible
        HOW: Check limits and send without queueing

        ARGS:
            channel_id: Discord channel ID
            message: Message content
            embeds: Optional embeds

        RETURNS:
            True if sent, False if rate limited (should queue instead)
        """
        if not self.check_global_rate_limit():
            return False

        if not self.check_channel_rate_limit(channel_id):
            return False

        try:
            await self._send_channel_message({
                "channel_id": channel_id,
                "message": message[:2000],
                "embeds": embeds or []
            })
            return True
        except Exception:
            return False

    def clear_queue(self):
        """Clear all pending messages (for testing/emergency)."""
        self.redis.delete("discord_response_queue")

    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get queue statistics.

        RETURNS:
            Dict with queue length, rate limit status, etc.
        """
        return {
            "queue_length": self.get_queue_length(),
            "global_requests_this_second": int(self.redis.get("discord_rate:global") or 0),
            "global_limit": self.GLOBAL_RATE_LIMIT,
            "channel_window_seconds": self.CHANNEL_WINDOW,
            "channel_limit_per_window": self.CHANNEL_RATE_LIMIT
        }


# Global instance
discord_queue_service = DiscordQueueService()
