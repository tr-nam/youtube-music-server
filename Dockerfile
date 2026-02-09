FROM node:20-bookworm-slim

# Cài đặt các thư viện (bookworm có Python 3.11 mặc định)
RUN apt-get update && apt-get install -y \
    mpv \
    python3 \
    python3-pip \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Tải yt-dlp mới nhất
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
