import type {
  TEditorCommand,
  TTimelineClip,
  TTimelineData,
  TTimelineTrack,
} from "../types";

const MIN_CLIP_DURATION_MS = 100;

function createId() {
  return crypto.randomUUID();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMaxEndMs(data: TTimelineData) {
  let maxEnd = 0;
  for (const track of data.tracks) {
    for (const clip of track.clips) {
      maxEnd = Math.max(maxEnd, clip.endMs);
    }
  }

  return maxEnd;
}

function sortClips(clips: TTimelineClip[]) {
  return [...clips].sort((left, right) => {
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizeTimelineData(data: TTimelineData): TTimelineData {
  const tracks = data.tracks.map((track) => ({
    ...track,
    clips: sortClips(track.clips),
  }));
  const maxEndMs = getMaxEndMs({ ...data, tracks });

  return {
    ...data,
    tracks,
    durationMs: Math.max(data.durationMs, maxEndMs),
  };
}

function findClip(
  data: TTimelineData,
  clipId: string,
): { track: TTimelineTrack; clip: TTimelineClip } | null {
  for (const track of data.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) {
      return { track, clip };
    }
  }

  return null;
}

export function createDefaultTimelineData(): TTimelineData {
  const videoTrackId = createId();
  const subtitleTrackId = createId();

  return {
    schemaVersion: 1 as const,
    fps: 30,
    durationMs: 10_000,
    tracks: [
      {
        id: videoTrackId,
        kind: "video" as const,
        name: "Video",
        clips: [],
      },
      {
        id: subtitleTrackId,
        kind: "subtitle" as const,
        name: "Subtitles",
        clips: [],
      },
    ],
  };
}

export function applyEditorCommand(
  data: TTimelineData,
  command: TEditorCommand,
): TTimelineData {
  if (command.type === "addClip") {
    const targetTrack = data.tracks.find(
      (track) => track.id === command.trackId,
    );
    if (!targetTrack || targetTrack.kind === "subtitle") {
      return data;
    }

    const startMs =
      command.clip.startMs ??
      targetTrack.clips.reduce((max, clip) => Math.max(max, clip.endMs), 0);
    const durationMs = Math.max(MIN_CLIP_DURATION_MS, command.clip.durationMs);
    const endMs = startMs + durationMs;
    const nextClip: TTimelineClip = {
      id: command.clip.id ?? createId(),
      type: targetTrack.kind,
      trackId: targetTrack.id,
      assetId: command.clip.assetId,
      startMs: Math.max(0, startMs),
      endMs: Math.max(MIN_CLIP_DURATION_MS, endMs),
      sourceStartMs: Math.max(0, command.clip.sourceStartMs ?? 0),
      volume: clamp(command.clip.volume ?? 1, 0, 2),
      text: null,
    };

    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((track) =>
        track.id === targetTrack.id
          ? { ...track, clips: [...track.clips, nextClip] }
          : track,
      ),
    });
  }

  if (command.type === "trimClip") {
    const located = findClip(data, command.clipId);
    if (!located) {
      return data;
    }

    const { track, clip } = located;
    const startCandidate = command.startMs ?? clip.startMs;
    const endCandidate = command.endMs ?? clip.endMs;
    const boundedStart = clamp(startCandidate, 0, data.durationMs);
    const boundedEnd = clamp(endCandidate, 0, data.durationMs);

    if (boundedEnd <= boundedStart) {
      return data;
    }

    let startMs = boundedStart;
    let endMs = boundedEnd;
    if (endMs - startMs < MIN_CLIP_DURATION_MS) {
      if (command.startMs !== undefined && command.endMs === undefined) {
        startMs = Math.max(0, endMs - MIN_CLIP_DURATION_MS);
      } else if (command.endMs !== undefined && command.startMs === undefined) {
        endMs = Math.min(data.durationMs, startMs + MIN_CLIP_DURATION_MS);
      } else {
        return data;
      }
    }

    const sourceDelta = Math.max(0, startMs - clip.startMs);
    const nextClip: TTimelineClip = {
      ...clip,
      startMs,
      endMs,
      sourceStartMs:
        clip.type === "subtitle"
          ? 0
          : Math.max(0, clip.sourceStartMs + sourceDelta),
    };

    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((candidate) =>
        candidate.id === track.id
          ? {
              ...candidate,
              clips: candidate.clips.map((item) =>
                item.id === clip.id ? nextClip : item,
              ),
            }
          : candidate,
      ),
    });
  }

  if (command.type === "splitClip") {
    const located = findClip(data, command.clipId);
    if (!located) {
      return data;
    }

    const { track, clip } = located;
    const splitPoint = clamp(
      command.atMs,
      clip.startMs + MIN_CLIP_DURATION_MS,
      clip.endMs - MIN_CLIP_DURATION_MS,
    );
    if (splitPoint <= clip.startMs || splitPoint >= clip.endMs) {
      return data;
    }

    const firstPart: TTimelineClip = {
      ...clip,
      endMs: splitPoint,
    };
    const secondPart: TTimelineClip = {
      ...clip,
      id: createId(),
      startMs: splitPoint,
      sourceStartMs:
        clip.type === "subtitle"
          ? 0
          : clip.sourceStartMs + (splitPoint - clip.startMs),
    };

    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((candidate) =>
        candidate.id === track.id
          ? {
              ...candidate,
              clips: candidate.clips.flatMap((item) =>
                item.id === clip.id ? [firstPart, secondPart] : [item],
              ),
            }
          : candidate,
      ),
    });
  }

  if (command.type === "moveClip") {
    const located = findClip(data, command.clipId);
    const targetTrack = data.tracks.find(
      (track) => track.id === command.trackId,
    );
    if (!located || !targetTrack) {
      return data;
    }

    const { track, clip } = located;
    if (clip.type !== targetTrack.kind) {
      return data;
    }

    const clipDuration = clip.endMs - clip.startMs;
    const startMs = Math.max(0, command.startMs);
    const movedClip: TTimelineClip = {
      ...clip,
      trackId: targetTrack.id,
      startMs,
      endMs: startMs + clipDuration,
    };

    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((candidate) => {
        if (candidate.id === track.id && candidate.id === targetTrack.id) {
          return {
            ...candidate,
            clips: candidate.clips.map((item) =>
              item.id === clip.id ? movedClip : item,
            ),
          };
        }

        if (candidate.id === track.id) {
          return {
            ...candidate,
            clips: candidate.clips.filter((item) => item.id !== clip.id),
          };
        }

        if (candidate.id === targetTrack.id) {
          return {
            ...candidate,
            clips: [...candidate.clips, movedClip],
          };
        }

        return candidate;
      }),
    });
  }

  if (command.type === "setVolume") {
    const located = findClip(data, command.clipId);
    if (!located) {
      return data;
    }

    const { track, clip } = located;
    if (clip.type === "subtitle") {
      return data;
    }

    const nextClip: TTimelineClip = {
      ...clip,
      volume: clamp(command.volume, 0, 2),
    };

    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((candidate) =>
        candidate.id === track.id
          ? {
              ...candidate,
              clips: candidate.clips.map((item) =>
                item.id === clip.id ? nextClip : item,
              ),
            }
          : candidate,
      ),
    });
  }

  if (command.type === "addSubtitle") {
    const targetTrack = data.tracks.find(
      (track) => track.id === command.trackId,
    );
    if (!targetTrack || targetTrack.kind !== "subtitle") {
      return data;
    }

    const startMs = clamp(command.startMs, 0, data.durationMs);
    const endMs = clamp(command.endMs, 0, data.durationMs);
    if (endMs <= startMs) {
      return data;
    }

    const nextClip: TTimelineClip = {
      id: createId(),
      type: "subtitle" as const,
      trackId: targetTrack.id,
      assetId: null,
      startMs,
      endMs,
      sourceStartMs: 0,
      volume: null,
      text: command.text,
    };

    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((track) =>
        track.id === targetTrack.id
          ? { ...track, clips: [...track.clips, nextClip] }
          : track,
      ),
    });
  }

  if (command.type === "removeClip") {
    const located = findClip(data, command.clipId);
    if (!located) {
      return data;
    }

    const { track } = located;
    return normalizeTimelineData({
      ...data,
      tracks: data.tracks.map((candidate) =>
        candidate.id === track.id
          ? {
              ...candidate,
              clips: candidate.clips.filter(
                (clip) => clip.id !== command.clipId,
              ),
            }
          : candidate,
      ),
    });
  }

  return data;
}
