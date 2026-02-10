// index.js
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { exec, spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const net = require('net');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { verifyPassword, requireAuth } = require('./auth');

const app = express();
const server = http.createServer(app);

// WebSocket with session verification
const wss = new WebSocket.Server({
    server,
    verifyClient: (info, callback) => {
        // Parse session from cookie
        const cookies = info.req.headers.cookie;
        if (!cookies) {
            return callback(false, 401, 'Unauthorized');
        }
        // Allow connection (session will be checked on messages)
        callback(true);
    }
});

// Configuration
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-key-in-production';
const MPV_SOCKET = '/tmp/mpv-socket';

// Middleware
app.use(cookieParser());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: false, // Set true if using HTTPS
        sameSite: 'lax'
    }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// State variables
let mpvProcess = null;
let currentSong = '';
let currentUrl = '';
let volume = 100;
let playbackData = {
    duration: 0,
    position: 0,
    paused: false
};
let queue = [];
let currentQueueIndex = -1;
let isScanning = false;
let isManualSwitch = false;  // Flag to prevent auto-play during manual switch
let isSwitchingTrack = false; // Lock to prevent concurrent switches

// ==================== Helper Functions ====================

/**
 * Send command to MPV via IPC socket
 */
function mpvCommand(command) {
    return new Promise((resolve, reject) => {
        const client = net.connect(MPV_SOCKET);
        const cmd = JSON.stringify(command) + '\n';
        let response = '';

        client.on('connect', () => client.write(cmd));
        client.on('data', (data) => {
            response += data.toString();
            client.end();
        });
        client.on('end', () => {
            try {
                resolve(JSON.parse(response));
            } catch (e) {
                resolve({ error: 'parse_error' });
            }
        });
        client.on('error', reject);

        setTimeout(() => {
            client.destroy();
            reject(new Error('timeout'));
        }, 1000);
    });
}

/**
 * Broadcast message to all WebSocket clients
 */
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

/**
 * Execute shell command as promise
 */
function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve(stdout.trim());
        });
    });
}

/**
 * Kill all MPV processes properly
 */
function killAllMpv() {
    return new Promise((resolve) => {
        if (mpvProcess) {
            try {
                // IMPORTANT: Remove listeners BEFORE killing to prevent unwanted callbacks
                mpvProcess.removeAllListeners('close');
                mpvProcess.removeAllListeners('error');
                mpvProcess.removeAllListeners('exit');

                mpvProcess.kill('SIGKILL');
            } catch (e) {
                console.error('[Kill] Error:', e.message);
            }
            mpvProcess = null;
        }

        // Kill any stray MPV processes
        exec('pkill -9 mpv', () => {
            setTimeout(resolve, 300);
        });
    });
}

/**
 * Get list of paired Bluetooth devices
 */
async function getBluetoothDevices() {
    try {
        const output = await execPromise('bluetoothctl devices');
        const lines = output.split('\n');
        const devices = lines.map(line => {
            const match = line.match(/Device ([A-F0-9:]+) (.+)/);
            if (match) {
                return {
                    mac: match[1],
                    name: match[2]
                };
            }
            return null;
        }).filter(d => d);

        for (let device of devices) {
            try {
                const info = await execPromise(`bluetoothctl info ${device.mac}`);
                device.connected = info.includes('Connected: yes');
                device.paired = info.includes('Paired: yes');
            } catch (e) {
                device.connected = false;
                device.paired = false;
            }
        }

        return devices;
    } catch (error) {
        return [];
    }
}

/**
 * Get list of PulseAudio sinks
 */
async function getAudioSinks() {
    try {
        const output = await execPromise('pactl list sinks short');
        const lines = output.split('\n');
        return lines.map(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                return {
                    id: parts[0],
                    name: parts[1],
                    type: parts[1].includes('bluez') ? 'bluetooth' : 'internal'
                };
            }
            return null;
        }).filter(s => s);
    } catch (error) {
        return [];
    }
}

/**
 * Get default audio sink
 */
async function getDefaultSink() {
    try {
        const output = await execPromise('pactl info');
        const match = output.match(/Default Sink: (.+)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

// ==================== Playback Functions ====================

/**
 * Play song from queue at given index - MPV calls yt-dlp directly
 */
async function playFromQueue(index) {
    if (index < 0 || index >= queue.length) {
        console.log('[Queue] Invalid index:', index);
        return;
    }

    // Prevent concurrent switches
    if (isSwitchingTrack) {
        console.log('[Queue] Switch already in progress, ignoring...');
        return;
    }

    // Check if already playing this song
    if (index === currentQueueIndex && mpvProcess) {
        console.log('[Queue] Already playing this song, ignoring...');
        return;
    }

    // Lock switching
    isSwitchingTrack = true;

    const item = queue[index];
    console.log(`[Queue] Switching to [${index}]: ${item.title}`);

    // Stop all MPV processes first
    await killAllMpv();

    currentQueueIndex = index;
    currentUrl = item.url;
    currentSong = item.title || 'Loading...';
    playbackData = { duration: 0, position: 0, paused: false };

    broadcast({
        type: 'queue_playing',
        index,
        title: currentSong,
        queue,
        currentQueueIndex
    });

    // Unlock immediately since we're not using async extraction
    isSwitchingTrack = false;

    console.log('[MPV] Starting playback with yt-dlp integration...');

    mpvProcess = spawn('mpv', [
        '--no-video',
        '--really-quiet=no',
        '--msg-level=all=info',
        '--audio-device=pulse',
        `--input-ipc-server=${MPV_SOCKET}`,
        `--volume=${volume}`,
        '--audio-client-name=YouTube-Music',

        // Cache settings
        '--cache=yes',
        '--cache-secs=30',
        '--demuxer-max-bytes=150M',
        '--demuxer-max-back-bytes=75M',

        // yt-dlp integration
        '--script-opts=ytdl_hook-ytdl_path=yt-dlp',
        '--ytdl=yes',
        '--ytdl-format=bestaudio/best',

        // Network settings
        '--network-timeout=60',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',

        item.url
    ], {
        env: {
            ...process.env,
            HOME: '/home/home-server',
            USER: 'home-server',
            XDG_RUNTIME_DIR: '/run/user/1000',
            PULSE_SERVER: 'unix:/run/user/1000/pulse/native',
            PULSE_RUNTIME_PATH: '/run/user/1000/pulse'
        }
    });


    // Log all MPV output
    mpvProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) console.log(`[MPV] ${output}`);
    });

    mpvProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) console.error(`[MPV] ${output}`);
    });

    mpvProcess.on('close', (code, signal) => {
        console.log(`[MPV] Process closed - code: ${code}, signal: ${signal}`);

        if (mpvProcess === null) {
            console.log('[MPV] Manual switch - skipping auto-play');
            return;
        }

        mpvProcess = null;

        // Handle different exit codes
        if (code === 0 || code === null) {
            console.log('[Queue] ✅ Track finished, playing next...');
            setTimeout(() => playNext(), 500);
        } else {
            console.error(`[MPV] ⚠️  Exit code ${code}, trying next song...`);
            setTimeout(() => playNext(), 2000);
        }
    });

    mpvProcess.on('error', (err) => {
        console.error(`[MPV] Spawn error: ${err.message}`);
        mpvProcess = null;
        setTimeout(() => playNext(), 2000);
    });
}

/**
 * Play next song in queue
 */
function playNext() {
    // Don't play next if manual switch is in progress
    if (isManualSwitch || isSwitchingTrack) {
        console.log('[Queue] Skipping auto-play (switch in progress)');
        return;
    }

    if (currentQueueIndex < queue.length - 1) {
        isManualSwitch = false; // Ensure flag is reset
        playFromQueue(currentQueueIndex + 1);
    } else {
        console.log('[Queue] End of queue');
        currentSong = '';
        currentQueueIndex = -1;
        killAllMpv();
        broadcast({ type: 'queue_ended' });
    }
}

/**
 * Play previous song in queue
 */
function playPrevious() {
    if (currentQueueIndex > 0) {
        isManualSwitch = false; // Reset before play
        playFromQueue(currentQueueIndex - 1);
    } else {
        console.log('[Queue] Already at first song');
    }
}

// ==================== Background Tasks ====================

/**
 * Update playback info periodically
 */
async function updatePlaybackInfo() {
    if (!mpvProcess) return;

    try {
        const [timePos, duration, paused] = await Promise.all([
            mpvCommand({ command: ['get_property', 'time-pos'] }),
            mpvCommand({ command: ['get_property', 'duration'] }),
            mpvCommand({ command: ['get_property', 'pause'] })
        ]);

        playbackData.position = timePos.data || 0;
        playbackData.duration = duration.data || 0;
        playbackData.paused = paused.data || false;

        broadcast({
            type: 'update',
            playing: true,
            paused: playbackData.paused,
            currentSong,
            volume,
            position: playbackData.position,
            duration: playbackData.duration,
            queue,
            currentQueueIndex
        });
    } catch (e) {
        // Socket not ready or MPV not responding
    }
}

setInterval(updatePlaybackInfo, 500);

// ==================== Authentication Routes ====================

app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (verifyPassword(username, password)) {
        req.session.authenticated = true;
        req.session.username = username;
        console.log(`[Auth] User logged in: ${username}`);
        res.json({ success: true });
    } else {
        console.log(`[Auth] Failed login attempt: ${username}`);
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/logout', (req, res) => {
    const username = req.session?.username;
    req.session.destroy();
    console.log(`[Auth] User logged out: ${username}`);
    res.json({ success: true });
});

app.get('/auth/status', (req, res) => {
    res.json({
        authenticated: req.session && req.session.authenticated,
        username: req.session?.username || null
    });
});

// ==================== Protected Routes ====================

// Main page (protected)
app.get('/', (req, res) => {
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Status endpoint
app.get('/status', requireAuth, (req, res) => {
    res.json({
        playing: mpvProcess !== null,
        paused: playbackData.paused,
        currentSong,
        volume,
        position: playbackData.position,
        duration: playbackData.duration,
        queue,
        currentQueueIndex
    });
});

// ==================== Queue Routes ====================

app.post('/queue/add', requireAuth, async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    console.log(`[Queue] Adding: ${url}`);

    // Get title asynchronously
    exec(`yt-dlp --no-playlist --print "%(title)s" "${url}"`, (err, title) => {
        const item = {
            id: Date.now(),
            url,
            title: err ? url : title.trim()
        };

        queue.push(item);
        console.log(`[Queue] Added: ${item.title}`);

        // Auto-play if nothing is playing
        if (!mpvProcess) {
            playFromQueue(queue.length - 1);
        }

        broadcast({ type: 'queue_updated', queue, currentQueueIndex });
    });

    res.json({ success: true, message: 'Added to queue' });
});

app.post('/queue/remove', requireAuth, (req, res) => {
    const { id } = req.body;

    const index = queue.findIndex(item => item.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }

    // Handle if removing current song
    if (index === currentQueueIndex) {
        playNext();
    } else if (index < currentQueueIndex) {
        currentQueueIndex--;
    }

    queue.splice(index, 1);
    console.log(`[Queue] Removed item at index ${index}`);

    res.json({ success: true, queue });
    broadcast({ type: 'queue_updated', queue, currentQueueIndex });
});

app.post('/queue/clear', requireAuth, (req, res) => {
    killAllMpv();
    queue = [];
    currentQueueIndex = -1;
    currentSong = '';

    console.log('[Queue] Cleared');

    res.json({ success: true });
    broadcast({ type: 'queue_cleared' });
});

app.post('/queue/play', requireAuth, (req, res) => {
    const { index } = req.body;

    if (index < 0 || index >= queue.length) {
        return res.status(400).json({ error: 'Invalid index' });
    }

    playFromQueue(index);
    res.json({ success: true });
});

app.post('/queue/next', requireAuth, (req, res) => {
    playNext();
    res.json({ success: true });
});

app.post('/queue/previous', requireAuth, (req, res) => {
    playPrevious();
    res.json({ success: true });
});

// ==================== Bluetooth Routes ====================

app.get('/bluetooth/devices', requireAuth, async (req, res) => {
    try {
        const devices = await getBluetoothDevices();
        res.json({ devices, scanning: isScanning });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/bluetooth/scan', requireAuth, async (req, res) => {
    try {
        isScanning = true;
        broadcast({ type: 'bluetooth_scanning', scanning: true });

        console.log('[Bluetooth] Starting scan...');
        exec('bluetoothctl scan on');

        res.json({ success: true, message: 'Scanning for 10 seconds...' });

        // Stop after 10 seconds
        setTimeout(async () => {
            exec('bluetoothctl scan off');
            isScanning = false;
            console.log('[Bluetooth] Scan complete');
            broadcast({ type: 'bluetooth_scanning', scanning: false });

            const devices = await getBluetoothDevices();
            broadcast({ type: 'bluetooth_devices', devices });
        }, 10000);
    } catch (error) {
        isScanning = false;
        res.status(500).json({ error: error.message });
    }
});

app.post('/bluetooth/connect', requireAuth, async (req, res) => {
    const { mac } = req.body;

    if (!mac) {
        return res.status(400).json({ error: 'MAC required' });
    }

    try {
        console.log(`[Bluetooth] Connecting to ${mac}...`);
        await execPromise(`bluetoothctl connect ${mac}`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`[Bluetooth] Connected to ${mac}`);
        res.json({ success: true });
        broadcast({ type: 'bluetooth_connected', mac });
    } catch (error) {
        console.error(`[Bluetooth] Connection failed: ${error.message}`);
        res.status(500).json({ error: 'Connection failed' });
    }
});

app.post('/bluetooth/disconnect', requireAuth, async (req, res) => {
    const { mac } = req.body;

    if (!mac) {
        return res.status(400).json({ error: 'MAC required' });
    }

    try {
        console.log(`[Bluetooth] Disconnecting ${mac}...`);
        await execPromise(`bluetoothctl disconnect ${mac}`);
        console.log(`[Bluetooth] Disconnected ${mac}`);
        res.json({ success: true });
        broadcast({ type: 'bluetooth_disconnected', mac });
    } catch (error) {
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

// ==================== Audio Routes ====================

app.get('/audio/sinks', requireAuth, async (req, res) => {
    try {
        const sinks = await getAudioSinks();
        const defaultSink = await getDefaultSink();
        res.json({ sinks, default: defaultSink });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/audio/set-sink', requireAuth, async (req, res) => {
    const { sink } = req.body;

    if (!sink) {
        return res.status(400).json({ error: 'Sink required' });
    }

    try {
        await execPromise(`pactl set-default-sink ${sink}`);
        console.log(`[Audio] Switched to sink: ${sink}`);
        res.json({ success: true });
        broadcast({ type: 'sink_changed', sink });
    } catch (error) {
        res.status(500).json({ error: 'Cannot set sink' });
    }
});

// ==================== Playback Control Routes ====================

app.post('/pause', requireAuth, async (req, res) => {
    try {
        await mpvCommand({ command: ['cycle', 'pause'] });
        playbackData.paused = !playbackData.paused;
        console.log(`[Playback] ${playbackData.paused ? 'Paused' : 'Resumed'}`);
        res.json({ success: true, paused: playbackData.paused });
        broadcast({ type: 'paused', paused: playbackData.paused });
    } catch (error) {
        res.status(500).json({ error: 'Cannot pause' });
    }
});

app.post('/stop', requireAuth, (req, res) => {
    killAllMpv();
    currentSong = '';
    currentQueueIndex = -1;
    playbackData = { duration: 0, position: 0, paused: false };

    console.log('[Playback] Stopped');
    res.json({ success: true });
    broadcast({ type: 'stopped' });
});

app.post('/volume', requireAuth, async (req, res) => {
    const newVolume = parseInt(req.body.volume);

    if (isNaN(newVolume) || newVolume < 0 || newVolume > 100) {
        return res.status(400).json({ error: 'Invalid volume (0-100)' });
    }

    volume = newVolume;
    console.log(`[Volume] Set to ${volume}%`);

    try {
        await mpvCommand({ command: ['set_property', 'volume', volume] });
    } catch (e) { }

    exec(`pactl list sinks short | awk '{print $2}' | xargs -I {} pactl set-sink-volume {} ${volume}%`);

    res.json({ success: true, volume });
    broadcast({ type: 'volume', volume });
});

app.post('/seek', requireAuth, async (req, res) => {
    const { position, relative } = req.body;

    try {
        if (relative) {
            await mpvCommand({ command: ['seek', position, 'relative'] });
            console.log(`[Seek] ${position > 0 ? '+' : ''}${position}s`);
        } else {
            await mpvCommand({ command: ['seek', position, 'absolute'] });
            console.log(`[Seek] To ${position}s`);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Cannot seek' });
    }
});

// ==================== WebSocket ====================

wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    ws.send(JSON.stringify({
        type: 'init',
        playing: mpvProcess !== null,
        paused: playbackData.paused,
        currentSong,
        volume,
        position: playbackData.position,
        duration: playbackData.duration,
        queue,
        currentQueueIndex
    }));

    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
    });
});

// ==================== Start Server ====================

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🎵 YouTube Music Server v2.0.0');
    console.log('================================');
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`👤 Login: admin / admin123`);
    console.log(`⚠️  Change default password!`);
    console.log('================================\n');
});
