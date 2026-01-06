# ===== 阶段1: 构建前端 =====
FROM node:20-alpine AS frontend-builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（需要 devDependencies 来构建）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建前端
RUN pnpm run build

# ===== 阶段2: 构建后端 =====
FROM node:20-alpine AS backend-builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/servers

# 复制 servers 目录
COPY servers/ ./

# 安装依赖并编译
RUN pnpm install
RUN pnpm run build

# ===== 阶段3: 生产环境 =====
FROM node:20-alpine AS production

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制后端 package.json 并安装生产依赖
COPY servers/package.json ./servers/
RUN cd servers && pnpm install --prod

# 复制构建产物
COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-builder /app/servers/*.js ./servers/
COPY --from=backend-builder /app/servers/routes/*.js ./servers/routes/
COPY --from=backend-builder /app/servers/shared/*.js ./servers/shared/

# 暴露端口
EXPOSE 8787

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/api/health || exit 1

# 启动服务
CMD ["node", "servers/index.js"]
