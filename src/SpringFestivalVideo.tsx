import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  interpolate,
  Easing,
  OffthreadVideo,
  staticFile,
} from "remotion";
import { TextReveal } from "./components/TextReveal";
import { BlessingText } from "./components/BlessingText";
import { getTheme, type ThemeType, type FestivalType } from "./themes";

// 场景之间的过渡帧数
const TRANSITION_FRAMES = 20;
// 片尾推广固定 3 秒
export const OUTRO_FRAMES = 90;

const FadeTransition: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
}> = ({
  children,
  durationInFrames,
  fadeIn = TRANSITION_FRAMES,
  fadeOut = TRANSITION_FRAMES,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

// 飘落的主题色粒子背景
const ThemeParticles: React.FC<{ colors: string[] }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const particles = Array.from({ length: 30 }, (_, i) => {
    const x = (i * 137.5) % 100;
    const speed = 0.3 + (i % 5) * 0.15;
    const y = ((frame * speed + i * 50) % 140) - 20;
    const size = 3 + (i % 4) * 2;
    const opacity = 0.2 + (i % 3) * 0.15;
    const rotation = frame * (0.5 + (i % 3) * 0.3);
    const colorIndex = i % colors.length;

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: i % 2 === 0 ? "50%" : "0%",
          background: `radial-gradient(circle, ${colors[colorIndex]}, ${colors[(colorIndex + 1) % colors.length]})`,
          opacity,
          transform: `rotate(${rotation}deg)`,
          boxShadow: `0 0 ${size * 2}px ${colors[colorIndex]}40`,
        }}
      />
    );
  });

  return <AbsoluteFill>{particles}</AbsoluteFill>;
};

// 片尾推广场景
const OutroScene: React.FC<{ durationInFrames: number; primaryColor: string }> = ({
  durationInFrames,
  primaryColor,
}) => {
  const frame = useCurrentFrame();

  // 淡入
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 文字从下方轻微上移
  const translateY = interpolate(frame, [0, 25], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // 网址有微弱的呼吸光效
  const glowOpacity = interpolate(
    frame,
    [30, 50, 70, 90],
    [0.4, 0.8, 0.4, 0.8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
        gap: 28,
      }}
    >
      <div
        style={{
          fontSize: 36,
          color: "rgba(255, 245, 230, 0.75)",
          fontWeight: 500,
          letterSpacing: 2,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        想要制作类似的祝福视频？
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 900,
          background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}cc, ${primaryColor})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: 4,
          filter: `drop-shadow(0 0 20px ${primaryColor}${Math.round(glowOpacity * 127).toString(16).padStart(2, '0')})`,
        }}
      >
        https://minv.io/
      </div>
    </AbsoluteFill>
  );
};

export type SpringFestivalProps = {
  senderName: string;
  recipientName: string;
  openingText: string;
  blessings: string[];
  videoFile: string;
  ttsOpeningText?: string; // Scene 1 开场语音文字内容
  ttsOpeningAudioFile?: string; // Scene 1 开场语音
  ttsBlessingAudioFile?: string; // Scene 3 祝福语音
  theme?: ThemeType; // 主题风格
  festival?: FestivalType; // 节日类型
  // 动态场景帧数 — 由服务端根据 TTS 和用户视频时长计算
  scene1Frames: number; // 开场动画
  scene2Frames: number; // 用户视频
  scene3Frames: number; // 祝福文本（由 TTS 时长决定）
};

export const SpringFestivalVideo: React.FC<SpringFestivalProps> = ({
  senderName,
  recipientName,
  openingText,
  blessings,
  videoFile,
  ttsOpeningText,
  ttsOpeningAudioFile,
  ttsBlessingAudioFile,
  theme = "traditional",
  festival = "spring",
  scene1Frames,
  scene2Frames,
  scene3Frames,
}) => {
  const themeConfig = getTheme(theme);
  const { colors } = themeConfig;

  // 场景起止帧（带过渡重叠）
  const scene1Start = 0;
  const scene1Duration = scene1Frames + TRANSITION_FRAMES;

  const scene2Start = scene1Frames - TRANSITION_FRAMES;
  const scene2Duration = scene2Frames + TRANSITION_FRAMES * 2;

  const scene3Start = scene1Frames + scene2Frames - TRANSITION_FRAMES;
  const scene3Duration = scene3Frames + TRANSITION_FRAMES;

  // Scene 4 (outro): 紧跟 Scene 3 之后，带过渡
  const outroStart = scene1Frames + scene2Frames + scene3Frames - TRANSITION_FRAMES;
  const outroDuration = OUTRO_FRAMES + TRANSITION_FRAMES;

  return (
    <AbsoluteFill
      style={{
        background: colors.background,
      }}
    >
      {/* 主题色粒子背景 */}
      <ThemeParticles colors={colors.particleColors} />

      {/* 开场语音 — Scene 1 播放 */}
      {ttsOpeningAudioFile && (
        <Sequence from={scene1Start}>
          <Audio src={staticFile(ttsOpeningAudioFile)} volume={0.85} />
        </Sequence>
      )}

      {/* 祝福语音 — Scene 3 播放 */}
      {ttsBlessingAudioFile && (
        <Sequence from={scene3Start}>
          <Audio src={staticFile(ttsBlessingAudioFile)} volume={0.85} />
        </Sequence>
      )}

      {/* Scene 1: 开场文本动画 */}
      <Sequence from={scene1Start} durationInFrames={scene1Duration}>
        <FadeTransition
          durationInFrames={scene1Duration}
          fadeIn={15}
          fadeOut={TRANSITION_FRAMES}
        >
          <TextReveal 
            name={recipientName} 
            text={openingText}
            speechText={ttsOpeningText}
            theme={theme}
            durationInFrames={scene1Duration}
            sceneIndex={1}
            totalScenes={4}
          />
        </FadeTransition>
      </Sequence>

      {/* Scene 2: 用户上传的视频 */}
      <Sequence from={scene2Start} durationInFrames={scene2Duration}>
        <FadeTransition
          durationInFrames={scene2Duration}
          fadeIn={TRANSITION_FRAMES}
          fadeOut={TRANSITION_FRAMES}
        >
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <OffthreadVideo
              src={staticFile(videoFile)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </AbsoluteFill>
        </FadeTransition>
      </Sequence>

      {/* Scene 3: 祝福文本 */}
      <Sequence from={scene3Start} durationInFrames={scene3Duration}>
        <FadeTransition
          durationInFrames={scene3Duration}
          fadeIn={TRANSITION_FRAMES}
          fadeOut={TRANSITION_FRAMES}
        >
          <BlessingText
            senderName={senderName}
            recipientName={recipientName}
            blessings={blessings}
            durationInFrames={scene3Duration}
            theme={theme}
            festival={festival}
          />
        </FadeTransition>
      </Sequence>

      {/* Scene 4: 片尾推广 */}
      <Sequence from={outroStart} durationInFrames={outroDuration}>
        <FadeTransition
          durationInFrames={outroDuration}
          fadeIn={TRANSITION_FRAMES}
          fadeOut={20}
        >
          <OutroScene durationInFrames={outroDuration} primaryColor={colors.primary} />
        </FadeTransition>
      </Sequence>
    </AbsoluteFill>
  );
};
