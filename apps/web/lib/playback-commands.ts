import { interpretPlaybackRequestSchema, type InterpretPlaybackResponse } from "@doujin/contracts";

export async function interpretPlaybackCommand(args: {
    prompt: string;
    currentMs?: number;
    durationMs?: number;
}): Promise<InterpretPlaybackResponse> {
    const payload = interpretPlaybackRequestSchema.parse(args);

    const response = await fetch("/api/editor/interpret", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to interpret command");
    }

    return response.json();
}

export function executePlaybackCommand(
    video: HTMLVideoElement,
    command: InterpretPlaybackResponse["command"],
) {
    switch (command.type) {
        case "play":
            void video.play();
            break;
        case "pause":
            video.pause();
            break;
        case "seek":
            video.currentTime = command.toMs / 1000;
            break;
        case "none":
            // No-op or show message
            break;
    }
}
