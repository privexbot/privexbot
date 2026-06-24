"""SSRF guard for builder-configured outbound targets.

Chatflow nodes let a workspace builder configure outbound destinations — HTTP
URLs (http/webhook/notification/handoff/lead_capture) and database hosts
(database node). Without validation a builder could point those at the loopback
interface, the cloud metadata endpoint (169.254.169.254), or private/internal
hosts (SSRF). This module resolves the target and rejects any address that is
not a public, routable unicast IP.

`geoip_service._is_private_ip` is a string-prefix heuristic that misses
loopback/link-local/CGNAT/IPv6 — this guard uses the stdlib `ipaddress` module
for a correct, exhaustive check instead.

Both helpers raise `ValueError` on a blocked target; the calling node's existing
`try/except -> handle_error` turns that into a clean `success: False` result.

Known residuals (proportionate v1 — a full fix needs a pinned-IP transport
adapter, out of scope here):
  * DNS-rebinding TOCTOU between this check and the actual connection.
  * HTTP redirect-to-internal (the `requests` default follows redirects).
"""

import ipaddress
import socket
from urllib.parse import urlsplit

# Carrier-grade NAT (RFC 6598) — routable-looking but internal; NOT flagged by
# any `ipaddress` property, so we check it explicitly.
_CGNAT = ipaddress.ip_network("100.64.0.0/10")

_ALLOWED_SCHEMES = {"http", "https"}


def _ip_is_blocked(ip: ipaddress._BaseAddress) -> bool:
    """True when an IP is not a public, routable unicast address."""
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local      # 169.254.0.0/16 (incl. cloud metadata) + fe80::/10
        or ip.is_multicast
        or ip.is_unspecified     # 0.0.0.0 / ::
        or ip.is_reserved
        or (ip.version == 4 and ip in _CGNAT)
    )


def _resolve_ips(host: str) -> list:
    """Resolve a hostname to every A/AAAA address (or parse a literal IP)."""
    # A bare IP literal: validate directly without a DNS round-trip.
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host '{host}': {exc}") from exc

    ips = []
    for info in infos:
        addr = info[4][0]
        try:
            ips.append(ipaddress.ip_address(addr))
        except ValueError:
            continue
    if not ips:
        raise ValueError(f"Could not resolve host '{host}' to any IP address")
    return ips


def assert_safe_host(host: str) -> None:
    """Raise ValueError unless every resolved IP for `host` is public unicast."""
    if not host:
        raise ValueError("Host is required")
    # Reject if ANY resolved address is internal (defends round-robin DNS that
    # mixes a public and an internal record).
    for ip in _resolve_ips(host):
        if _ip_is_blocked(ip):
            raise ValueError(
                f"Blocked request to non-public address ({ip}) for host '{host}'"
            )


def assert_safe_url(url: str) -> None:
    """Raise ValueError unless `url` is an http(s) URL to a public host."""
    if not url:
        raise ValueError("URL is required")

    parts = urlsplit(url)
    scheme = (parts.scheme or "").lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise ValueError(
            f"Blocked URL scheme '{scheme or '(none)'}': only http/https are allowed"
        )

    host = parts.hostname
    if not host:
        raise ValueError(f"URL '{url}' has no host")

    assert_safe_host(host)
