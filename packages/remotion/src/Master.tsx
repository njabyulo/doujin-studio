import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Scene } from './Scene';
import { TStoryboard } from './types';

export const Master: React.FC<TStoryboard> = ({ adTitle, branding, scenes }) => {
  const { fps } = useVideoConfig();

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {scenes.map((scene, index) => {
        const durationInFrames = scene.durationInSeconds * fps;
        const from = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            <Scene scene={scene} branding={branding} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
