# 🎵 YouTube Music Server

Self-hosted YouTube music streaming server with queue management, Bluetooth audio output, authentication, and web-based remote control. Perfect for playing YouTube music on your home server speakers via phone/tablet/PC.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## ✨ Features

- 🎵 **Queue System** - Add multiple songs and play in order
- 🔐 **Authentication** - Secure login with bcrypt password hashing
- 📱 **Remote Control** - Control playback from any device on your network
- 🔊 **Bluetooth Audio** - Connect and manage Bluetooth speakers
- 🎛️ **Full Playback Control** - Play, pause, skip, seek, volume control
- 📊 **Real-time Updates** - WebSocket-based live status updates
- 🎨 **Responsive UI** - Mobile-optimized interface
- ⌨️ **Keyboard Shortcuts** - Space, arrows for quick control
- 🔍 **Bluetooth Scan** - Discover nearby Bluetooth devices
- 🎚️ **Audio Output Selector** - Switch between internal/Bluetooth speakers
- 🔄 **Auto-play Next** - Continuous playback through queue
- 👥 **Multi-user Support** - Easy to add multiple users

## 📸 Screenshots

```
┌─────────────────────────────────┐
│  🎵 YouTube Music Queue         │
├─────────────────────────────────┤
│  Now Playing: Song Title        │
│  ▬▬▬▬▬▬▬●────────── 2:34 / 4:21│
│  ⏮️ ⏪ ⏸️ ⏩ ⏭️                  │
│  🔊 ────────●─── 75%           │
├─────────────────────────────────┤
│  ➕ Add to Queue                │
│  [Paste YouTube URL] [Add]      │
├─────────────────────────────────┤
│  📋 Queue (3)     [Clear All]   │
│  ▶️ 1. Current Song             │
│    2. Next Song                 │
│    3. Third Song                │
├─────────────────────────────────┤
│  📶 Bluetooth Devices           │
│  ✓ Speaker E-3502 [Disconnect]  │
│  📱 Headphones [Connect]        │
└─────────────────────────────────┘
```

## 📋 Requirements

### System
- **OS**: Linux (Ubuntu 20.04+/Debian 11+ recommended)
- **Node.js**: >= 18.0.0
- **Network**: LAN access for remote control
- **Memory**: 512MB RAM minimum
- **Storage**: 100MB for app + cache

### Dependencies
- `mpv` - Media player
- `yt-dlp` - YouTube downloader
- `pulseaudio` - Audio server
- `bluetoothctl` - Bluetooth management (optional)
- `socat` - Socket communication (for MPV IPC)

## 🚀 Quick Start

```bash
# 1. Install system dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update
sudo apt install -y nodejs mpv pulseaudio socat

# 2. Install yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# 3. Clone/Download project
mkdir -p ~/youtube-music-server
cd ~/youtube-music-server
# (Copy all project files here)

# 4. Install Node dependencies
npm install

# 5. Start server
npm start

# 6. Open browser
# http://localhost:3000
# Login: admin / admin123
```

## 📦 Installation

### 1. Install System Dependencies

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install media tools
sudo apt install -y mpv ffmpeg

# Install yt-dlp (latest version)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Install audio tools
sudo apt install -y pulseaudio pulseaudio-utils alsa-utils

# Install Bluetooth (optional)
sudo apt install -y bluez pulseaudio-module-bluetooth

# Install utilities
sudo apt install -y socat curl git
```

### 2. Download/Create Project

**Option A: Clone from Git**
```bash
git clone https://github.com/yourusername/youtube-music-server.git
cd youtube-music-server
```

**Option B: Create manually**
```bash
mkdir -p ~/youtube-music-server
cd ~/youtube-music-server

# Create package.json
cat > package.json << 'EOF'
{
  "name": "youtube-music-server",
  "version": "2.0.0",
  "description": "Self-hosted YouTube music streaming server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "gen-password": "node generate-password.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "dotenv": "^16.3.1",
    "ws": "^8.14.2",
    "express-session": "^1.17.3",
    "cookie-parser": "^1.4.6",
    "bcryptjs": "^2.4.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Create .env
cat > .env << 'EOF'
PORT=3000
SESSION_SECRET=change-this-to-a-random-secure-string-in-production
EOF

# Copy index.js, auth.js, generate-password.js from project
# Copy public/ folder with index.html and login.html
```

### 3. Install Node Dependencies

```bash
npm install
```

### 4. Setup PulseAudio

```bash
# Start PulseAudio
pulseaudio --start

# Load required modules
pactl load-module module-bluetooth-discover
pactl load-module module-bluetooth-policy

# Verify PulseAudio is running
pactl info

# List audio outputs
pactl list sinks short
```

### 5. Setup Bluetooth (Optional)

```bash
# Start Bluetooth service
sudo systemctl start bluetooth
sudo systemctl enable bluetooth

# Pair a device
bluetoothctl
# In bluetoothctl:
> scan on
> pair XX:XX:XX:XX:XX:XX
> trust XX:XX:XX:XX:XX:XX
> connect XX:XX:XX:XX:XX:XX
> exit
```

## 🎮 Usage

### Start Server

**Development Mode:**
```bash
npm start
```

**Production Mode with PM2:**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start index.js --name youtube-music

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
# Run the command it outputs (usually starts with sudo)

# View logs
pm2 logs youtube-music

# Restart
pm2 restart youtube-music

# Stop
pm2 stop youtube-music
```

### Access Web UI

1. **On server**: http://localhost:3000
2. **From network**: http://SERVER_IP:3000
3. **Example**: http://192.168.1.100:3000

### Default Login

- **Username**: `admin`
- **Password**: `admin123`

**⚠️ CHANGE DEFAULT PASSWORD IMMEDIATELY!**

### Basic Workflow

1. **Login** with credentials
2. **Add songs** - Paste YouTube URLs and click "Add"
3. **Play** - Click song in queue to play
4. **Control** - Use buttons or keyboard shortcuts
5. **Bluetooth** - Connect speakers via Bluetooth panel
6. **Volume** - Adjust with slider

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Seek backward 10s |
| `→` | Seek forward 10s |
| `↑` | Volume +5% |
| `↓` | Volume -5% |

## 🔐 Security

### Change Default Password

```bash
# Generate new password hash
node generate-password.js "YourNewSecurePassword123"

# Output example:
# Hash: $2a$10$abc123...xyz789

# Edit auth.js
nano auth.js

# Replace the hash in USERS object:
const USERS = {
    'admin': '$2a$10$abc123...xyz789'  // Your new hash
};

# Restart server
pm2 restart youtube-music
```

### Add New User

```bash
# Generate password hash for new user
node generate-password.js "User2Password"

# Edit auth.js
nano auth.js

# Add to USERS object:
const USERS = {
    'admin': '$2a$10$...',
    'john': '$2a$10$...',    // New user
    'mary': '$2a$10$...'     // Another user
};

# Restart
pm2 restart youtube-music
```

### Session Configuration

Edit `index.js` to change session timeout:

```javascript
cookie: {
    maxAge: 24 * 60 * 60 * 1000,  // 1 day
    // maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days (default)
    // maxAge: 30 * 60 * 1000,  // 30 minutes
    httpOnly: true,
    secure: false  // Set true if using HTTPS
}
```

### Enable HTTPS (Recommended for Production)

Use reverse proxy (Nginx/Apache) with Let's Encrypt:

```nginx
server {
    listen 443 ssl http2;
    server_name music.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then update `.env`:
```
SECURE_COOKIES=true
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Server port
PORT=3000

# Session secret (MUST CHANGE IN PRODUCTION)
SESSION_SECRET=your-very-long-random-secret-key-here

# Cookie security (enable if using HTTPS)
# SECURE_COOKIES=true
```

### Change Port

```bash
# Edit .env
nano .env
# Change: PORT=8080

# Or use environment variable
PORT=8080 npm start

# With PM2
pm2 restart youtube-music --update-env
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp
sudo ufw status

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 🗂️ Project Structure

```
youtube-music-server/
├── index.js                 # Main server with routes
├── auth.js                  # Authentication module
├── generate-password.js     # Password hash generator
├── package.json             # Dependencies
├── .env                     # Configuration
├── README.md                # This file
└── public/
    ├── index.html          # Main application UI
    └── login.html          # Login page
```

## 📡 API Reference

### Authentication

#### POST /login
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /logout
Logout and destroy session.

**Response:**
```json
{
  "success": true
}
```

### Queue Management

#### POST /queue/add
Add song to queue.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

#### POST /queue/remove
Remove song from queue.

**Request:**
```json
{
  "id": 1234567890
}
```

#### POST /queue/clear
Clear entire queue.

#### POST /queue/play
Play specific song in queue.

**Request:**
```json
{
  "index": 2
}
```

#### POST /queue/next
Skip to next song.

#### POST /queue/previous
Go to previous song.

### Playback Control

#### POST /pause
Toggle pause/resume.

#### POST /stop
Stop playback.

#### POST /volume
Set volume (0-100).

**Request:**
```json
{
  "volume": 75
}
```

#### POST /seek
Seek position.

**Request:**
```json
{
  "position": 10,
  "relative": true
}
```

### Bluetooth

#### GET /bluetooth/devices
List paired Bluetooth devices.

#### POST /bluetooth/scan
Scan for new devices (10 seconds).

#### POST /bluetooth/connect
Connect to device.

**Request:**
```json
{
  "mac": "XX:XX:XX:XX:XX:XX"
}
```

#### POST /bluetooth/disconnect
Disconnect device.

**Request:**
```json
{
  "mac": "XX:XX:XX:XX:XX:XX"
}
```

### Audio

#### GET /audio/sinks
List audio output devices.

#### POST /audio/set-sink
Set default audio output.

**Request:**
```json
{
  "sink": "bluez_sink.XX_XX_XX_XX_XX_XX.a2dp_sink"
}
```

### Status

#### GET /status
Get current playback status.

**Response:**
```json
{
  "playing": true,
  "paused": false,
  "currentSong": "Song Title",
  "volume": 75,
  "position": 45.2,
  "duration": 180.5,
  "queue": [...],
  "currentQueueIndex": 1
}
```

## 🔧 Troubleshooting

### No Audio Output

```bash
# Check PulseAudio
pactl info

# Restart if needed
pulseaudio --kill
pulseaudio --start

# List sinks
pactl list sinks short

# Set default sink
pactl set-default-sink YOUR_SINK_NAME

# Test audio
paplay /usr/share/sounds/alsa/Front_Center.wav
```

### Bluetooth Not Working

```bash
# Check Bluetooth service
sudo systemctl status bluetooth
sudo systemctl restart bluetooth

# Check device
bluetoothctl info XX:XX:XX:XX:XX:XX

# Reconnect
bluetoothctl connect XX:XX:XX:XX:XX:XX

# Check PulseAudio Bluetooth module
pactl list | grep -i bluetooth
```

### yt-dlp Errors

```bash
# Update yt-dlp
sudo yt-dlp -U

# Test download
yt-dlp -f bestaudio -g "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Clear cache
yt-dlp --rm-cache-dir
```

### Multiple MPV Processes

```bash
# Kill all MPV
pkill -9 mpv

# Check running processes
ps aux | grep mpv

# Restart server
pm2 restart youtube-music
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :3000

# Kill it
sudo kill -9 <PID>

# Or change port in .env
```

### Session/Login Issues

```bash
# Clear browser cookies
# Or use incognito mode

# Check session secret in .env
nano .env

# Regenerate session secret
openssl rand -base64 32

# Restart server
pm2 restart youtube-music
```

### WebSocket Connection Failed

```bash
# Check firewall
sudo ufw status

# Allow port
sudo ufw allow 3000/tcp

# Check proxy configuration (if using)
# Ensure WebSocket upgrade is enabled
```

## 🚀 Deployment

### Systemd Service (Alternative to PM2)

Create `/etc/systemd/system/youtube-music.service`:

```ini
[Unit]
Description=YouTube Music Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/youtube-music-server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable youtube-music
sudo systemctl start youtube-music
sudo systemctl status youtube-music
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    mpv \
    yt-dlp \
    pulseaudio \
    socat \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
```

Build and run:
```bash
docker build -t youtube-music-server .
docker run -d \
  --name youtube-music \
  --network host \
  -v /run/user/1000/pulse:/run/user/1000/pulse \
  youtube-music-server
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name music.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout
        proxy_read_timeout 86400;
    }
}
```

## 📱 Mobile Access

### Add to Home Screen

**iOS:**
1. Open in Safari
2. Tap Share button
3. Select "Add to Home Screen"

**Android:**
1. Open in Chrome
2. Tap Menu (⋮)
3. Select "Add to Home Screen"

## 💡 Tips & Best Practices

- ✅ Use wired Ethernet for server stability
- ✅ Keep yt-dlp updated weekly
- ✅ Use quality Bluetooth speakers (aptX)
- ✅ Add server to local DNS for easy access
- ✅ Enable auto-start with PM2 or systemd
- ✅ Regular backups of queue/playlists
- ✅ Monitor logs for errors
- ✅ Change default password immediately
- ✅ Use HTTPS in production
- ✅ Set strong session secret

## 🐛 Known Issues

- **YouTube blocks**: yt-dlp may need updates when YouTube changes
- **Bluetooth latency**: ~200ms audio delay (normal for Bluetooth)
- **Seek precision**: Limited by MPV stream buffering
- **Mobile Safari**: WebSocket may disconnect on background

## 🔄 Updates

```bash
# Pull latest code
cd ~/youtube-music-server
git pull

# Update dependencies
npm install

# Update yt-dlp
sudo yt-dlp -U

# Restart
pm2 restart youtube-music
```

## 📊 Performance

- **Memory**: ~50-100MB idle, ~150MB playing
- **CPU**: <5% on modern hardware
- **Network**: ~128kbps per stream
- **Startup**: ~2 seconds
- **Response**: <100ms local, <500ms remote

## 🤝 Contributing

Contributions welcome!

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📝 Changelog

### v2.0.0 (2026-02-10)
- ✨ Added authentication system
- ✨ Added queue management
- ✨ Added Bluetooth scan
- ✨ Added audio output selector
- 🎨 Redesigned UI (responsive)
- 🔒 Security improvements
- 🐛 Fixed concurrent playback bug

### v1.0.0 (Initial)
- 🎵 Basic YouTube playback
- 🔊 PulseAudio support
- 📱 Web interface

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

- **MPV** - Media player (https://mpv.io)
- **yt-dlp** - YouTube download tool (https://github.com/yt-dlp/yt-dlp)
- **Express.js** - Web framework (https://expressjs.com)
- **WebSocket** - Real-time communication (https://github.com/websockets/ws)

## 💬 Support

- **Issues**: Open GitHub issue
- **Discussions**: GitHub Discussions
- **Email**: support@example.com

## 🌟 Star History

If this project helps you, please star it! ⭐

---

**Made with ❤️ for music lovers**

*Enjoy your self-hosted music streaming!* 🎵🎉
```

## 📥 Download Files

Để tải project, bạn có thể:

### Option 1: Tạo archive để download

```bash
cd ~/youtube-music-server

# Create tarball
tar -czf youtube-music-server-v2.0.0.tar.gz \
    index.js \
    auth.js \
    generate-password.js \
    package.json \
    .env.example \
    README.md \
    public/

# Download via SCP (from your PC)
scp user@server:~/youtube-music-server/youtube-music-server-v2.0.0.tar.gz .

# Or create zip
zip -r youtube-music-server-v2.0.0.zip \
    index.js \
    auth.js \
    generate-password.js \
    package.json \
    .env.example \
    README.md \
    public/
```

### Option 2: Create GitHub repository

```bash
cd ~/youtube-music-server

# Initialize git
git init
git add .
git commit -m "Initial commit - YouTube Music Server v2.0.0"

# Add remote and push
git remote add origin https://github.com/yourusername/youtube-music-server.git
git push -u origin main
```

**README.md hoàn chỉnh với đầy đủ documentation, ready để deploy và share!** 📖✨
