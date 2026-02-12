#!/bin/bash

# Ensure PulseAudio is running
echo "Checking PulseAudio..."
if ! pulseaudio --check 2>/dev/null; then
    echo "Starting PulseAudio..."
    pulseaudio --start --daemonize
    sleep 3
fi

# Verify PulseAudio is running
if pulseaudio --check 2>/dev/null; then
    echo "PulseAudio is running ✓"
else
    echo "Warning: PulseAudio failed to start"
fi

# Set environment variables
export XDG_RUNTIME_DIR=/run/user/1000
export PULSE_SERVER=unix:/run/user/1000/pulse/native
export PULSE_RUNTIME_PATH=/run/user/1000/pulse
export HOME=/home/home-server
export USER=home-server

# Start Node.js server
echo "Starting YouTube Music Server..."
node index.js
