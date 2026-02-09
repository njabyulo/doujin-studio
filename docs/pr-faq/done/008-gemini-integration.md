# PR/FAQ: Gemini 3 Integration

## Press Release

**Title**
Gemini-Powered Timeline Editing in the Cinematic Editor

**Summary**
The editor now uses Gemini through the AI SDK to power chat-driven timeline edits. Requests stream back to the UI, and structured tool calls apply validated `EditorCommand` mutations to the latest timeline version.

**Customer Quote**
"It didn’t just caption my clip. It understood the mood and built a cut plan I could actually use." 

**How It Works**
- The web chat panel sends messages and timeline context to `POST /api/ai/chat`.
- The API route uses Gemini Flash via AI SDK `streamText` for streaming assistant responses.
- Gemini tool calls are constrained to `applyEditorCommands({ timelineId, commands })`.
- Commands are validated, bounded, applied atomically, and persisted as new timeline versions with `source: "ai"`.

**Why It Matters**
This provides a real, end-to-end AI edit loop: users describe edits in chat, and the timeline changes are saved with versioned history.

## FAQ

**Which Gemini capabilities are used now?**
Streaming chat generation plus structured tool-calling for timeline edits.

**Is full video frame/audio analysis implemented in this epic?**
Not yet. The current implementation supports timeline metadata, notes, transcript, keyframes, and optional video reference context scaffolding.

**Is this a simple wrapper?**
No. Model output is integrated with bounded tool execution that writes validated timeline versions.

**What happens if Gemini is unavailable?**
The request fails gracefully and the user can continue manual timeline editing.
