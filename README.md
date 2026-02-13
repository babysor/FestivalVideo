# 🧧 春节祝福视频批量生成器

一键为多人生成个性化节日祝福视频，支持 AI 语音克隆和智能文案生成。

## ✨ 功能特性

- 🎥 **批量生成**：上传一段示例视频，为多人生成个性化祝福
- 🎙️ **AI 语音克隆**：自动提取声音特征，为每个人生成专属语音
- 🤖 **智能文案**：Gemini AI 根据关系和背景生成个性化祝福语
- 🎨 **主题自适应**：AI 自动选择最匹配的视觉风格
- 🎉 **多节日支持**：春节、情人节等多种节日模板

## 🚀 快速部署

### 前置要求

- Google Cloud Project
- Gemini API Key (从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取)
- (可选) TTS 服务端点

### 部署到 Cloud Run

1. **设置环境变量**

```bash
export GEMINI_API_KEY="your-gemini-api-key"
export TTS_ENDPOINT="http://your-tts-service:6006/tts"  # 可选
```

或者创建 `.env` 文件：

```bash
GEMINI_API_KEY=your-gemini-api-key
TTS_ENDPOINT=http://your-tts-service:6006/tts
GCP_PROJECT_ID=your-project-id
```

2. **执行部署脚本**

```bash
bash deploy.sh
```

3. **配置 DNS**（如使用自定义域名）

在域名提供商处添加 A 记录：

```
类型    名称    值
A       @       216.239.32.21
A       @       216.239.34.21
A       @       216.239.36.21
A       @       216.239.38.21
```

## ⚠️ 重要注意事项

### 单实例部署

本服务使用**内存存储**管理任务状态，必须部署为**单实例**：

```bash
--max-instances=1
```

**原因：** 如果部署多实例，任务创建和状态查询可能被路由到不同实例，导致 404 错误。

详见 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 获取完整故障排查指南。

### 资源配置

推荐配置：

- **内存**：4GB（视频渲染需要较多内存）
- **CPU**：2 核
- **超时**：900s（15分钟，处理长视频或多人批次）
- **并发**：1（每个实例同时处理 1 个请求）

## 🏗️ 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npx tsx server/index.ts
```

访问 http://localhost:3210

### 环境变量

在项目根目录创建 `.env` 文件：

```env
GEMINI_API_KEY=your-api-key
TTS_ENDPOINT=http://localhost:6006/tts  # 可选
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
├── Dockerfile            # 容器镜像
├── deploy.sh             # 部署脚本
└── TROUBLESHOOTING.md    # 故障排查
```

## 🎬 使用流程

1. **上传视频**：录制 3-10 秒的示例祝福语
2. **填写信息**：
   - 发送者名字
   - 收信人列表（名字 + 关系 + 背景）
3. **提交生成**：系统自动为每个人生成专属视频
4. **下载结果**：单独下载或打包下载全部

## 🔧 常用命令

### 查看日志

```bash
gcloud run services logs tail spring-festival-video \
  --project=noiz-430406 \
  --region=asia-southeast1
```

### 更新环境变量

```bash
gcloud run services update spring-festival-video \
  --set-env-vars="GEMINI_API_KEY=new-key"
```

### 查看服务状态

```bash
gcloud run services describe spring-festival-video \
  --project=noiz-430406 \
  --region=asia-southeast1
```

## 🐛 故障排查

遇到问题？查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)：

- ❌ 批量任务状态查询返回 404
- ⏳ 任务在处理过程中丢失
- 🔇 TTS 音频生成失败
- 📦 视频渲染失败

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

## 📝 许可证

MIT

## 🙏 致谢

- [Remotion](https://remotion.dev) - React 视频渲染框架
- [Google Gemini](https://ai.google.dev) - AI 文案生成
- [Express](https://expressjs.com) - Web 服务器
- [Cloud Run](https://cloud.google.com/run) - 无服务器部署
