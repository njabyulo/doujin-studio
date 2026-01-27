'use client';

import type { TStoryboard } from '@a-ds/remotion';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface StoryboardEditorProps {
  storyboard: TStoryboard;
  onChange: (storyboard: TStoryboard) => void;
}

export function StoryboardEditor({ storyboard, onChange }: StoryboardEditorProps) {
  const updateBranding = (key: string, value: string) => {
    onChange({
      ...storyboard,
      branding: { ...storyboard.branding, [key]: value },
    });
  };

  const updateScene = (index: number, key: string, value: string | number) => {
    const scenes = [...storyboard.scenes];
    scenes[index] = { ...scenes[index], [key]: value };
    onChange({ ...storyboard, scenes });
  };

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg shadow border">
      <div className="space-y-2">
        <Label htmlFor="adTitle">Ad Title</Label>
        <Input
          id="adTitle"
          type="text"
          value={storyboard.adTitle}
          onChange={(e) => onChange({ ...storyboard, adTitle: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryColor">Primary Color</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={storyboard.branding.primaryColor}
            onChange={(e) => updateBranding('primaryColor', e.target.value)}
            className="h-10 w-20 border border-input rounded cursor-pointer"
          />
          <Input
            id="primaryColor"
            type="text"
            value={storyboard.branding.primaryColor}
            onChange={(e) => updateBranding('primaryColor', e.target.value)}
            pattern="^#[0-9A-Fa-f]{6}$"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fontFamily">Font Family</Label>
        <Select
          value={storyboard.branding.fontFamily}
          onValueChange={(value) => updateBranding('fontFamily', value)}
        >
          <SelectTrigger id="fontFamily">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter</SelectItem>
            <SelectItem value="Roboto">Roboto</SelectItem>
            <SelectItem value="Montserrat">Montserrat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <Label>Scenes</Label>
        {storyboard.scenes.map((scene, index) => (
          <div key={index} className="border border-border p-4 rounded-md space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Scene {index + 1}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`scene-${index}-text`} className="text-xs">
                Text Overlay
              </Label>
              <Input
                id={`scene-${index}-text`}
                type="text"
                placeholder="Text Overlay"
                value={scene.textOverlay}
                onChange={(e) => updateScene(index, 'textOverlay', e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`scene-${index}-duration`} className="text-xs">
                Duration (seconds)
              </Label>
              <Input
                id={`scene-${index}-duration`}
                type="number"
                placeholder="Duration (seconds)"
                value={scene.durationInSeconds}
                onChange={(e) => updateScene(index, 'durationInSeconds', Number(e.target.value))}
                min={1}
                max={10}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
