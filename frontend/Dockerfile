FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/out ./
EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]
