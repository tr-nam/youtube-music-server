# Dùng bản slim của Debian để dễ cài mpv
FROM node:18-bullseye-slim

# Cài đặt các thư viện cần thiết cho hệ thống
RUN apt-get update && apt-get install -y \
    mpv \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tải yt-dlp mới nhất trực tiếp từ GitHub (vì bản apt-get thường cũ)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy file package và cài đặt dependencies node
COPY package.json ./
RUN npm install

# Copy toàn bộ code
COPY . .

# Mở port 3000
EXPOSE 3000

# Chạy server
CMD ["node", "index.js"]
