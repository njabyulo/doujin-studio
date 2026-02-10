import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { interpretPlaybackRequestSchema, interpretPlaybackResponseSchema } from "@doujin/contracts";

export const runtime = "edge";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = interpretPlaybackRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
        }

        const { prompt, currentMs, durationMs } = result.data;

        const { text } = await generateText({
            model: google("gemini-2.0-flash"),
            system: `You are a video editor playback controller.
The user provides a command in natural language and you interpret it into a structured playback action.

Available commands:
- { "type": "play" }: Start playing the video.
- { "type": "pause" }: Pause the video.
- { "type": "seek", "toMs": number }: Jump to a specific time in milliseconds.
- { "type": "none", "message": string }: The command is not recognized or not related to playback control.

Rules:
1. "Restart" or "beginning" -> seek to 0.
2. Recognize time durations like "5s", "10 seconds", "halfway".
3. Map "stop" or "hold on" to "pause".
4. Provide a brief reasoning for your choice.
5. Output ONLY the JSON object.`,
            prompt: `Prompt: "${prompt}"
Context: Current position ${currentMs ?? 0}ms, Duration ${durationMs ?? 0}ms`,
        });

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 500 });
        }

        const interpreted = JSON.parse(jsonMatch[0]);
        const response = interpretPlaybackResponseSchema.safeParse(interpreted);

        if (!response.success) {
            console.error("AI response schema mismatch:", response.error);
            return NextResponse.json({ error: "AI response schema mismatch" }, { status: 500 });
        }

        return NextResponse.json(response.data);
    } catch (error) {
        console.error("Interpretation API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
