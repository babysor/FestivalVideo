import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { type ThemeType } from "../themes";

// Scene 1: 开场 — 心形烟花 + 语音条 + 底部文字逐字出现

const CHAR_ANIM_DURATION = 15;

// ============= 确定性伪随机 =============
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ============= 心形参数方程 =============
function heartX(t: number): number {
  return 16 * Math.pow(Math.sin(t), 3);
}
function heartY(t: number): number {
  return -(
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t)
  );
}

// ============= 主题相关的烟花配色 =============
const THEME_FIREWORK_COLORS: Record<ThemeType, string[]> = {
  // 传统红金：金色、红色、橙色、暖白
  traditional: [
    "#ffd700", "#ffaa00", "#ff6b3d", "#ff4444", "#ff8c00",
    "#ffcc33", "#ff5533", "#ffe066", "#ff9966", "#fff5cc",
  ],
  // 现代科技：青蓝、电蓝、紫色、冰蓝
  modern: [
    "#00d9ff", "#00b4ff", "#6366f1", "#a855f7", "#38bdf8",
    "#818cf8", "#c084fc", "#22d3ee", "#67e8f9", "#e0f2fe",
  ],
  // 粉色温馨：粉红、桃红、薰衣草、浅紫
  cute: [
    "#ff69b4", "#ff85c8", "#da70d6", "#ee82ee", "#ff1493",
    "#c084fc", "#f0abfc", "#ffb6c1", "#e879f9", "#f472b6",
  ],
  // 墨绿优雅：翠绿、薄荷、金绿、浅碧
  elegant: [
    "#a3d9a5", "#7bc96f", "#4ade80", "#86efac", "#6ee7b7",
    "#a7f3d0", "#34d399", "#bef264", "#d9f99d", "#fde68a",
  ],
};

// 主题相关的暗色背景（开场专用深色调）
const THEME_SCENE_BG: Record<ThemeType, string> = {
  traditional:
    "radial-gradient(ellipse at 50% 40%, #2a0a08 0%, #1a0500 35%, #0a0200 65%, #000000 100%)",
  modern:
    "radial-gradient(ellipse at 50% 40%, #0f1035 0%, #080a1e 35%, #030412 65%, #000000 100%)",
  cute:
    "radial-gradient(ellipse at 50% 40%, #1a0a20 0%, #0d0510 35%, #050208 65%, #000000 100%)",
  elegant:
    "radial-gradient(ellipse at 50% 40%, #0a1a10 0%, #050f08 35%, #020804 65%, #000000 100%)",
};

// 主题文字颜色（底部文字）
const THEME_TEXT_COLOR: Record<ThemeType, string> = {
  traditional: "#ffe4b5", // 暖金奶油
  modern: "#c7e0f4",      // 冰蓝白
  cute: "#ddc998",         // 金粉
  elegant: "#d4e8d0",      // 淡绿奶白
};

// 主题文字光晕色
const THEME_TEXT_GLOW: Record<ThemeType, string> = {
  traditional: "rgba(255,215,0,0.4)",
  modern: "rgba(0,217,255,0.35)",
  cute: "rgba(221,201,152,0.4)",
  elegant: "rgba(163,217,165,0.35)",
};

// 语音条强调色（进度条已播放部分）
const THEME_BAR_ACCENT: Record<ThemeType, string> = {
  traditional: "#c4a050",
  modern: "#5b8fb9",
  cute: "#c4a86c",
  elegant: "#7aab7c",
};

// ============= 3D 心形烟花 =============
const HeartFirework: React.FC<{
  startFrame: number;
  centerX: number;
  centerY: number;
  scale: number;
  colors: string[];
}> = ({ startFrame, centerX, centerY, scale, colors }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const PARTICLE_COUNT = 90;
  const SCATTER_COUNT = 35;
  const TRAIL_COUNT = 25;

  // 粒子从中心扩展到心形位置
  const expandProgress = interpolate(localFrame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const overallOpacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 心形呼吸发光
  const breathe =
    localFrame > 35
      ? 0.85 + Math.sin((localFrame - 35) * 0.06) * 0.15
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: centerX,
        top: centerY,
        opacity: overallOpacity * breathe,
        transform: "translate(-50%, -50%)",
        perspective: 800,
        transformStyle: "preserve-3d" as const,
      }}
    >
      {/* ——— 心形轮廓粒子 ——— */}
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const t = (i / PARTICLE_COUNT) * Math.PI * 2;
        const rand = seededRandom(i);
        const rand2 = seededRandom(i + 100);

        const jitterX = (seededRandom(i + 300) - 0.5) * 2.5;
        const jitterY = (seededRandom(i + 400) - 0.5) * 2.5;
        const px = (heartX(t) + jitterX) * scale * expandProgress;
        const py = (heartY(t) + jitterY) * scale * expandProgress;
        const pz = (rand - 0.5) * 50;

        const size = 3 + rand * 5;
        const color = colors[Math.floor(rand2 * colors.length)];

        const twinkle =
          localFrame > 35
            ? 0.5 + Math.sin((localFrame + i * 7) * 0.1) * 0.5
            : 1;

        const particleOpacity =
          interpolate(localFrame, [rand * 12, rand * 12 + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) * twinkle;

        return (
          <div
            key={`h-${i}`}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle, #ffffffcc 0%, ${color} 45%, ${color}00 100%)`,
              opacity: particleOpacity,
              transform: `translateZ(${pz}px)`,
              boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 5}px ${color}60`,
            }}
          />
        );
      })}

      {/* ——— 心形内部散射发光粒子 ——— */}
      {Array.from({ length: SCATTER_COUNT }, (_, i) => {
        const rand = seededRandom(i + 500);
        const rand2 = seededRandom(i + 600);
        const rand3 = seededRandom(i + 700);

        const angle = rand * Math.PI * 2;
        const radius = rand2 * 0.55;
        const hx = heartX(angle) * radius * scale * expandProgress;
        const hy = heartY(angle) * radius * scale * expandProgress;

        const size = 2 + rand3 * 4;
        const color = colors[Math.floor(rand * colors.length)];

        const sparkle =
          localFrame > 25
            ? 0.15 + Math.sin((localFrame + i * 13) * 0.12) * 0.55
            : interpolate(localFrame, [15, 30], [0, 0.3], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

        return (
          <div
            key={`s-${i}`}
            style={{
              position: "absolute",
              left: hx,
              top: hy,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: sparkle,
              boxShadow: `0 0 ${size * 4}px ${color}80`,
            }}
          />
        );
      })}

      {/* ——— 下坠火花拖尾 ——— */}
      {Array.from({ length: TRAIL_COUNT }, (_, i) => {
        const idx = i * Math.floor(PARTICLE_COUNT / TRAIL_COUNT);
        const t = (idx / PARTICLE_COUNT) * Math.PI * 2;
        const rand = seededRandom(i + 1000);
        const trailStart = 15 + rand * 15;
        const trailFrame = localFrame - trailStart;
        if (trailFrame < 0) return null;

        const px = heartX(t) * scale;
        const py = heartY(t) * scale;

        const fallDistance = interpolate(
          trailFrame,
          [0, 40],
          [0, 160 + rand * 220],
          {
            extrapolateRight: "clamp",
            easing: Easing.in(Easing.quad),
          }
        );

        const trailOpacity = interpolate(
          trailFrame,
          [0, 4, 22, 40],
          [0, 0.7, 0.2, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        );

        const color = colors[Math.floor(rand * colors.length)];

        return (
          <div
            key={`t-${i}`}
            style={{
              position: "absolute",
              left: px - 1,
              top: py + fallDistance,
              width: 2,
              height: 12 + rand * 15,
              borderRadius: 2,
              background: `linear-gradient(to bottom, ${color}, transparent)`,
              opacity: trailOpacity,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </div>
  );
};

// ============= 语音播放条 =============
const VoiceBar: React.FC<{
  frame: number;
  durationFrames: number;
  durationSeconds: number;
  accentColor: string;
}> = ({ frame, durationFrames, durationSeconds, accentColor }) => {
  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const barOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 播放条内部可用宽度（去掉文字和 padding）
  const trackWidthPx = 220;
  const thumbLeft = 80 + progress * trackWidthPx;

  return (
    <div
      style={{
        position: "absolute",
        top: 155,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: barOpacity,
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 10,
      }}
    >
      {/* 花朵图标 */}
      <span style={{ fontSize: 24, filter: "drop-shadow(0 0 6px #ffd70060)" }}>
        🌸
      </span>

      {/* 进度条容器 */}
      <div
        style={{
          width: 380,
          height: 48,
          borderRadius: 24,
          background: "rgba(255, 248, 225, 0.88)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 22,
          paddingRight: 22,
          position: "relative",
          boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
        }}
      >
        {/* 时长文字 */}
        <span
          style={{
            fontSize: 26,
            color: "#7a6842",
            fontWeight: 500,
            whiteSpace: "nowrap",
            marginRight: 16,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {durationSeconds}&quot;
        </span>

        {/* 轨道 */}
        <div
          style={{
            flex: 1,
            height: 3,
            background: "#ddd3bb",
            borderRadius: 2,
            position: "relative",
          }}
        >
          {/* 已播放部分 */}
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: accentColor,
              borderRadius: 2,
            }}
          />
        </div>

        {/* 滑块 */}
        <div
          style={{
            position: "absolute",
            left: thumbLeft,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          }}
        />
      </div>
    </div>
  );
};

// ============= 猫咪剪影 =============
const CatSilhouette: React.FC<{ flip?: boolean; fillColor: string }> = ({
  flip,
  fillColor,
}) => (
  <svg
    width="55"
    height="48"
    viewBox="0 0 55 48"
    style={{ transform: flip ? "scaleX(-1)" : undefined }}
  >
    {/* 耳朵 */}
    <polygon points="10,20 4,2 20,15" fill={fillColor} />
    <polygon points="45,20 51,2 35,15" fill={fillColor} />
    {/* 头部 */}
    <ellipse cx="27" cy="30" rx="24" ry="18" fill={fillColor} />
  </svg>
);

// 根据背景色调计算猫咪剪影深色
const THEME_CAT_FILL: Record<ThemeType, string> = {
  traditional: "#1a0a08",
  modern: "#0a0c22",
  cute: "#1a1228",
  elegant: "#0a1510",
};

// ============= 导出组件 =============
export const TextReveal: React.FC<{
  name: string;
  text: string;
  speechText?: string;
  theme?: ThemeType;
  sceneIndex?: number;
  totalScenes?: number;
  durationInFrames?: number;
}> = ({
  name,
  text,
  speechText,
  theme = "traditional",
  sceneIndex = 1,
  totalScenes = 4,
  durationInFrames = 150,
}) => {
  const frame = useCurrentFrame();

  // 获取当前主题的烟花色、背景、文字色
  const fireworkColors = THEME_FIREWORK_COLORS[theme] ?? THEME_FIREWORK_COLORS.traditional;
  const sceneBg = THEME_SCENE_BG[theme] ?? THEME_SCENE_BG.traditional;
  const textColor = THEME_TEXT_COLOR[theme] ?? THEME_TEXT_COLOR.traditional;
  const textGlow = THEME_TEXT_GLOW[theme] ?? THEME_TEXT_GLOW.traditional;
  const barAccent = THEME_BAR_ACCENT[theme] ?? THEME_BAR_ACCENT.traditional;
  const catFill = THEME_CAT_FILL[theme] ?? THEME_CAT_FILL.cute;

  const displayText = speechText || text;
  const chars = displayText.split("");
  const durationSeconds = Math.round(durationInFrames / 30);

  return (
    <AbsoluteFill
      style={{
        background: sceneBg,
      }}
    >
      {/* ——— 页码指示 ——— */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 45,
          fontSize: 26,
          color: "rgba(255,255,255,0.5)",
          fontWeight: 400,
          zIndex: 10,
        }}
      >
        {sceneIndex}/{totalScenes}
      </div>

      {/* ——— 语音播放条 ——— */}
      <VoiceBar
        frame={frame}
        durationFrames={durationInFrames}
        durationSeconds={durationSeconds}
        accentColor={barAccent}
      />

      {/* ——— 心形烟花（主） ——— */}
      <HeartFirework
        startFrame={5}
        centerX={540}
        centerY={640}
        scale={20}
        colors={fireworkColors}
      />

      {/* ——— 心形烟花（叠加小一圈，增加层次感） ——— */}
      <HeartFirework
        startFrame={18}
        centerX={540}
        centerY={640}
        scale={15}
        colors={fireworkColors}
      />

      {/* ——— 氛围飘浮粒子 ——— */}
      {Array.from({ length: 18 }, (_, i) => {
        const rand = seededRandom(i + 2000);
        const rand2 = seededRandom(i + 2100);
        const x = rand * 1080;
        const speed = 0.12 + rand2 * 0.22;
        const y = ((frame * speed + i * 110) % 2100) - 100;
        const size = 2 + rand * 3;
        const opacity = 0.06 + rand2 * 0.1;
        const color =
          fireworkColors[
            Math.floor(seededRandom(i + 2200) * fireworkColors.length)
          ];
        return (
          <div
            key={`amb-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity,
              boxShadow: `0 0 ${size * 3}px ${color}30`,
            }}
          />
        );
      })}

      {/* ——— 猫咪剪影 ——— */}
      <div
        style={{
          position: "absolute",
          bottom: 105,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          opacity: interpolate(frame, [10, 30], [0, 0.55], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          zIndex: 5,
        }}
      >
        <CatSilhouette fillColor={catFill} />
        <CatSilhouette flip fillColor={catFill} />
      </div>

      {/* ——— 底部文字区域 ——— */}
      <div
        style={{
          position: "absolute",
          bottom: 170,
          left: 60,
          right: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          zIndex: 10,
        }}
      >
        {/* 收件人引导语 */}
        <div
          style={{
            opacity: interpolate(frame, [8, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [8, 22], [20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <span
            style={{
              fontSize: 40,
              color: textColor,
              fontWeight: 400,
              letterSpacing: 6,
              textShadow: `0 0 20px ${textGlow}`,
            }}
          >
            {text}
          </span>
        </div>

        {/* 语音文字逐字出现 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: speechText ? 2 : 6,
          }}
        >
          {chars.map((char, index) => {
            const charStart = 28 + index * (speechText ? 3 : 8);
            const progress = interpolate(
              frame,
              [charStart, charStart + CHAR_ANIM_DURATION],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.back(1.5)),
              }
            );

            const charOpacity = interpolate(progress, [0, 0.3], [0, 1], {
              extrapolateRight: "clamp",
            });
            const translateY = interpolate(progress, [0, 1], [25, 0], {
              extrapolateRight: "clamp",
            });
            const charScale = interpolate(progress, [0, 1], [0.5, 1], {
              extrapolateRight: "clamp",
            });

            const isPunctuation =
              /[，。！？、；：""''（）,.!?;:()"""''']/.test(char);
            const isSpace = char === " " || char === "\n";

            // 字出现瞬间的光晕
            const glowIntensity = interpolate(
              frame,
              [
                charStart + CHAR_ANIM_DURATION,
                charStart + CHAR_ANIM_DURATION + 12,
              ],
              [20, 8],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={index}
                style={{
                  fontSize: speechText
                    ? isPunctuation
                      ? 44
                      : 52
                    : char === "·"
                    ? 56
                    : 64,
                  fontWeight: isPunctuation ? 400 : 600,
                  color: textColor,
                  opacity: isSpace ? 0 : charOpacity,
                  transform: `translateY(${translateY}px) scale(${charScale})`,
                  textShadow: `0 0 ${glowIntensity}px ${textGlow}, 0 2px 4px rgba(0,0,0,0.5)`,
                  letterSpacing: speechText ? 2 : 4,
                  lineHeight: 1.8,
                  minWidth: isSpace ? "8px" : "auto",
                }}
              >
                {isSpace ? "\u00A0" : char}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
