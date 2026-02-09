FROM node:18-bullseye-slim

# Cài đặt các thư viện cần thiết
RUN apt-get update && apt-get install -y \
    mpv \
    python3 \
    curl \
    ffmpeg \ 
    && rm -rf /var/lib/apt/lists/*
# Lưu ý: Nên cài thêm ffmpeg để hỗ trợ tốt hơn việc xử lý stream

# Tải yt-dlp mới nhất
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp
RUN ln -s /usr/local/bin/yt-dlp /usr/local/bin/youtube-dl

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
