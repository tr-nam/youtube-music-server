#!/usr/bin/env bash

# --- 1. Tự động lấy đường dẫn hiện tại (Dù bạn để folder ở đâu cũng chạy được) ---
# Lệnh này giúp script biết nó đang nằm ở đâu
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR" || exit

echo "📂 Đang chay tai thu muc: $PROJECT_DIR"

# --- 2. Phát hiện xem đang chạy trên Android (Termux) hay Linux Server ---
if [ -n "$TERMUX_VERSION" ]; then
    OS_TYPE="Android/Termux"
    echo "📱 Phat hien moi truong: ANDROID (Termux)"
    
    # --- Cấu hình riêng cho Termux ---
    export XDG_RUNTIME_DIR=${TMPDIR}
    export PULSE_SERVER=127.0.0.1
    
    # Kiểm tra và bật PulseAudio (Chế độ TCP cho Android)
    if ! pulseaudio --check; then
        echo "🔊 Đang khoi dong PulseAudio (Android Mode)..."
        pulseaudio --start --load="module-native-protocol-tcp auth-ip-acl=127.0.0.1 auth-anonymous=1" --exit-idle-time=-1
        sleep 2
    fi
    
else
    OS_TYPE="Linux/Standard"
    echo "🐧 Phat hien moi truong: LINUX SERVER"
    
    # --- Cấu hình riêng cho Linux Server ---
    # Trên VPS Linux thường không cần PulseAudio trừ khi bạn cài desktop environment
    # Nếu cần, nó sẽ dùng socket mặc định, không cần ép IP 127.0.0.1
    
    # Kiểm tra PulseAudio (nếu có cài)
    if command -v pulseaudio &> /dev/null; then
        if ! pulseaudio --check; then
            echo "🔊 Đang khoi dong PulseAudio (Linux Mode)..."
            pulseaudio --start --daemonize
        fi
    else
        echo "⚠️ Khong tim thay PulseAudio (Khong sao neu day la VPS khong co loa)"
    fi
fi

# --- 3. Chạy Server Node.js ---
echo "🚀 Đang khoi dong YouTube Music Server..."

# Kiểm tra xem có file ecosystem.config.js không để chạy PM2
if [ -f "ecosystem.config.js" ] && command -v pm2 &> /dev/null; then
    echo "✅ Phat hien PM2. Dang chay che do Production..."
    pm2 start ecosystem.config.js --env production
    pm2 save
else
    # Nếu không có PM2 thì chạy Node thường
    echo "✅ Chay che do thuong (node index.js)..."
    node index.js
fi
