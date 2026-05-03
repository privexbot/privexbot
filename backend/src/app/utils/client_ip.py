"""
Extract the real client IP from a FastAPI/Starlette request.

WHY: behind Cloudflare + Traefik, `request.client.host` is the proxy/edge IP,
not the user's IP. Looking up that IP in a geo-DB returns Cloudflare's region
(e.g. South Africa for some edges) — we saw a Lagos user mis-attributed to SA.

HOW: prefer Cloudflare's `Cf-Connecting-Ip` (most accurate when CF is in
front), then `X-Real-IP` (set by Traefik/Nginx), then the leftmost entry of
`X-Forwarded-For`. Fall back to `request.client.host` only if no proxy
headers exist (direct LAN call).

Trust note: these headers can be spoofed if the request reaches the app WITHOUT
going through Cloudflare/Traefik. In production all ingress goes through
Traefik which sanitizes XFF, so trusting these headers is fine. For
public-facing dev (e.g. ngrok tunnel) the same trust holds because we only
read these for soft analytics, not authentication.
"""

from typing import Optional

from fastapi import Request


_CANDIDATE_HEADERS = (
    "Cf-Connecting-Ip",   # Cloudflare's authoritative client IP
    "X-Real-IP",          # Nginx / Traefik set this from the connection peer
    "X-Forwarded-For",    # Comma-separated chain; leftmost is the client
)


def get_client_ip(request: Request) -> Optional[str]:
    """Return the most likely real client IP, or None if nothing is set."""
    headers = request.headers
    for name in _CANDIDATE_HEADERS:
        value = headers.get(name, "")
        if not value:
            continue
        # XFF can be a list; take the leftmost (client) entry.
        ip = value.split(",")[0].strip()
        if ip:
            return ip

    return request.client.host if request.client else None
