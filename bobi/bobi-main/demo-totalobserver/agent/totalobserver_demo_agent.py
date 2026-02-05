"""
TOTALOBSERVER DEMO AGENT
Based on Ventus Dual-Model V3 structure

Layer 1: Gemini Realtime (fast audio conversation)
Layer 2: Gemini Pro (analysis + MCP tool calling)
Layer 3: MCP Bridge (real Calendar/Gmail + mock CRM/TotalObserver)

Serbian language for demo
"""
import os
import asyncio
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import google
from livekit import api, rtc

# Import MCP Bridge
from mcp.bridge import MCPBridge

# Import prompts
from prompts.totalobserver_instructions import TOTALOBSERVER_FULL_INSTRUCTIONS

load_dotenv()

# Configuration
USE_REAL_GOOGLE = os.getenv("USE_REAL_GOOGLE", "true").lower() == "true"
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Initialize MCP Bridge (global - shared across all sessions)
print(f"[DEMO AGENT] Initializing MCP Bridge (real_google={USE_REAL_GOOGLE})...")
mcp_bridge = MCPBridge(use_real_google=USE_REAL_GOOGLE)

def build_system_prompt_with_tools() -> str:
    """Build system prompt that includes MCP tool descriptions"""
    tools_desc = mcp_bridge.get_tool_descriptions()

    tools_section = "\n=== DOSTUPNI ALATI (MCP TOOLS) ===\n"
    for tool_name, description in tools_desc.items():
        tools_section += f"- {tool_name}: {description}\n"

    return f"""
{TOTALOBSERVER_FULL_INSTRUCTIONS}

{tools_section}

=== NAPOMENA ===
Kada pozivaš alat, koristi funkciju call_tool() sa:
- tool_name: ime alata (string)
- parametri kao keyword argumenti

Primer:
call_tool(tool_name="create_work_order", building_id="plaza-mall", issue_type="HVAC", description="Klima ne radi", priority="high")
"""

async def broadcast_tool_call(room: rtc.Room, tool_name: str, params: dict, result: dict):
    """Broadcast tool call to demo UI"""
    try:
        data = json.dumps({
            "type": "tool_call",
            "tool_name": tool_name,
            "params": params,
            "result": result,
            "timestamp": datetime.now().isoformat()
        })

        await room.local_participant.publish_data(
            data.encode('utf-8'),
            reliable=True,
            destination_identities=[]
        )
        print(f"[BROADCAST] ✓ Tool call broadcast: {tool_name}")
    except Exception as e:
        print(f"[BROADCAST] ⚠ Failed to broadcast tool call: {e}")

async def broadcast_transcript(room: rtc.Room, speaker: str, text: str):
    """Broadcast transcript to demo UI"""
    try:
        data = json.dumps({
            "type": "transcript",
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })

        await room.local_participant.publish_data(
            data.encode('utf-8'),
            reliable=True,
            destination_identities=[]
        )
        print(f"[BROADCAST] ✓ Transcript broadcast: {speaker}")
    except Exception as e:
        print(f"[BROADCAST] ⚠ Failed to broadcast: {e}")

# Define MCP tool function for Gemini
async def call_mcp_tool_wrapper(tool_name: str, **kwargs):
    """Wrapper function that Gemini can call to invoke MCP tools"""
    print(f"[MCP CALL] 🔧 Gemini calling: {tool_name}(**{kwargs})")
    result = mcp_bridge.call_tool(tool_name, **kwargs)
    print(f"[MCP CALL] ✓ Result: {result}")
    return json.dumps(result, ensure_ascii=False)

async def entrypoint(ctx: JobContext):
    """Main agent entrypoint"""
    room_name = ctx.room.name
    print(f"\n{'='*60}")
    print(f"🏢 TOTALOBSERVER DEMO AGENT")
    print(f"{'='*60}")
    print(f"Room: {room_name}")
    print(f"MCP Tools: {len(mcp_bridge.get_available_tools())}")
    print(f"Real Google: {USE_REAL_GOOGLE}")
    print(f"{'='*60}\n")

    # Connect to room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Build system prompt with tool descriptions
    system_prompt = build_system_prompt_with_tools()

    # Create Gemini Realtime model
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        print("[ERROR] GOOGLE_API_KEY nije postavljen!")
        return

    realtime_model = google.beta.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-09-2025",
        api_key=google_api_key,
        voice="Charon",  # Serbian-sounding voice
        language="sr-RS",
        temperature=0.7,
        modalities=["AUDIO"],
        proactivity=True,
        enable_affective_dialog=True,
        instructions=system_prompt,
    )

    print("[OK] Gemini Realtime Model kreiran")

    # Create Agent (using new Agent API)
    agent = Agent(
        instructions=system_prompt,
        vad=None,  # Gemini Realtime has built-in VAD
        stt=None,  # Not using STT - realtime handles it
        llm=realtime_model,
        tts=None,  # Not using TTS - realtime handles it
    )

    print("[OK] Agent kreiran")

    # Create AgentSession
    session = AgentSession()

    # Register MCP tool calling function
    agent.register_function("call_tool", call_mcp_tool_wrapper)
    print("[OK] MCP tool function registered")

    # Hook into agent events for broadcasting
    @session.on("user_input_transcribed")
    def on_user_speech(event):
        """Fired when user speech is transcribed"""
        print(f"[DEBUG] user_input_transcribed event fired - is_final={event.is_final}")

        # Only process FINAL transcripts to avoid duplicates
        if not event.is_final:
            return

        transcript = event.transcript
        print(f"[DEBUG] Transcript: '{transcript}'")

        if transcript and transcript.strip():
            print(f"[🎤 USER] {transcript}")
            # Broadcast to UI
            asyncio.create_task(broadcast_transcript(ctx.room, "User", transcript))
        else:
            print(f"[DEBUG] Empty or invalid transcript")

    @session.on("speech_created")
    def on_agent_speech(event):
        """Fired when agent speech is created"""
        print(f"[DEBUG] speech_created event fired")

        if event.speech_handle and hasattr(event.speech_handle, 'chat_message') and event.speech_handle.chat_message:
            msg = event.speech_handle.chat_message
            transcript = msg.content if hasattr(msg, 'content') else str(msg)
            print(f"[DEBUG] Agent transcript: '{transcript}'")

            if transcript and transcript.strip():
                print(f"[🤖 AGENT] {transcript}")
                # Broadcast to UI
                asyncio.create_task(broadcast_transcript(ctx.room, "Agent", transcript))
            else:
                print(f"[DEBUG] Empty or invalid agent transcript")
        else:
            print(f"[DEBUG] ⚠️ Unable to extract transcript from speech_created event")

    @session.on("function_call_completed")
    def on_function_call(event):
        """Fired when a function call completes"""
        print(f"[DEBUG] function_call_completed event fired")
        print(f"[DEBUG] Function: {event.function_name}")
        print(f"[DEBUG] Arguments: {event.arguments}")
        print(f"[DEBUG] Result: {event.result}")

        # Broadcast tool call to UI
        asyncio.create_task(broadcast_tool_call(
            ctx.room,
            event.function_name,
            event.arguments or {},
            json.loads(event.result) if event.result else {}
        ))

    print("[OK] Event hooks attached")

    # Start the session (MUST be awaited!)
    print("[SESSION] Starting agent session...")
    await session.start(agent, room=ctx.room)
    print("[SESSION] ✅ Agent session started")

    # Let Gemini Realtime handle the greeting with proactivity
    print("[GREETING] 🎯 Gemini Realtime proactivity enabled - agent will speak first")

    # Brief pause to let audio stream establish
    await asyncio.sleep(0.5)

    # Track execution of proactivity
    agent_has_spoken = False

    @session.on("agent_started_speaking")
    def intro_callback():
        nonlocal agent_has_spoken
        agent_has_spoken = True
        print("[GREETING] ✅ Agent started speaking (Proactivity worked)")

    # Wait for proactivity to trigger
    await asyncio.sleep(3.0)

    if not agent_has_spoken:
        print("[GREETING] ⚠️ Proactivity didn't trigger in 3s - FORCING GREETING")
        greeting_text = "Dobar dan! Ja sam AI asistent za TotalObserver. Kako mogu da pomognem?"
        asyncio.create_task(session.say(greeting_text))

    print(f"[DEMO AGENT] ✓ Agent started - listening for voice input\n")

if __name__ == "__main__":
    print("=" * 70)
    print("TOTALOBSERVER DEMO AGENT")
    print("  Layer 1: Gemini Realtime (fast audio)")
    print("  Layer 2: MCP Bridge (tool calling)")
    print("  Layer 3: Real Google APIs + Mock TotalObserver/CRM")
    print("  Language: Serbian")
    print("=" * 70)

    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="totalobserver-demo"
    ))
