FROM node:20-bookworm-slim

# Cài đặt dependencies
RUN apt-get update && apt-get install -y \
    mpv \
    pulseaudio \
    pulseaudio-utils \
    alsa-utils \
    python3 \
    curl \
    ffmpeg \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Cài yt-dlp mới nhất
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Config PulseAudio cho container
RUN mkdir -p /root/.config/pulse && \
    echo "autospawn = no" > /root/.config/pulse/client.conf && \
    echo "daemon-binary = /bin/true" >> /root/.config/pulse/client.conf

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
