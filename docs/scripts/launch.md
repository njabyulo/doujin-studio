# Web Launch Voiceover Script (Updated `apps/web` Flow)

## Target
- Runtime: 30-34 seconds
- Voice: confident, technical, warm
- Pace: ~145 words per minute
- Output file for Remotion: `apps/video/public/assets/web-launch.mp3`

## Pronunciation Notes
- "R2" as "R two"
- "API" as "A P I"
- "Doujin" as "Doe-jin"

## Timestamped Script

### 00:00-00:06
Doujin Studio starts simple: upload a clip, direct the edit, and ship a cinematic cut.

### 00:06-00:13
Before any upload, we verify your session, create a real project, and issue a presigned PUT URL.

### 00:13-00:20
The browser sends video bytes straight to R2. Then the API confirms object size, stores metadata, and marks the asset uploaded.

### 00:20-00:28
Inside the editor, every control dispatches one command bus: add clip, trim, split, move, volume, subtitles, remove.

### 00:28-00:34
Edits update instantly, autosave with version checks, and manual save writes explicit timeline versions you can reload exactly.

## On-Screen Beat Map (for `WebLaunchVideo.tsx`)
- Home beat: "Upload a clip. Direct the edit. Ship a cinematic cut."
- Storage beat: `/api/me` -> project create -> upload-session -> R2 PUT -> complete -> secure file stream
- Editor beat: command chips + timeline status transitions (`Unsaved edits`, `Saving...`, `Saved`)
- Versioning beat: `baseVersion` optimistic locking + conflict guard
- Outro beat: "Upload once. Edit by command. Keep every version."

## TTS Prompt (copy/paste)
Use this as your speech generator text:

```text
Doujin Studio starts simple: upload a clip, direct the edit, and ship a cinematic cut.
Before any upload, we verify your session, create a real project, and issue a presigned PUT URL.
The browser sends video bytes straight to R2. Then the API confirms object size, stores metadata, and marks the asset uploaded.
Inside the editor, every control dispatches one command bus: add clip, trim, split, move, volume, subtitles, remove.
Edits update instantly, autosave with version checks, and manual save writes explicit timeline versions you can reload exactly.
```

## Free Voiceover Option (Local, No Credits)

### Option A: Piper TTS (open-source)
1. Install Piper and FFmpeg.
2. Generate WAV:
```bash
echo "Doujin Studio starts simple..." | piper --model en_US-lessac-medium --output_file /tmp/web-launch.wav
```
3. Convert to MP3 expected by Remotion:
```bash
ffmpeg -y -i /tmp/web-launch.wav -codec:a libmp3lame -q:a 2 apps/video/public/assets/web-launch.mp3
```

### Option B: Browser-based free tools
- Use a free TTS web app and export MP3/WAV, then place it at `apps/video/public/assets/web-launch.mp3`.
- Keep speaking rate near 0.95-1.0x and avoid dramatic pitch shifts for this script.

## Quick QC Checklist
- Audio length lands between 30s and 34s.
- No clipped plosives on "project", "presigned", "PUT".
- "R2" and "API" are spoken clearly.
- File is mono or stereo MP3 and plays in Remotion Studio.
