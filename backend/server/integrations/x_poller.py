"""
X (Twitter) DM polling service.

Spawns short-lived Node.js scripts that use agent-twitter-client to read
and send DMs via browser-session cookies — no paid API required.
Runs as a background task in FastAPI lifespan alongside TelegramPoller.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Absolute paths so the subprocess finds node_modules regardless of cwd.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_NODE_MODULES = _BACKEND_DIR / "database" / "data" / "node_modules"
_COOKIES_FILE = _BACKEND_DIR / "data" / "eliza_cookies_v2.json"


class XPoller:
    # Interval between DM polls — keep conservative to avoid rate-limit bans.
    _POLL_INTERVAL = 60

    def __init__(self, orchestrator):
        self._orchestrator = orchestrator
        self._bot_user_id: str | None = None
        self._seen_ids: set[str] = set()

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def start(self) -> None:
        if not _COOKIES_FILE.exists():
            logger.warning(
                "X cookies file not found at %s — X DM polling disabled. "
                "Copy eliza_cookies_v2.json.template to eliza_cookies_v2.json and fill in values.",
                _COOKIES_FILE,
            )
            return

        self._bot_user_id = await self._get_bot_user_id()
        if not self._bot_user_id:
            logger.error("X poller: failed to authenticate — polling will not start.")
            return

        logger.info("X DM polling started (bot id: %s)", self._bot_user_id)

        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                logger.info("X poller stopped.")
                return
            except Exception as exc:
                logger.error("X polling error: %s", exc, exc_info=True)

            await asyncio.sleep(self._POLL_INTERVAL)

    # ------------------------------------------------------------------
    # Poll + handle
    # ------------------------------------------------------------------

    async def _poll_once(self) -> None:
        dms = await self._fetch_new_dms()
        for dm in dms:
            msg_id = dm.get("id")
            if not msg_id or msg_id in self._seen_ids:
                continue
            sender_id = dm.get("sender_id", "")
            if sender_id == self._bot_user_id:
                self._seen_ids.add(msg_id)
                continue
            try:
                await self._handle(dm)
            except Exception as exc:
                logger.error("X: error handling DM %s: %s", msg_id, exc, exc_info=True)
            self._seen_ids.add(msg_id)

        # Keep memory bounded.
        if len(self._seen_ids) > 5_000:
            self._seen_ids = set(list(self._seen_ids)[-2_000:])

    async def _handle(self, dm: dict) -> None:
        sender_id = str(dm.get("sender_id", ""))
        text = dm.get("text", "").strip()
        conversation_id = dm.get("conversation_id", "")

        if not text or not sender_id:
            return

        from database.database import SessionLocal
        from database.repository import DatabaseRepository

        async with SessionLocal() as session:
            repo = DatabaseRepository(session)
            user = await repo.get_or_create_user("x", sender_id)
            history = await repo.get_user_history(user.id, limit=10)
            await repo.log_dm(user.id, "x", text, message_type="user")

            result = await self._orchestrator.execute(
                text, sender_id, history=history, platform="x"
            )

            await repo.log_dm(user.id, "x", result["reply_text"], message_type="bot")
            await session.commit()

        await self._send_reply(conversation_id, result["reply_text"])
        logger.info("X: replied to user %s in conversation %s", sender_id, conversation_id)

    # ------------------------------------------------------------------
    # Node.js bridge
    # ------------------------------------------------------------------

    async def _run_node(self, script: str, timeout: int = 30) -> Any:
        """Writes script to a temp file, runs it with node, returns parsed JSON."""
        env = {**os.environ, "NODE_PATH": str(_NODE_MODULES)}

        with tempfile.NamedTemporaryFile(
            suffix=".js", mode="w", encoding="utf-8", delete=False
        ) as f:
            f.write(script)
            script_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "node",
                script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            except asyncio.TimeoutError:
                proc.kill()
                logger.error("X node script timed out after %ds", timeout)
                return None

            if proc.returncode != 0:
                logger.error("X node script error: %s", stderr.decode().strip())
                return None

            raw = stdout.decode().strip()
            if not raw:
                return None
            return json.loads(raw)

        except json.JSONDecodeError as exc:
            logger.error("X node script: invalid JSON — %s", exc)
            return None
        finally:
            Path(script_path).unlink(missing_ok=True)

    async def _get_bot_user_id(self) -> str | None:
        script = f"""
const {{ Scraper }} = require('agent-twitter-client');
const fs = require('fs');

(async () => {{
    try {{
        const cookies = JSON.parse(fs.readFileSync({json.dumps(str(_COOKIES_FILE))}, 'utf8'));
        const scraper = new Scraper();
        await scraper.setCookies(cookies.map(c => `${{c.key || c.name}}=${{c.value}}`));
        const me = await scraper.me();
        console.log(JSON.stringify({{ userId: me.userId, screenName: me.username }}));
    }} catch (e) {{
        process.stderr.write(e.message + '\\n');
        process.exit(1);
    }}
}})();
"""
        data = await self._run_node(script, timeout=20)
        if data and data.get("userId"):
            logger.info("X authenticated as @%s (id: %s)", data.get("screenName"), data["userId"])
            return str(data["userId"])
        return None

    async def _fetch_new_dms(self) -> list[dict]:
        script = f"""
const {{ Scraper }} = require('agent-twitter-client');
const fs = require('fs');

(async () => {{
    try {{
        const cookies = JSON.parse(fs.readFileSync({json.dumps(str(_COOKIES_FILE))}, 'utf8'));
        const scraper = new Scraper();
        await scraper.setCookies(cookies.map(c => `${{c.key || c.name}}=${{c.value}}`));

        const result = await scraper.getDirectMessageConversations();
        const conversations = result?.conversations || [];
        const dms = [];

        for (const conv of conversations) {{
            const messages = conv.messages || [];
            for (const msg of messages) {{
                if (msg.messageData?.text) {{
                    dms.push({{
                        id: msg.id,
                        sender_id: msg.senderId,
                        conversation_id: conv.conversationId,
                        text: msg.messageData.text,
                    }});
                }}
            }}
        }}

        console.log(JSON.stringify(dms));
    }} catch (e) {{
        process.stderr.write(e.message + '\\n');
        process.exit(1);
    }}
}})();
"""
        result = await self._run_node(script, timeout=45)
        return result if isinstance(result, list) else []

    async def _send_reply(self, conversation_id: str, text: str) -> None:
        script = f"""
const {{ Scraper }} = require('agent-twitter-client');
const fs = require('fs');

(async () => {{
    try {{
        const cookies = JSON.parse(fs.readFileSync({json.dumps(str(_COOKIES_FILE))}, 'utf8'));
        const scraper = new Scraper();
        await scraper.setCookies(cookies.map(c => `${{c.key || c.name}}=${{c.value}}`));

        await scraper.sendDirectMessage({json.dumps(conversation_id)}, {json.dumps(text)});
        console.log(JSON.stringify({{ ok: true }}));
    }} catch (e) {{
        process.stderr.write(e.message + '\\n');
        process.exit(1);
    }}
}})();
"""
        result = await self._run_node(script, timeout=30)
        if not result or not result.get("ok"):
            logger.warning("X: failed to send reply to conversation %s", conversation_id)
