export interface EditorProps {
    projectId?: string;
}

export type ToolItem = {
    id: string;
    label: string;
    icon: React.ElementType;
};

export type ClipItem = {
    id: string;
    label: string;
    gradient: string;
    startMs: number;
    endMs: number;
};
