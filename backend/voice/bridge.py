"""
VoiceBridge — stitches browser <-> OpenAI Realtime <-> Claude brain.

Flow per turn:
  browser mic --(pcm16 frames)--> backend ws  --> OpenAI Realtime (ASR)
  OpenAI emits user transcript  --> Claude brain.respond()
  Claude reply text             --> OpenAI Realtime (TTS)
  TTS audio frames              --> browser speaker
  Native interruption           --> OpenAI server_vad handles it

This is the v0.1 bridge: we proxy audio to OpenAI Realtime, grab the final
transcript, hand it to Claude, and speak Claude's reply back through OpenAI's
TTS. v0.2 will switch to bidirectional streaming (Claude token-by-token → TTS).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

import websockets
from fastapi import WebSocket

from brain.agent import RightHandBrain

log = logging.getLogger("righthand.voice")

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"


class VoiceBridge:
    def __init__(self, brain: RightHandBrain) -> None:
        self.brain = brain
        self.model = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview")

    async def run(self, client_ws: WebSocket) -> None:
        headers = {
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "OpenAI-Beta": "realtime=v1",
        }
        url = f"{OPENAI_REALTIME_URL}?model={self.model}"

        async with websockets.connect(url, extra_headers=headers, max_size=None) as oai:
            # Configure the OpenAI Realtime session
            await oai.send(
                json.dumps(
                    {
                        "type": "session.update",
                        "session": {
                            "modalities": ["audio", "text"],
                            "instructions": (
                                "You are the voice I/O layer for RIGHTHAND. "
                                "Transcribe user speech and speak assistant replies naturally."
                            ),
                            "voice": "alloy",
                            "input_audio_format": "pcm16",
                            "output_audio_format": "pcm16",
                            "turn_detection": {"type": "server_vad"},
                        },
                    }
                )
            )

            async def client_to_oai() -> None:
                try:
                    while True:
                        msg = await client_ws.receive()
                        if "bytes" in msg and msg["bytes"] is not None:
                            # Binary audio frame from browser → forward as base64
                            import base64
                            b64 = base64.b64encode(msg["bytes"]).decode()
                            await oai.send(json.dumps(
                                {"type": "input_audio_buffer.append", "audio": b64}
                            ))
                        elif "text" in msg and msg["text"] is not None:
                            # JSON control messages from browser (e.g., {"type":"commit"})
                            await oai.send(msg["text"])
                except Exception as e:
                    log.info("client_to_oai ended: %s", e)

            async def oai_to_client() -> None:
                try:
                    async for raw in oai:
                        event = json.loads(raw)
                        etype = event.get("type", "")

                        # When user finishes a turn, hand transcript to Claude
                        if etype == "conversation.item.input_audio_transcription.completed":
                            transcript = event.get("transcript", "")
                            if transcript:
                                turn = await self.brain.respond(transcript)
                                # Ask OpenAI to speak Claude's reply
                                await oai.send(json.dumps({
                                    "type": "response.create",
                                    "response": {
                                        "modalities": ["audio", "text"],
                                        "instructions": turn.reply_text,
                                    },
                                }))

                        # Stream audio back to the browser
                        if etype == "response.audio.delta":
                            import base64
                            audio = base64.b64decode(event.get("delta", ""))
                            await client_ws.send_bytes(audio)

                        # Forward text deltas for captions
                        if etype in (
                            "response.audio_transcript.delta",
                            "response.text.delta",
                            "response.done",
                        ):
                            await client_ws.send_text(json.dumps(event))
                except Exception as e:
                    log.info("oai_to_client ended: %s", e)

            await asyncio.gather(client_to_oai(), oai_to_client())
