"""
Code Node - Execute Python code in workflow.

WHY:
- Custom logic in workflows
- Data transformation
- Complex calculations
- Flexible scripting

HOW:
- Builder-authored Python runs in an ISOLATED subprocess (see `_code_sandbox.py`)
- Separate interpreter with a scrubbed environment (no app secrets), POSIX
  resource limits (CPU / address space / no file writes / few procs), and an
  enforced wall-clock timeout
- Limited standard library (safe-builtins whitelist + json/re/math/datetime)
- Result returned via the `result` variable
"""

import json
import os
import subprocess
import sys
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode

# Absolute path to the standalone subprocess runner (next to this file).
_SANDBOX_RUNNER = os.path.join(os.path.dirname(__file__), "_code_sandbox.py")

# Bounds.
_TIMEOUT_MIN = 1
_TIMEOUT_MAX = 30
_MAX_JOB_BYTES = 256 * 1024        # input payload cap (stdin to the child)
_MAX_OUTPUT_BYTES = 1024 * 1024    # stdout cap read back from the child
_RLIMIT_AS_BYTES = 512 * 1024 * 1024  # child virtual-address-space cap


def _set_child_limits(timeout: int):
    """Return a preexec_fn that applies POSIX rlimits in the child, or None.

    Each limit is set independently so an unavailable one (kernel/permission)
    doesn't abort the whole spawn. POSIX-only; on platforms without fork there
    is no preexec_fn and the subprocess + timeout still provide isolation.
    """
    if not hasattr(os, "fork"):
        return None

    import resource  # POSIX-only; imported lazily so non-POSIX import still works

    def _apply():
        limits = [
            (resource.RLIMIT_CPU, (timeout + 1, timeout + 1)),
            (resource.RLIMIT_AS, (_RLIMIT_AS_BYTES, _RLIMIT_AS_BYTES)),
            (resource.RLIMIT_FSIZE, (0, 0)),          # no file writes
            (resource.RLIMIT_NPROC, (64, 64)),        # anti fork-bomb
        ]
        for res, vals in limits:
            try:
                resource.setrlimit(res, vals)
            except (ValueError, OSError):
                # Limit unavailable on this kernel / already lower hard cap.
                pass

    return _apply


class CodeNode(BaseNode):
    """
    Python code execution node.

    WHY: Custom logic in workflows
    HOW: Isolated subprocess execution with restricted globals + resource limits
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute Python code in an isolated subprocess.

        CONFIG:
            {
                "code": "result = input_data.upper()",
                "timeout": 5
            }

        INPUTS (available to the code):
            input_data, user_message, variables  (set `result` to return a value)

        RETURNS:
            {
                "output": <value of `result`>,
                "success": True,
                "metadata": {"code_length": int}
            }
        """
        try:
            code = self.config.get("code", "")
            if not code:
                raise ValueError("Code is required")

            timeout = self.config.get("timeout", 5)
            try:
                timeout = int(timeout)
            except (TypeError, ValueError):
                timeout = 5
            timeout = max(_TIMEOUT_MIN, min(_TIMEOUT_MAX, timeout))

            job = {
                "code": code,
                "input_data": context.get("variables", {}).get(
                    "_last_output", inputs.get("input", "")
                ),
                "user_message": inputs.get("input", ""),
                "variables": context.get("variables", {}),
            }
            # `default=str` keeps non-JSON-serializable prior outputs from
            # breaking serialization (they reach the child as strings).
            job_json = json.dumps(job, default=str)
            if len(job_json.encode("utf-8")) > _MAX_JOB_BYTES:
                return {
                    "output": None,
                    "success": False,
                    "error": "Code input is too large (max 256 KB of context/variables).",
                    "metadata": {"node_id": self.node_id, "node_type": self.node_type},
                }

            # Minimal, secret-free environment. `-I -S` already makes Python
            # ignore PYTHON* env vars and user site-packages.
            child_env = {
                "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
                "LANG": "C.UTF-8",
                "LC_ALL": "C.UTF-8",
            }

            proc = subprocess.Popen(
                [sys.executable, "-I", "-S", _SANDBOX_RUNNER],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=child_env,
                preexec_fn=_set_child_limits(timeout),
            )
            try:
                stdout, stderr = proc.communicate(input=job_json, timeout=timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()  # reap
                return {
                    "output": None,
                    "success": False,
                    "error": f"Code execution exceeded {timeout}s and was terminated.",
                    "metadata": {"node_id": self.node_id, "node_type": self.node_type},
                }

            if proc.returncode != 0:
                # Non-zero exit usually means an rlimit kill (SIGKILL/SIGXCPU)
                # or interpreter-level failure — the runner itself reports
                # runtime errors with exit code 0.
                snippet = (stderr or "").strip()[:500] or "code process terminated"
                return {
                    "output": None,
                    "success": False,
                    "error": f"Code execution failed: {snippet}",
                    "metadata": {"node_id": self.node_id, "node_type": self.node_type},
                }

            stdout = (stdout or "")[:_MAX_OUTPUT_BYTES]
            try:
                payload = json.loads(stdout)
            except json.JSONDecodeError:
                return {
                    "output": None,
                    "success": False,
                    "error": "Code produced no valid result.",
                    "metadata": {"node_id": self.node_id, "node_type": self.node_type},
                }

            if not payload.get("success"):
                return {
                    "output": None,
                    "success": False,
                    "error": payload.get("error", "Code execution failed"),
                    "metadata": {"node_id": self.node_id, "node_type": self.node_type},
                }

            return {
                "output": payload.get("result"),
                "success": True,
                "error": None,
                "metadata": {"code_length": len(code)},
            }

        except Exception as e:
            return self.handle_error(e)

    def validate_config(self) -> tuple[bool, str | None]:
        """Validate code node configuration.

        The subprocess sandbox (scrubbed env + rlimits + safe-builtins whitelist)
        is the real boundary; this keyword pre-filter is cheap defense-in-depth.
        """
        code = self.config.get("code", "")
        if not code:
            return False, "Code is required"

        forbidden = ["import", "open", "exec", "eval", "__"]
        for keyword in forbidden:
            if keyword in code.lower():
                return False, f"Forbidden keyword: {keyword}"

        return True, None
