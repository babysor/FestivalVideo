# 🧧 春节祝福视频批量生成器

一键为多人生成个性化节日祝福视频，支持 AI 语音克隆和智能文案生成。

## ✨ 功能特性

- 🎥 **批量生成**：上传一段示例视频，为多人生成个性化祝福
- 🎙️ **AI 语音克隆**：自动提取声音特征，为每个人生成专属语音
- 🤖 **智能文案**：Gemini AI 根据关系和背景生成个性化祝福语
- 🎨 **主题自适应**：AI 自动选择最匹配的视觉风格
- 🎉 **多节日支持**：情人节等多种节日模板

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Gemini API Key (从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取)
- (可选) TTS 服务端点

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
GEMINI_API_KEY=your-api-key
TTS_ENDPOINT=http://localhost:6006/tts  # 可选
```

### 启动服务

```bash
npx tsx server/index.ts
```

访问 http://localhost:3210

## 🎬 使用流程

1. **上传视频**：录制 3-10 秒的示例祝福语
2. **填写信息**：
   - 发送者名字
   - 收信人列表（名字 + 关系 + 背景）
3. **提交生成**：系统自动为每个人生成专属视频
4. **下载结果**：单独下载或打包下载全部

## 使用 Docker（可选）

如果你想使用 Docker 运行，可以参考项目中的 `Dockerfile`：

```bash
# 构建镜像
docker build -t spring-festival-video .

# 运行容器
docker run -p 3210:3210 \
  -e GEMINI_API_KEY=your-api-key \
  spring-festival-video
```

## 📁 项目结构

```
.
├── server/
│   ├── index.ts          # Express 服务器 + 批量渲染逻辑
│   ├── narration.ts      # AI 文案生成
│   ├── tts.ts            # TTS 语音克隆
│   └── public/           # 静态前端页面
│       └── index.html
├── src/
│   ├── Root.tsx          # Remotion 根组件
│   ├── SpringFestivalVideo.tsx  # 主视频组件
│   ├── themes.ts         # 视觉主题配置
│   └── components/       # UI 组件
├── public/               # 静态资源
│   └── uploads/          # 上传的视频
├── out/                  # 渲染输出
├── tmp/                  # 临时文件
└── Dockerfile            # Docker 镜像配置
```

## 🎨 自定义主题

在 `src/themes.ts` 中添加新主题：

```typescript
export const themes: Record<ThemeType, Theme> = {
  yourTheme: {
    name: "你的主题",
    primaryColor: "#ff0000",
    secondaryColor: "#00ff00",
    // ...
  },
};
```

## 🙏 致谢

- [Remotion](https://remotion.dev) - React 视频渲染框架
- [Google Gemini](https://ai.google.dev) - AI 文案生成