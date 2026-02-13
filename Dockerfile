FROM node:20-bookworm-slim

# ── 系统依赖：Chromium (Remotion 渲染) + ffmpeg + 中文字体 ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# 让 Remotion 使用系统 Chromium，跳过内置下载
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium

WORKDIR /app

# 先复制依赖清单，利用 Docker 缓存
COPY package.json package-lock.json ./
RUN npm ci

# 复制项目源码
COPY . .

# 确保运行时目录存在
RUN mkdir -p out public/uploads tmp

EXPOSE 3210

CMD ["npx", "tsx", "server/index.ts"]
