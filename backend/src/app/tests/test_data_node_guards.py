"""Unit tests for the Data & Integration node guards.

Covers the two pure, dependency-free helpers added to harden the http/database
nodes:
  * app.chatflow.utils.ssrf_guard      (assert_safe_url / assert_safe_host)
  * app.chatflow.nodes.database_node._assert_safe_query

IP literals are used for the SSRF cases so the tests are deterministic and need
no DNS.
"""

import pytest

from app.chatflow.utils.ssrf_guard import assert_safe_url, assert_safe_host
from app.chatflow.nodes.database_node import _assert_safe_query


# --------------------------------------------------------------------------- #
# SSRF guard
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("url", [
    "http://127.0.0.1/",            # loopback
    "http://localhost/",           # loopback (resolves to 127.0.0.1/::1)
    "http://10.0.0.5/internal",    # RFC1918 private
    "http://192.168.1.1/",         # RFC1918 private
    "http://169.254.169.254/latest/meta-data/",  # link-local / cloud metadata
    "http://100.64.0.1/",          # CGNAT (RFC6598)
    "http://[::1]/",               # IPv6 loopback
    "file:///etc/passwd",          # disallowed scheme
    "gopher://127.0.0.1/",         # disallowed scheme
    "ftp://example.com/",          # disallowed scheme
])
def test_assert_safe_url_blocks(url):
    with pytest.raises(ValueError):
        assert_safe_url(url)


@pytest.mark.parametrize("url", [
    "http://8.8.8.8/",             # public unicast (Google DNS) — no DNS needed
    "https://1.1.1.1/path?q=1",    # public unicast (Cloudflare)
])
def test_assert_safe_url_allows_public(url):
    # Should not raise.
    assert_safe_url(url)


def test_assert_safe_url_requires_value():
    with pytest.raises(ValueError):
        assert_safe_url("")


@pytest.mark.parametrize("host", ["127.0.0.1", "10.1.2.3", "169.254.169.254", "100.64.5.5", "::1"])
def test_assert_safe_host_blocks(host):
    with pytest.raises(ValueError):
        assert_safe_host(host)


def test_assert_safe_host_allows_public():
    assert_safe_host("8.8.8.8")


# --------------------------------------------------------------------------- #
# Database statement guard
# --------------------------------------------------------------------------- #

def test_select_ok():
    assert _assert_safe_query("SELECT id, name FROM users WHERE id = :id", "select") == "select"


def test_query_alias_maps_to_select():
    assert _assert_safe_query("SELECT 1", "query") == "select"


def test_with_cte_select_ok():
    assert _assert_safe_query(
        "WITH recent AS (SELECT id FROM orders) SELECT * FROM recent", "select"
    ) == "select"


def test_insert_update_delete_match():
    assert _assert_safe_query("INSERT INTO leads (email) VALUES (:e)", "insert") == "insert"
    assert _assert_safe_query("UPDATE leads SET name = :n WHERE id = :id", "update") == "update"
    assert _assert_safe_query("DELETE FROM leads WHERE id = :id", "delete") == "delete"


@pytest.mark.parametrize("query,operation", [
    ("DROP TABLE users", "select"),                          # DDL as select
    ("SELECT 1 WHERE 1=0; DROP TABLE users", "select"),      # multi-statement
    ("SELECT 1; DELETE FROM users", "select"),               # multi-statement DML
    ("/* sneaky */ DELETE FROM users", "select"),            # block comment hides DML
    ("-- c\nDELETE FROM users", "select"),                   # line comment hides DML
    ("WITH x AS (DELETE FROM users RETURNING id) SELECT 1", "select"),  # DML-in-CTE
    ("DELETE FROM users", "select"),                         # leading keyword mismatch
    ("SELECT * FROM users", "delete"),                       # op says delete, query is select
    ("TRUNCATE users", "delete"),                            # not the declared op
    ("SELECT 1", "drop"),                                    # unsupported operation
])
def test_dangerous_queries_blocked(query, operation):
    with pytest.raises(ValueError):
        _assert_safe_query(query, operation)


def test_empty_query_blocked():
    with pytest.raises(ValueError):
        _assert_safe_query("   ", "select")
