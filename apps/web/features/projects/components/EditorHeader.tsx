import { ArrowLeft, MoreHorizontal, Pencil, Save, Plus } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EditorTimelineState } from "~/lib/timeline-state";
import { UploadSession } from "~/lib/upload-session";
import { useRouter } from "next/navigation";

interface EditorHeaderProps {
  title: string;
  timelineStatusLabel: string;
  timelineState: EditorTimelineState | null;
  upload: UploadSession | null;
  handleAddClip: () => void;
  handleManualSave: () => Promise<boolean | undefined>;
}

export function EditorHeader({
  title,
  timelineStatusLabel,
  timelineState,
  upload,
  handleAddClip,
  handleManualSave,
}: EditorHeaderProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
      <Button
        variant="glass"
        size="icon"
        className="rounded-full"
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="flex justify-center">
        <div className="editor-pill pill-float flex items-center gap-2 text-sm font-semibold">
          <span>Project: {title}</span>
          <Badge variant="subtle" className="normal-case">
            {timelineStatusLabel}
          </Badge>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-full bg-white/10 p-1 leading-none text-white/70 transition hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="glass" size="icon" className="rounded-full">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Project</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>Export still</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="glass"
          size="icon"
          className="rounded-full"
          onClick={handleAddClip}
          disabled={!upload?.url}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="glass"
          size="icon"
          className="rounded-full"
          onClick={() => void handleManualSave()}
          disabled={!timelineState || timelineState.saveStatus === "saving"}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
