import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { interpretPlaybackResponseSchema } from "@doujin/contracts";

// Mocking environment for standalone test
async function testInterpretation(prompt: string, currentMs: number, durationMs: number) {
    console.log(`Testing prompt: "${prompt}" (at ${currentMs}ms / ${durationMs}ms)`);

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
Context: Current position ${currentMs}ms, Duration ${durationMs}ms`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("AI response was not valid JSON");
    }

    const interpreted = JSON.parse(jsonMatch[0]);
    const response = interpretPlaybackResponseSchema.safeParse(interpreted);

    if (!response.success) {
        console.error("AI response schema mismatch:", response.error);
        return;
    }

    console.log("Interpretation:", JSON.stringify(response.data, null, 2));
}

async function runTests() {
    await testInterpretation("play the video", 0, 10000);
    await testInterpretation("go to 5 seconds", 0, 10000);
    await testInterpretation("restart", 5000, 10000);
    await testInterpretation("pause", 2000, 10000);
    await testInterpretation("go to the middle", 0, 12000);
}

runTests().catch(console.error);
