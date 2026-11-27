# BE 컨테이너. Railway·Fly·Render·EC2 어디든 이걸로 뜬다.
# 모노레포 루트에서 빌드한다:
#   docker build -f apps/api/Dockerfile -t ncareers-api .
#   docker run -p 4000:4000 -e DATABASE_URL=... -e ADMIN_API_TOKEN=... ncareers-api
#
# 워커는 같은 이미지에 명령만 바꿔 띄운다:
#   docker run ncareers-api npm run worker --workspace @ncareers/api
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace @ncareers/api --include-workspace-root --omit=dev

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# 파일 모드로 떨어졌을 때 쓸 자리. 운영에서는 DATABASE_URL 을 넣는 쪽이 맞다.
RUN mkdir -p apps/api/data && chown -R app:app apps/api/data
USER app
EXPOSE 4000
# TS 를 그대로 실행한다 (tsx). 빌드 산출물을 따로 두지 않아 배포가 단순하다.
CMD ["npm", "run", "start", "--workspace", "@ncareers/api"]
