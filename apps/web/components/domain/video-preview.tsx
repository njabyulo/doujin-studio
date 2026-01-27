'use client';

import type { TStoryboard } from '@a-ds/remotion';
import { Master } from '@a-ds/remotion';
import { Player } from '@remotion/player';

interface VideoPreviewProps {
  storyboard: TStoryboard;
}

export function VideoPreview({ storyboard }: VideoPreviewProps) {
  const durationInFrames = storyboard.scenes.reduce(
    (acc, scene) => acc + scene.durationInSeconds * 30,
    0
  );

  return (
    <div className="bg-card rounded-lg shadow border p-6">
      <h2 className="text-lg font-semibold mb-4">Preview</h2>
      <Player
        component={Master}
        inputProps={storyboard}
        durationInFrames={durationInFrames}
        fps={30}
        compositionWidth={1920}
        compositionHeight={1080}
        style={{ width: '100%' }}
        controls
      />
    </div>
  );
}
