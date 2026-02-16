import { Composition } from "remotion";
import {
  SpringFestivalVideo,
  type SpringFestivalProps,
  OUTRO_FRAMES,
} from "./SpringFestivalVideo";
import { FPS } from "./constants";

const defaultProps: SpringFestivalProps = {
  senderName: "Noiz",
  recipientName: "朋友",
  openingText: "骏马迎春·万象更新",
  blessings: ["愿新的一年", "万事如意", "阖家幸福", "马年大吉"],
  videoFile: "celebration.mp4",
  ttsOpeningText: "朋友，新年好！给你录了段新年祝福，一起来看看吧。",
  ttsOpeningAudioFile: undefined,
  ttsBlessingAudioFile: undefined,
  festival: "spring",
  scene1Frames: 150, // 5s
  scene2Frames: 150, // 5s
  scene3Frames: 180, // 6s
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SpringFestivalVideo"
        component={SpringFestivalVideo}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => {
          // 总帧数 = Scene1 + Scene2 + Scene3 + Outro(3s)
          const totalFrames =
            (props.scene1Frames ?? 150) +
            (props.scene2Frames ?? 150) +
            (props.scene3Frames ?? 180) +
            OUTRO_FRAMES;
          return {
            durationInFrames: totalFrames,
          };
        }}
      />
    </>
  );
};
