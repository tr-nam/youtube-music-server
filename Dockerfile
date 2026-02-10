FROM node:20-bookworm-slim

# Cài nsenter để exec ra host
RUN apt-get update && apt-get install -y \
    util-linux \
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài yt-dlp trong container (cho metadata)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
