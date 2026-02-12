#!/bin/bash

# Get current user info
CURRENT_USER=${USER:-$(whoami)}
CURRENT_UID=$(id -u)
CURRENT_HOME=${HOME:-$(eval echo ~$CURRENT_USER)}

echo "=== YouTube Music Server Startup ==="
echo "User: $CURRENT_USER (UID: $CURRENT_UID)"
echo "Home: $CURRENT_HOME"

# Ensure PulseAudio is running
echo "Checking PulseAudio..."
if ! pulseaudio --check 2>/dev/null; then
    echo "Starting PulseAudio..."
    pulseaudio --start --daemonize 2>/dev/null
    sleep 3
fi

# Verify PulseAudio is running
if pulseaudio --check 2>/dev/null; then
    echo "PulseAudio is running ✓"
    
    # Show audio output info
    DEFAULT_SINK=$(pactl info 2>/dev/null | grep "Default Sink" | cut -d: -f2 | xargs)
    if [ ! -z "$DEFAULT_SINK" ]; then
        echo "Audio output: $DEFAULT_SINK"
    fi
else
    echo "Warning: PulseAudio failed to start"
    echo "Audio may not work properly"
fi

# Set environment variables dynamically
export XDG_RUNTIME_DIR="/run/user/${CURRENT_UID}"
export PULSE_SERVER="unix:/run/user/${CURRENT_UID}/pulse/native"
export PULSE_RUNTIME_PATH="/run/user/${CURRENT_UID}/pulse"
export HOME="$CURRENT_HOME"
export USER="$CURRENT_USER"

echo "Environment configured for user: $CURRENT_USER"

# Detect Node.js binary
NODE_BIN=$(command -v node || command -v nodejs)
if [ -z "$NODE_BIN" ]; then
    echo "ERROR: Node.js not found in PATH"
    exit 1
fi

echo "Node.js: $NODE_BIN"
echo "Starting YouTube Music Server..."
echo "========================================"

# Start Node.js server
exec "$NODE_BIN" index.js
