import { describe, expect, it } from "vitest";
import {
  applyEditorCommand,
  createDefaultTimelineData,
} from "../lib/timeline-state";
import type { TimelineData } from "../lib/timelines-api";

const createTimelineFixture = (): TimelineData => {
  const base = createDefaultTimelineData();
  const videoTrack = base.tracks.find((track) => track.kind === "video");
  const subtitleTrack = base.tracks.find((track) => track.kind === "subtitle");
  if (!videoTrack || !subtitleTrack) {
    throw new Error("Expected default tracks");
  }

  return {
    ...base,
    durationMs: 12_000,
    tracks: [
      {
        ...videoTrack,
        clips: [
          {
            id: "clip-1",
            type: "video",
            trackId: videoTrack.id,
            assetId: "asset-1",
            startMs: 0,
            endMs: 4_000,
            sourceStartMs: 0,
            volume: 1,
            text: null,
          },
        ],
      },
      {
        ...subtitleTrack,
        clips: [],
      },
    ],
  };
};

describe("timeline-state reducer", () => {
  it("adds clips and keeps deterministic order", () => {
    const initial = createTimelineFixture();
    const videoTrack = initial.tracks.find((track) => track.kind === "video");
    if (!videoTrack) {
      throw new Error("Missing video track");
    }

    const withLaterClip = applyEditorCommand(initial, {
      type: "addClip",
      trackId: videoTrack.id,
      clip: {
        assetId: "asset-2",
        startMs: 7_000,
        durationMs: 2_000,
      },
    });
    const withEarlierClip = applyEditorCommand(withLaterClip, {
      type: "addClip",
      trackId: videoTrack.id,
      clip: {
        assetId: "asset-3",
        startMs: 5_000,
        durationMs: 500,
      },
    });

    const sortedStarts = withEarlierClip.tracks
      .find((track) => track.kind === "video")
      ?.clips.map((clip) => clip.startMs);
    expect(sortedStarts).toEqual([0, 5_000, 7_000]);
  });

  it("trims clips and advances sourceStartMs", () => {
    const initial = createTimelineFixture();
    const trimmed = applyEditorCommand(initial, {
      type: "trimClip",
      clipId: "clip-1",
      startMs: 500,
      endMs: 3_000,
    });

    const clip = trimmed.tracks
      .flatMap((track) => track.clips)
      .find((candidate) => candidate.id === "clip-1");
    expect(clip?.startMs).toBe(500);
    expect(clip?.endMs).toBe(3_000);
    expect(clip?.sourceStartMs).toBe(500);
  });

  it("splits clips and preserves minimum duration", () => {
    const initial = createTimelineFixture();
    const split = applyEditorCommand(initial, {
      type: "splitClip",
      clipId: "clip-1",
      atMs: 2_000,
    });

    const clips = split.tracks
      .flatMap((track) => track.clips)
      .filter((clip) => clip.assetId === "asset-1");
    expect(clips).toHaveLength(2);
    expect(clips[0]?.startMs).toBe(0);
    expect(clips[0]?.endMs).toBe(2_000);
    expect(clips[1]?.startMs).toBe(2_000);
    expect(clips[1]?.endMs).toBe(4_000);
    expect(clips[1]?.sourceStartMs).toBe(2_000);
  });

  it("moves clips, sets volume, and removes clips", () => {
    const initial = createTimelineFixture();
    const videoTrack = initial.tracks.find((track) => track.kind === "video");
    if (!videoTrack) {
      throw new Error("Missing video track");
    }

    const moved = applyEditorCommand(initial, {
      type: "moveClip",
      clipId: "clip-1",
      trackId: videoTrack.id,
      startMs: 1_500,
    });
    const louder = applyEditorCommand(moved, {
      type: "setVolume",
      clipId: "clip-1",
      volume: 1.8,
    });
    const removed = applyEditorCommand(louder, {
      type: "removeClip",
      clipId: "clip-1",
    });

    const movedClip = louder.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === "clip-1");
    expect(movedClip?.startMs).toBe(1_500);
    expect(movedClip?.endMs).toBe(5_500);
    expect(movedClip?.volume).toBe(1.8);
    expect(removed.tracks.flatMap((track) => track.clips)).toHaveLength(0);
  });

  it("adds subtitle clips with bounded timing", () => {
    const initial = createTimelineFixture();
    const subtitleTrack = initial.tracks.find(
      (track) => track.kind === "subtitle",
    );
    if (!subtitleTrack) {
      throw new Error("Missing subtitle track");
    }

    const withSubtitle = applyEditorCommand(initial, {
      type: "addSubtitle",
      trackId: subtitleTrack.id,
      text: "Caption text",
      startMs: 1_000,
      endMs: 2_400,
    });

    const clip = withSubtitle.tracks
      .find((track) => track.kind === "subtitle")
      ?.clips.at(0);
    expect(clip?.type).toBe("subtitle");
    expect(clip?.assetId).toBeNull();
    expect(clip?.text).toBe("Caption text");
    expect(clip?.startMs).toBe(1_000);
    expect(clip?.endMs).toBe(2_400);
  });
});
