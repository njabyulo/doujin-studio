import { Plus, Play } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ClipItem } from "../types";
import { formatTimestamp } from "../utils";
import { cn } from "~/lib/utils";

interface EditorTimelineProps {
    clips: ClipItem[];
    timeChips: string[];
    handleAddClip: () => void;
    handleSplitClip: () => void;
    handleTrimClip: () => void;
    handleMoveClip: () => void;
    handleSetVolume: () => void;
    handleAddSubtitle: () => void;
    handleRemoveClip: () => void;
    isAddClipDisabled: boolean;
    isActionDisabled: boolean;
    isSubtitleDisabled: boolean;
}

export function EditorTimeline({
    clips,
    timeChips,
    handleAddClip,
    handleSplitClip,
    handleTrimClip,
    handleMoveClip,
    handleSetVolume,
    handleAddSubtitle,
    handleRemoveClip,
    isAddClipDisabled,
    isActionDisabled,
    isSubtitleDisabled,
}: EditorTimelineProps) {
    return (
        <>
            <div className="timelineDock px-6 py-5">
                <div className="flex items-center gap-4">
                    <Button
                        variant="glass"
                        size="icon"
                        className="rounded-full"
                        onClick={handleAddClip}
                        disabled={isAddClipDisabled}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>

                    <div className="relative flex-1 overflow-hidden">
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {clips.map((clip) => (
                                <div
                                    key={clip.id}
                                    className="timeline-clip"
                                    style={{ backgroundImage: clip.gradient }}
                                >
                                    <span className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                                        {clip.label} · {formatTimestamp(clip.startMs)}-
                                        {formatTimestamp(clip.endMs)}
                                    </span>
                                </div>
                            ))}
                            <div className="timeline-clip flex items-center justify-center text-white/70">
                                <Plus className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="timeline-playhead absolute left-1/2 top-0 h-full" />
                    </div>

                    <Button
                        variant="glass"
                        size="icon"
                        className="rounded-full"
                        onClick={handleSplitClip}
                        disabled={isActionDisabled}
                    >
                        <Play className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={handleTrimClip}
                        disabled={isActionDisabled}
                    >
                        Trim
                    </Button>
                    <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={handleSplitClip}
                        disabled={isActionDisabled}
                    >
                        Split
                    </Button>
                    <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={handleMoveClip}
                        disabled={isActionDisabled}
                    >
                        Move
                    </Button>
                    <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={handleSetVolume}
                        disabled={isActionDisabled}
                    >
                        Volume
                    </Button>
                    <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={handleAddSubtitle}
                        disabled={isSubtitleDisabled}
                    >
                        Subtitle
                    </Button>
                    <Button
                        variant="glass"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={handleRemoveClip}
                        disabled={isActionDisabled}
                    >
                        Remove
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                {timeChips.map((chip, index) => (
                    <button
                        key={`${chip}-${index}`}
                        type="button"
                        className={cn(
                            "time-chip",
                            index === 4 && "time-chip-active",
                        )}
                    >
                        {chip}
                    </button>
                ))}
            </div>
        </>
    );
}
