"use client";

import { Master } from "@doujin/remotion";
import type { TBrandKit, TStoryboard } from "@doujin/shared";
import { FORMAT_SPECS } from "@doujin/shared";
import { Player } from "@remotion/player";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface GeneratedStateProps {
  storyboard: TStoryboard;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    type: string;
    contentJson: unknown;
    createdAt: Date;
  }>;
  onSendMessage: (message: string) => void;
}

const getAspectRatio = (format: "1:1" | "9:16" | "16:9"): string => {
  const spec = FORMAT_SPECS[format];
  return `${spec.width} / ${spec.height}`;
};

const getDurationInFrames = (storyboard: TStoryboard): number => {
  return Math.round(storyboard.totalDuration * 30);
};

const defaultBrandKit: TBrandKit = {
  version: "1",
  productName: "Untitled",
  tagline: "",
  benefits: [],
  colors: {
    primary: "#3B82F6",
    secondary: "#1E40AF",
    accent: "#F97316",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
  tone: "professional",
};

const mapToRemotionProps = (
  storyboard: TStoryboard,
): import("@doujin/remotion").TRenderInput => ({
  storyboard,
  brandKit: defaultBrandKit,
});

export function GeneratedState({
  storyboard,
  messages,
  onSendMessage,
}: GeneratedStateProps) {
  const [chatInput, setChatInput] = useState("");
  const shouldRenderPlayer = process.env.NODE_ENV !== "test";

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput("");
    }
  };

  const formatSpec = FORMAT_SPECS[storyboard.format];

  return (
    <div className="flex h-screen">
      <div className="w-[60%] border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Editor</h2>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div
            style={{
              width: "100%",
              aspectRatio: getAspectRatio(storyboard.format),
            }}
          >
            {shouldRenderPlayer ? (
              <Player
                component={Master}
                compositionWidth={formatSpec.width}
                compositionHeight={formatSpec.height}
                durationInFrames={getDurationInFrames(storyboard)}
                fps={30}
                style={{ width: "100%", height: "100%" }}
                inputProps={mapToRemotionProps(storyboard)}
                acknowledgeRemotionLicense
                controls
              />
            ) : (
              <div
                style={{ width: "100%", height: "100%" }}
                aria-label="Remotion player placeholder"
              />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Scenes</h3>
            {storyboard.scenes.map((scene, idx) => (
              <div key={scene.id} className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Scene {idx + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    {scene.duration}s
                  </span>
                </div>
                <div className="text-sm mb-1">{scene.onScreenText}</div>
                <div className="text-xs text-muted-foreground">
                  {scene.voiceoverText}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Timeline</h3>
            <div className="h-16 bg-muted rounded-lg flex items-center px-4">
              <div className="flex gap-1 flex-1">
                {storyboard.scenes.map((scene, idx) => {
                  const widthPercent =
                    (scene.duration / storyboard.totalDuration) * 100;
                  return (
                    <div
                      key={scene.id}
                      className="bg-blue-500 h-8 rounded flex items-center justify-center text-xs text-white"
                      style={{ width: `${widthPercent}%` }}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-[40%] flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Chat</h2>
        </div>

        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === "user" ? "bg-blue-500 text-white" : "bg-muted"
                }`}
              >
                <div className="text-sm">{JSON.stringify(msg.contentJson)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit">Send</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
