"""The dependency lists read by Docker, Vercel and pyproject tools must agree."""

import re
import tomllib
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def _requirements(path: Path) -> list[str]:
    lines = []
    for line in path.read_text(encoding="utf-8").splitlines():
        spec = re.split(r"\s+#", line)[0].strip()
        if spec and not spec.startswith("#"):
            lines.append(spec)
    return lines


def test_dependency_lists_are_identical():
    backend = _requirements(BACKEND / "requirements.txt")
    root = _requirements(BACKEND.parent / "requirements.txt")
    pyproject = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))

    assert root == backend
    assert pyproject["project"]["dependencies"] == backend


def test_no_includes_vercel_cannot_follow():
    for path in (BACKEND / "requirements.txt", BACKEND.parent / "requirements.txt"):
        assert not any(spec.startswith(("-r", "-c")) for spec in _requirements(path))
