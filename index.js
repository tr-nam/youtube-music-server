require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { exec, spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const net = require('net');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const MPV_SOCKET = '/tmp/mpv-socket';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

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

// MPV IPC command
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

// Broadcast
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Update playback info
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
    } catch (e) { }
}

setInterval(updatePlaybackInfo, 500);

// Exec promise helper
function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve(stdout.trim());
        });
    });
}

// Bluetooth helpers
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

async function getDefaultSink() {
    try {
        const output = await execPromise('pactl info');
        const match = output.match(/Default Sink: (.+)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

// Helper: Kill all MPV
function killAllMpv() {
    return new Promise((resolve) => {
        if (mpvProcess) {
            try {
                mpvProcess.kill('SIGKILL');
            } catch (e) { }
            mpvProcess = null;
        }

        exec('pkill -9 mpv', () => {
            setTimeout(resolve, 200);
        });
    });
}

// Play from queue
async function playFromQueue(index) {
    if (index < 0 || index >= queue.length) return;

    const item = queue[index];
    console.log(`Switching to queue [${index}]: ${item.title}`);

    // IMPORTANT: Stop everything first
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

    // Get stream
    exec(`yt-dlp -f bestaudio --no-playlist --user-agent "Mozilla/5.0" -g "${item.url}"`, async (error, stdout) => {
        if (error) {
            console.error(`yt-dlp error: ${error.message}`);
            playNext();
            return;
        }

        const streamUrl = stdout.trim();
        if (!streamUrl) {
            playNext();
            return;
        }

        // Safety: kill again before spawn
        await killAllMpv();

        console.log('Starting MPV...');

        mpvProcess = spawn('mpv', [
            '--no-video',
            '--really-quiet',
            '--audio-device=pulse',
            `--input-ipc-server=${MPV_SOCKET}`,
            `--volume=${volume}`,
            streamUrl
        ]);

        mpvProcess.on('close', (code) => {
            console.log(`Track ended (${code})`);
            mpvProcess = null;
            playNext();
        });

        mpvProcess.on('error', (err) => {
            console.error(`MPV error: ${err.message}`);
            mpvProcess = null;
            playNext();
        });
    });
}

function playNext() {
    if (currentQueueIndex < queue.length - 1) {
        playFromQueue(currentQueueIndex + 1);
    } else {
        currentSong = '';
        currentQueueIndex = -1;
        killAllMpv();
        broadcast({ type: 'queue_ended' });
    }
}

function playPrevious() {
    if (currentQueueIndex > 0) {
        playFromQueue(currentQueueIndex - 1);
    }
}


// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/status', (req, res) => {
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

// Queue routes
app.post('/queue/add', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    console.log(`Adding to queue: ${url}`);

    // Get title async
    exec(`yt-dlp --no-playlist --print "%(title)s" "${url}"`, (err, title) => {
        const item = {
            id: Date.now(),
            url,
            title: err ? url : title.trim()
        };

        queue.push(item);

        console.log(`Added: ${item.title}`);

        // Start playing if nothing is playing
        if (!mpvProcess) {
            playFromQueue(queue.length - 1);
        }

        broadcast({ type: 'queue_updated', queue, currentQueueIndex });
    });

    res.json({ success: true, message: 'Added to queue' });
});

app.post('/queue/remove', (req, res) => {
    const { id } = req.body;

    const index = queue.findIndex(item => item.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }

    // If removing current song
    if (index === currentQueueIndex) {
        playNext();
    } else if (index < currentQueueIndex) {
        currentQueueIndex--;
    }

    queue.splice(index, 1);

    res.json({ success: true, queue });
    broadcast({ type: 'queue_updated', queue, currentQueueIndex });
});

app.post('/queue/clear', (req, res) => {
    if (mpvProcess) {
        try {
            mpvProcess.kill('SIGKILL');
        } catch (e) { }
        mpvProcess = null;
    }

    queue = [];
    currentQueueIndex = -1;
    currentSong = '';

    res.json({ success: true });
    broadcast({ type: 'queue_cleared' });
});

app.post('/queue/play', (req, res) => {
    const { index } = req.body;

    if (index < 0 || index >= queue.length) {
        return res.status(400).json({ error: 'Invalid index' });
    }

    playFromQueue(index);
    res.json({ success: true });
});

app.post('/queue/next', (req, res) => {
    playNext();
    res.json({ success: true });
});

app.post('/queue/previous', (req, res) => {
    playPrevious();
    res.json({ success: true });
});

// Bluetooth routes
app.get('/bluetooth/devices', async (req, res) => {
    try {
        const devices = await getBluetoothDevices();
        res.json({ devices, scanning: isScanning });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/bluetooth/scan', async (req, res) => {
    try {
        isScanning = true;
        broadcast({ type: 'bluetooth_scanning', scanning: true });

        // Start scan
        exec('bluetoothctl scan on');

        res.json({ success: true, message: 'Scanning for 10 seconds...' });

        // Stop after 10s
        setTimeout(async () => {
            exec('bluetoothctl scan off');
            isScanning = false;
            broadcast({ type: 'bluetooth_scanning', scanning: false });

            // Get updated devices
            const devices = await getBluetoothDevices();
            broadcast({ type: 'bluetooth_devices', devices });
        }, 10000);
    } catch (error) {
        isScanning = false;
        res.status(500).json({ error: error.message });
    }
});

app.post('/bluetooth/connect', async (req, res) => {
    const { mac } = req.body;

    if (!mac) {
        return res.status(400).json({ error: 'MAC required' });
    }

    try {
        console.log(`Connecting to ${mac}...`);
        await execPromise(`bluetoothctl connect ${mac}`);

        await new Promise(resolve => setTimeout(resolve, 3000));

        res.json({ success: true });
        broadcast({ type: 'bluetooth_connected', mac });
    } catch (error) {
        res.status(500).json({ error: 'Connection failed' });
    }
});

app.post('/bluetooth/disconnect', async (req, res) => {
    const { mac } = req.body;

    if (!mac) {
        return res.status(400).json({ error: 'MAC required' });
    }

    try {
        await execPromise(`bluetoothctl disconnect ${mac}`);
        res.json({ success: true });
        broadcast({ type: 'bluetooth_disconnected', mac });
    } catch (error) {
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

// Audio routes
app.get('/audio/sinks', async (req, res) => {
    try {
        const sinks = await getAudioSinks();
        const defaultSink = await getDefaultSink();
        res.json({ sinks, default: defaultSink });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/audio/set-sink', async (req, res) => {
    const { sink } = req.body;

    if (!sink) {
        return res.status(400).json({ error: 'Sink required' });
    }

    try {
        await execPromise(`pactl set-default-sink ${sink}`);
        res.json({ success: true });
        broadcast({ type: 'sink_changed', sink });
    } catch (error) {
        res.status(500).json({ error: 'Cannot set sink' });
    }
});

// Playback control
app.post('/pause', async (req, res) => {
    try {
        await mpvCommand({ command: ['cycle', 'pause'] });
        playbackData.paused = !playbackData.paused;
        res.json({ success: true, paused: playbackData.paused });
        broadcast({ type: 'paused', paused: playbackData.paused });
    } catch (error) {
        res.status(500).json({ error: 'Cannot pause' });
    }
});

app.post('/stop', (req, res) => {
    if (mpvProcess) {
        try {
            mpvProcess.kill('SIGKILL');
        } catch (e) { }
        mpvProcess = null;
    }

    currentSong = '';
    currentQueueIndex = -1;
    playbackData = { duration: 0, position: 0, paused: false };

    res.json({ success: true });
    broadcast({ type: 'stopped' });
});

app.post('/volume', async (req, res) => {
    const newVolume = parseInt(req.body.volume);

    if (isNaN(newVolume) || newVolume < 0 || newVolume > 100) {
        return res.status(400).json({ error: 'Invalid volume' });
    }

    volume = newVolume;

    try {
        await mpvCommand({ command: ['set_property', 'volume', volume] });
    } catch (e) { }

    exec(`pactl list sinks short | awk '{print $2}' | xargs -I {} pactl set-sink-volume {} ${volume}%`);

    res.json({ success: true, volume });
    broadcast({ type: 'volume', volume });
});

app.post('/seek', async (req, res) => {
    const { position, relative } = req.body;

    try {
        if (relative) {
            await mpvCommand({ command: ['seek', position, 'relative'] });
        } else {
            await mpvCommand({ command: ['seek', position, 'absolute'] });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Cannot seek' });
    }
});

// WebSocket
wss.on('connection', (ws) => {
    console.log('Client connected');
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
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 Server: http://0.0.0.0:${PORT}`);
});
