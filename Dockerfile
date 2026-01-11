FROM node:20-alpine AS builder
WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# copy and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# copy only runtime artifacts
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","dist/index.js"]
