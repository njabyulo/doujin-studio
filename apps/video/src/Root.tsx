import "./index.css";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import {
  CalculateMetadataFunction,
  Composition,
  Folder,
  staticFile,
} from "remotion";
import { WebLaunchVideo } from "./Composition";

type WebLaunchProps = {
  voiceoverSrc: string;
};

const calculateWebLaunchMetadata: CalculateMetadataFunction<
  WebLaunchProps
> = async ({ props, defaultProps }) => {
  const voiceoverSrc = props.voiceoverSrc ?? defaultProps.voiceoverSrc;

  if (!voiceoverSrc) {
    return {
      durationInFrames: 30 * 30,
    };
  }

  const durationInSeconds = await getAudioDurationInSeconds(voiceoverSrc);
  const fps = 30;

  return {
    durationInFrames: Math.ceil(durationInSeconds * fps),
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Launch">
        <Composition
          id="WebLaunch30"
          component={WebLaunchVideo}
          durationInFrames={30 * 30}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            voiceoverSrc: staticFile("assets/web-launch.mp3"),
          }}
          calculateMetadata={calculateWebLaunchMetadata}
        />
      </Folder>
    </>
  );
};
