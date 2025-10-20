# Build stage
FROM node:20 AS build
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi
COPY . .
RUN if [ -f pnpm-lock.yaml ]; then pnpm build; \
    elif [ -f yarn.lock ]; then yarn build; \
    else npm run build; fi

# Run stage
# Use the standard (non-alpine) nginx image to avoid alpine manifest issues on some registries
FROM nginx:1.27
# Install netcat for healthcheck
RUN apk add --no-cache netcat-openbsd curl
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
