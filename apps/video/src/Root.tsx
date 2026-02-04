import "./index.css";
import { Composition, Folder } from "remotion";
import { WebLaunchVideo } from "./Composition";

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
        />
      </Folder>
    </>
  );
};
