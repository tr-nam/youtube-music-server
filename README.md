# 🎵 YouTube Music Server

Self-hosted YouTube music streaming server with queue management, Bluetooth audio output, and web-based remote control. Perfect for playing YouTube music on your home server speakers via phone/tablet/PC.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## ✨ Features

- 🎵 **Queue System** - Add multiple songs and play in order
- 📱 **Remote Control** - Control playback from any device on your network
- 🔊 **Bluetooth Audio** - Connect and manage Bluetooth speakers
- 🎛️ **Full Playback Control** - Play, pause, skip, seek, volume control
- 📊 **Real-time Updates** - WebSocket-based live status updates
- 🎨 **Responsive UI** - Mobile-optimized interface
- ⌨️ **Keyboard Shortcuts** - Space, arrows for quick control
- 🔍 **Bluetooth Scan** - Discover nearby Bluetooth devices
- 🎚️ **Audio Output Selector** - Switch between internal/Bluetooth speakers
- 🔄 **Auto-play Next** - Continuous playback through queue

## 📋 Requirements

### System
- Linux (Ubuntu/Debian recommended)
- Node.js >= 18.0.0
- Network access (for remote control)

### Dependencies
- `mpv` - Media player
- `yt-dlp` - YouTube downloader
- `pulseaudio` - Audio server
- `bluetoothctl` - Bluetooth management
- `socat` - Socket communication (for MPV IPC)

## 🚀 Installation

### 1. Install System Dependencies

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
sudo apt install -y pulseaudio pulseaudio-utils pulseaudio-module-bluetooth

# Install Bluetooth tools
sudo apt install -y bluez bluetooth

# Install utilities
sudo apt install -y socat curl
