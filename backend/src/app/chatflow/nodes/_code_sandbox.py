"""Standalone runner for the chatflow code node's subprocess sandbox.

This file is executed as an ISOLATED subprocess by `code_node.py`:

    python -I -S app/chatflow/nodes/_code_sandbox.py

It is intentionally self-contained — it imports ONLY the Python standard library
and never touches the app, the DB, or any secret. The parent (`code_node`) is
responsible for the real isolation boundary: a scrubbed environment, POSIX
`resource` rlimits (CPU / address space / no file writes / few procs), and a
wall-clock timeout enforced via `Popen.communicate(timeout=...)`.

Protocol:
  * stdin  : one JSON object  {"code", "input_data", "user_message", "variables"}
  * stdout : one JSON object  {"success": true,  "result": <json|str>}
                          or  {"success": false, "error": "<message>"}

`result` (and any non-JSON-serializable input) is coerced with `default=str`, so
the builder's code should treat complex prior-node outputs as already-stringified
when they aren't plain JSON types.
"""

import json
import sys


# The exact safe-builtins whitelist + module set the in-process node used before
# isolation, so existing code-node behaviour is preserved.
def _build_globals():
    safe_builtins = {
        "len": len, "str": str, "int": int, "float": float, "bool": bool,
        "list": list, "dict": dict, "tuple": tuple, "set": set, "range": range,
        "enumerate": enumerate, "zip": zip, "sum": sum, "min": min, "max": max,
        "abs": abs, "round": round, "sorted": sorted, "reversed": reversed,
        "True": True, "False": False, "None": None,
    }
    return {
        "__builtins__": safe_builtins,
        "json": __import__("json"),
        "re": __import__("re"),
        "math": __import__("math"),
        "datetime": __import__("datetime"),
    }


def main() -> int:
    try:
        job = json.loads(sys.stdin.read() or "{}")
    except Exception as exc:  # noqa: BLE001 - report any decode failure to parent
        sys.stdout.write(json.dumps({"success": False, "error": f"Invalid job: {exc}"}))
        return 0

    code = job.get("code", "")
    if not code:
        sys.stdout.write(json.dumps({"success": False, "error": "Code is required"}))
        return 0

    exec_globals = _build_globals()
    exec_locals = {
        "input_data": job.get("input_data", ""),
        "user_message": job.get("user_message", ""),
        "variables": job.get("variables", {}),
        "result": None,
    }

    try:
        exec(code, exec_globals, exec_locals)  # noqa: S102 - sandboxed by parent
        result = exec_locals.get("result")
        sys.stdout.write(json.dumps({"success": True, "result": result}, default=str))
    except Exception as exc:  # noqa: BLE001 - surface runtime errors to the node
        sys.stdout.write(
            json.dumps({"success": False, "error": f"{type(exc).__name__}: {exc}"})
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
