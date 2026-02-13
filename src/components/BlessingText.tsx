import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { getTheme, getFestival, type ThemeType, type FestivalType } from "../themes";

// Scene 3: 祝福文本 (10-15秒)
// 优雅的祝福语逐行出现，配以春节装饰

// blessings 现在通过 props 传入

// 装饰性边框
const DecorativeBorder: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: 100,
        right: 100,
        bottom: 350,
        border: "2px solid transparent",
        borderImage: `linear-gradient(135deg, #ffd700 ${progress * 100}%, transparent ${progress * 100}%) 1`,
        opacity: interpolate(frame, [5, 30], [0, 0.5], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      {/* 四角装饰 */}
      {[
        { top: -15, left: -15 },
        { top: -15, right: -15 },
        { bottom: -15, left: -15 },
        { bottom: -15, right: -15 },
      ].map((pos, i) => {
        const cornerOpacity = interpolate(
          frame,
          [10 + i * 8, 25 + i * 8],
          [0, 0.8],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: 30,
              height: 30,
              opacity: cornerOpacity,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 30 30">
              <path
                d="M15,2 L18,10 L26,10 L20,16 L22,24 L15,19 L8,24 L10,16 L4,10 L12,10Z"
                fill="#ffd700"
                opacity="0.8"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

// 飘散的梅花瓣
const PlumBlossoms: React.FC = () => {
  const frame = useCurrentFrame();

  const petals = Array.from({ length: 15 }, (_, i) => {
    const startX = (i * 73) % 100;
    const speed = 0.2 + (i % 4) * 0.1;
    const y = ((frame * speed + i * 80) % 130) - 15;
    const x = startX + Math.sin((frame + i * 20) * 0.03) * 8;
    const rotation = frame * (0.3 + (i % 3) * 0.2) + i * 30;
    const size = 10 + (i % 3) * 6;
    const opacity = interpolate(y, [-15, 10, 100, 120], [0, 0.4, 0.4, 0], {
      extrapolateRight: "clamp",
    });

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          transform: `rotate(${rotation}deg)`,
          opacity,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="3.5" fill={i % 2 === 0 ? "#ff8899" : "#ffaabb"} />
          <circle cx="16" cy="9" r="3.5" fill={i % 2 === 0 ? "#ff8899" : "#ffaabb"} />
          <circle cx="13" cy="16" r="3.5" fill={i % 2 === 0 ? "#ff8899" : "#ffaabb"} />
          <circle cx="7" cy="16" r="3.5" fill={i % 2 === 0 ? "#ff8899" : "#ffaabb"} />
          <circle cx="4" cy="9" r="3.5" fill={i % 2 === 0 ? "#ff8899" : "#ffaabb"} />
          <circle cx="10" cy="10" r="2.5" fill="#ffdd00" />
        </svg>
      </div>
    );
  });

  return <AbsoluteFill>{petals}</AbsoluteFill>;
};

// 红色印章
const Stamp: React.FC<{ text?: string }> = ({ text = "吉" }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [80, 95], [2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const opacity = interpolate(frame, [80, 90], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rotation = interpolate(frame, [80, 95], [15, -5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 380,
        right: 180,
        opacity,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
      }}
    >
      <div
        style={{
          width: 90,
          height: 90,
          border: "3px solid #ff3333",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <span
          style={{
            fontSize: 42,
            color: "#ff3333",
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

export const BlessingText: React.FC<{
  senderName: string;
  recipientName: string;
  blessings: string[];
  durationInFrames?: number;
  theme?: ThemeType;
  festival?: FestivalType;
}> = ({ senderName, recipientName, blessings, durationInFrames = 180, theme = "traditional", festival = "spring" }) => {
  const frame = useCurrentFrame();
  const themeConfig = getTheme(theme);
  const { colors } = themeConfig;
  const festivalConfig = getFestival(festival);

  // 根据祝福语数量和 scene 时长，动态调整排版
  const count = blessings.length;
  const gap = count <= 4 ? 40 : count <= 5 ? 32 : 24;
  const baseFontSize = count <= 4 ? 64 : count <= 5 ? 56 : 48;
  const lastFontSize = count <= 4 ? 72 : count <= 5 ? 64 : 56;

  // 动态计算每行动画延迟，均匀分布在前 60% 的时间内
  const animWindow = Math.min(durationInFrames * 0.5, 150); // 前半段用于逐行出现
  const lineInterval = count > 1 ? animWindow / count : 20;

  // 署名出现时机：所有祝福语出现后
  const signatureStartFrame = Math.round(animWindow + 20);

  // 人名固定显示动画
  const nameOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const nameScale = interpolate(frame, [5, 20], [0.7, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.3)),
  });
  const nameGlow = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [20, 35],
  );

  // 主题色系
  const primaryColor = colors.primary;
  const textColor = colors.text;
  const textSecondaryColor = colors.textSecondary;
  const glowColor = colors.glowColor;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 梅花瓣 */}
      <PlumBlossoms />

      {/* 装饰边框 */}
      <DecorativeBorder />

      {/* 人名 - 固定在顶部 */}
      <div
        style={{
          position: "absolute",
          top: 150,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity: nameOpacity,
          transform: `scale(${nameScale})`,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: primaryColor,
            letterSpacing: 20,
            textShadow: `0 0 ${nameGlow}px ${glowColor}, 0 0 ${nameGlow * 2}px ${glowColor}50, 0 2px 8px rgba(0,0,0,0.5)`,
            padding: "16px 50px",
            borderRadius: "16px",
            background: "rgba(20, 20, 20, 0.25)",
            border: `2px solid ${primaryColor}66`,
          }}
        >
          {recipientName}
        </div>
        <div
          style={{
            width: 180,
            height: 2,
            background: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
            opacity: 0.8,
          }}
        />
      </div>

      {/* 祝福台词 - 逐行出现 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap,
          zIndex: 1,
          padding: "0 60px",
          marginTop: 180,
        }}
      >
        {blessings.map((line, i) => {
          const lineDelay = Math.round(10 + i * lineInterval);
          const opacity = interpolate(
            frame,
            [lineDelay, lineDelay + 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const translateY = interpolate(
            frame,
            [lineDelay, lineDelay + 18],
            [40, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }
          );
          const scale = interpolate(
            frame,
            [lineDelay, lineDelay + 18],
            [0.85, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }
          );

          const isTitle = i === 0;
          const isLast = i === blessings.length - 1;

          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: isTitle ? 48 : isLast ? lastFontSize : baseFontSize,
                  fontWeight: isTitle ? 300 : 900,
                  color: isLast ? textSecondaryColor : textColor,
                  letterSpacing: isTitle ? 16 : 12,
                  textShadow: isLast
                    ? `0 0 30px ${glowColor}60, 0 0 60px ${glowColor}30`
                    : "0 0 20px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
                  lineHeight: 1.2,
                }}
              >
                {line}
              </span>
              {isTitle && (
                <div
                  style={{
                    width: 120,
                    height: 2,
                    background: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
                    margin: "20px auto 0",
                    opacity: interpolate(
                      frame,
                      [lineDelay + 15, lineDelay + 30],
                      [0, 0.6],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }
                    ),
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 红色印章 */}
      <Stamp text={festivalConfig.stampText} />

      {/* 底部署名 - 来自发送者 */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          opacity: interpolate(
            frame,
            [signatureStartFrame, signatureStartFrame + 25],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          ),
        }}
      >
        <div
          style={{
            width: 320,
            height: 2,
            background: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
            opacity: 0.6,
          }}
        />
        <div
          style={{
            fontSize: 32,
            color: textColor,
            letterSpacing: 10,
            fontWeight: 300,
            opacity: 0.8,
          }}
        >
          来自
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: primaryColor,
            letterSpacing: 12,
            textShadow: `0 0 25px ${glowColor}60, 0 0 50px ${glowColor}30, 0 2px 8px rgba(0,0,0,0.4)`,
            transform: `scale(${interpolate(
              frame,
              [signatureStartFrame + 10, signatureStartFrame + 30],
              [0.7, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.back(1.5)),
              }
            )})`,
          }}
        >
          {senderName}
        </div>
        <div
          style={{
            fontSize: 28,
            color: primaryColor,
            letterSpacing: 8,
            fontWeight: 300,
            opacity: 0.7,
            marginTop: 8,
          }}
        >
          {festivalConfig.footerText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
