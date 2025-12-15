"""
GeoIP Service - IP address geolocation lookup.

WHY:
- Track user location for analytics
- Store location metadata in sessions and leads
- Support geolocation-based features

HOW:
- Use IP geolocation API (e.g., ipapi.co, MaxMind)
- Cache results in Redis
- Fallback handling for lookup failures

PSEUDOCODE follows the existing codebase patterns.
"""

import requests
from typing import Optional
import redis
import json

from app.core.config import settings


class GeoIPService:
    """
    IP address geolocation lookup service.

    WHY: Track user location for analytics
    HOW: API-based lookup with Redis caching
    """

    def __init__(self):
        """
        Initialize GeoIP service.

        WHY: Setup API and cache
        HOW: Load API key and Redis client
        """
        self.api_url = getattr(settings, "GEOIP_API_URL", "https://ipapi.co")
        self.api_key = getattr(settings, "GEOIP_API_KEY", None)

        # Redis cache for IP lookups
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True
        )

        self.cache_ttl = 7 * 24 * 60 * 60  # 7 days


    def lookup(self, ip_address: str) -> Optional[dict]:
        """
        Lookup geolocation for IP address.

        WHY: Get location data for user IP
        HOW: Check cache, call API if miss, cache result

        ARGS:
            ip_address: IPv4 or IPv6 address

        RETURNS:
            {
                "ip": "203.0.113.42",
                "country": "United States",
                "country_code": "US",
                "region": "California",
                "region_code": "CA",
                "city": "San Francisco",
                "postal": "94102",
                "timezone": "America/Los_Angeles",
                "latitude": 37.7749,
                "longitude": -122.4194,
                "org": "Example ISP"
            }

            Returns None if lookup fails
        """

        # Check cache
        cache_key = f"geoip:{ip_address}"
        cached = self.redis_client.get(cache_key)

        if cached:
            return json.loads(cached)

        # Skip private/local IPs
        if self._is_private_ip(ip_address):
            return None

        # Lookup via API
        try:
            result = self._api_lookup(ip_address)

            if result:
                # Cache result
                self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps(result)
                )

            return result

        except Exception as e:
            print(f"GeoIP lookup failed for {ip_address}: {e}")
            return None


    def _api_lookup(self, ip_address: str) -> Optional[dict]:
        """
        Call GeoIP API.

        WHY: Get location data from provider
        HOW: HTTP request to API endpoint
        """

        # Using ipapi.co as example (free tier available)
        url = f"{self.api_url}/{ip_address}/json/"

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = requests.get(url, headers=headers, timeout=5)
            response.raise_for_status()

            data = response.json()

            # Check if lookup was successful
            if data.get("error"):
                return None

            # Normalize response format
            return {
                "ip": data.get("ip"),
                "country": data.get("country_name"),
                "country_code": data.get("country_code"),
                "region": data.get("region"),
                "region_code": data.get("region_code"),
                "city": data.get("city"),
                "postal": data.get("postal"),
                "timezone": data.get("timezone"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "org": data.get("org")
            }

        except requests.exceptions.RequestException:
            return None


    def _is_private_ip(self, ip_address: str) -> bool:
        """
        Check if IP is private/local.

        WHY: Skip lookup for private IPs (saves API calls)
        HOW: Check IP ranges

        PRIVATE RANGES:
        - 10.0.0.0/8
        - 172.16.0.0/12
        - 192.168.0.0/16
        - 127.0.0.0/8 (localhost)
        """

        if ip_address.startswith("127.") or ip_address == "::1":
            return True

        if ip_address.startswith("10."):
            return True

        if ip_address.startswith("192.168."):
            return True

        # 172.16.0.0 - 172.31.255.255
        if ip_address.startswith("172."):
            parts = ip_address.split(".")
            if len(parts) >= 2:
                second_octet = int(parts[1])
                if 16 <= second_octet <= 31:
                    return True

        return False


    def lookup_batch(self, ip_addresses: list[str]) -> dict[str, Optional[dict]]:
        """
        Lookup multiple IP addresses.

        WHY: Efficient batch processing
        HOW: Check cache for all, API lookup for misses

        ARGS:
            ip_addresses: List of IP addresses

        RETURNS:
            {
                "203.0.113.42": {...},
                "198.51.100.1": {...}
            }
        """

        results = {}

        for ip in ip_addresses:
            results[ip] = self.lookup(ip)

        return results


    def clear_cache(self, ip_address: Optional[str] = None):
        """
        Clear GeoIP cache.

        WHY: Force refresh of stale data
        HOW: Delete from Redis

        ARGS:
            ip_address: Specific IP to clear, or None to clear all
        """

        if ip_address:
            cache_key = f"geoip:{ip_address}"
            self.redis_client.delete(cache_key)
        else:
            # Clear all geoip cache
            pattern = "geoip:*"
            cursor = 0

            while True:
                cursor, keys = self.redis_client.scan(
                    cursor,
                    match=pattern,
                    count=100
                )

                for key in keys:
                    self.redis_client.delete(key)

                if cursor == 0:
                    break


# Global instance
geoip_service = GeoIPService()
