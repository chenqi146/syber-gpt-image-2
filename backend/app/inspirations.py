from __future__ import annotations

import asyncio
import hashlib
import re
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import FastAPI

from .db import Database
from .settings import Settings


HEADING_RE = re.compile(r"^###\s+(?:Case|No\.)\s+([^:]+):\s+(.+)$")
SECTION_RE = re.compile(r"^##\s+(.+?)\s*$")
PROMPT_PATTERNS = [
    re.compile(r"\*\*Prompt:\*\*\s*```(?:\w+)?\s*(.*?)\s*```", re.S),
    re.compile(r"^####\s+.*?Prompt.*?\n\s*```(?:\w+)?\s*(.*?)\s*```", re.S | re.M),
]
IMAGE_RE = re.compile(r"<img\s+[^>]*src=['\"]([^'\"]+)['\"]", re.I)
LINK_RE = re.compile(r"^\[([^\]]+)\]\(([^)]+)\)")
AUTHOR_RE = re.compile(r"\(by\s+\[@?([^\]]+)\]\(([^)]+)\)\)")
DETAIL_AUTHOR_RE = re.compile(r"-\s+\*\*Author:\*\*\s+(?:\[([^\]]+)\]\(([^)]+)\)|(.+))")
DETAIL_SOURCE_RE = re.compile(r"-\s+\*\*Source:\*\*\s+\[([^\]]+)\]\(([^)]+)\)")


def normalize_inspiration_source_url(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        return ""
    parsed = urlparse(stripped)
    if parsed.netloc.lower() != "github.com":
        return stripped

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2:
        return stripped
    owner, repo = parts[0], parts[1]
    if len(parts) >= 5 and parts[2] == "blob":
        branch = parts[3]
        path = "/".join(parts[4:])
        return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
    return f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"


def normalize_inspiration_source_urls(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        url = normalize_inspiration_source_url(value)
        if not url or url in seen:
            continue
        seen.add(url)
        normalized.append(url)
    return normalized


def parse_inspiration_markdown(markdown: str, source_url: str) -> list[dict[str, Any]]:
    lines = markdown.splitlines()
    sections: list[tuple[int, str]] = []
    case_starts: list[tuple[int, str, str]] = []
    current_section = "Uncategorized"

    for index, line in enumerate(lines):
        section_match = SECTION_RE.match(line)
        if section_match and not line.startswith("###"):
            current_section = _clean_heading(section_match.group(1))
            sections.append((index, current_section))
            continue

        heading_match = HEADING_RE.match(line)
        if heading_match:
            case_starts.append((index, current_section, line.strip()))

    items: list[dict[str, Any]] = []
    for position, (start, section, heading) in enumerate(case_starts):
        end = case_starts[position + 1][0] if position + 1 < len(case_starts) else len(lines)
        block = "\n".join(lines[start:end])
        prompt = _extract_prompt(block)
        if not prompt:
            continue

        parsed_heading = _parse_case_heading(heading)
        image_match = IMAGE_RE.search(block)
        image_url = _resolve_url(source_url, image_match.group(1)) if image_match else None
        detail_author = _parse_detail_author(block)
        detail_source = _parse_detail_source(block)
        author = parsed_heading.get("author") or detail_author
        source_link = parsed_heading.get("source_link") or detail_source
        source_item_id = _stable_id(source_url, section, parsed_heading["title"], author, prompt)

        items.append(
            {
                "id": source_item_id,
                "source_item_id": source_item_id,
                "section": section,
                "title": parsed_heading["title"],
                "author": author,
                "prompt": prompt,
                "image_url": image_url,
                "source_link": source_link,
                "raw": {"heading": heading},
            }
        )

    return items


async def sync_inspirations(settings: Settings, db: Database, source_urls: list[str] | None = None) -> dict[str, Any]:
    urls = normalize_inspiration_source_urls(
        source_urls or db.get_site_settings().get("inspiration_sources") or _settings_source_urls(settings)
    )
    if not urls:
        raise ValueError("No inspiration source URLs configured")

    parsed_total = 0
    changed_total = 0
    synced_at = None
    source_results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        for source_url in urls:
            try:
                response = await client.get(source_url)
                response.raise_for_status()
                items = parse_inspiration_markdown(response.text, source_url)
                result = db.upsert_inspirations(source_url, items)
                parsed_total += len(items)
                changed_total += int(result.get("count") or 0)
                synced_at = result.get("synced_at") or synced_at
                source_results.append({"source_url": source_url, "parsed": len(items), **result})
            except Exception as exc:
                errors.append({"source_url": source_url, "error": str(exc)})
    if errors and not source_results:
        raise RuntimeError("; ".join(f"{item['source_url']}: {item['error']}" for item in errors))
    return {
        "ok": True,
        "source_url": urls[0],
        "source_urls": urls,
        "parsed": parsed_total,
        "count": changed_total,
        "synced_at": synced_at,
        "sources": source_results,
        "errors": errors,
    }


async def run_inspiration_sync_loop(app: FastAPI) -> None:
    settings: Settings = app.state.settings
    db: Database = app.state.db
    try:
        if settings.inspiration_sync_on_startup:
            await _safe_sync(settings, db, app)
        if settings.inspiration_sync_interval_seconds <= 0:
            return
        while True:
            await asyncio.sleep(settings.inspiration_sync_interval_seconds)
            await _safe_sync(settings, db, app)
    except asyncio.CancelledError:
        raise


async def _safe_sync(settings: Settings, db: Database, app: FastAPI) -> None:
    try:
        app.state.last_inspiration_sync = await sync_inspirations(settings, db)
        app.state.last_inspiration_sync_error = None
    except Exception as exc:  # pragma: no cover - best effort background diagnostics.
        app.state.last_inspiration_sync_error = str(exc)


def _settings_source_urls(settings: Settings) -> list[str]:
    return settings.inspiration_source_urls or [settings.inspiration_source_url]


def _extract_prompt(block: str) -> str:
    for pattern in PROMPT_PATTERNS:
        match = pattern.search(block)
        if match:
            return match.group(1).strip()
    return ""


def _parse_detail_author(block: str) -> str | None:
    match = DETAIL_AUTHOR_RE.search(block)
    if not match:
        return None
    value = match.group(1) or match.group(3) or ""
    value = value.strip()
    return value or None


def _parse_detail_source(block: str) -> str | None:
    match = DETAIL_SOURCE_RE.search(block)
    if not match:
        return None
    return match.group(2).strip()


def _parse_case_heading(heading: str) -> dict[str, str | None]:
    match = HEADING_RE.match(heading)
    rest = match.group(2).strip() if match else heading.replace("###", "", 1).strip()
    author = None
    author_match = AUTHOR_RE.search(rest)
    if author_match:
        author = f"@{author_match.group(1).lstrip('@')}"
        rest = rest[: author_match.start()].strip()

    source_link = None
    title = rest
    link_match = LINK_RE.match(rest)
    if link_match:
        title = link_match.group(1).strip()
        source_link = link_match.group(2).strip()
    return {"title": _clean_heading(title), "author": author, "source_link": source_link}


def _clean_heading(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("#", "").strip())


def _stable_id(*parts: str | None) -> str:
    raw = "\n".join(part or "" for part in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _resolve_url(source_url: str, url: str) -> str:
    return urljoin(source_url, url)
