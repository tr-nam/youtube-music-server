const express = require('express');
const bodyParser = require('body-parser');
const { spawn, exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

let mpvProcess = null;
let currentSong = '';

// Trang chủ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API lấy trạng thái
app.get('/status', (req, res) => {
    res.json({
        playing: mpvProcess !== null,
        currentSong: currentSong
    });
});

// Phát nhạc
app.post('/play', (req, res) => {
    const url = req.body.url;
    
    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    // Kill process cũ
    if (mpvProcess) {
        try {
            process.kill(-mpvProcess.pid);
            console.log('Đã dừng bài hát cũ');
        } catch (e) {
            console.log('Lỗi khi dừng:', e.message);
        }
        mpvProcess = null;
    }

    console.log(`Đang lấy stream: ${url}`);
    currentSong = url;

    // Lấy stream URL và metadata
    const ytdlpCmd = `yt-dlp -f bestaudio --no-playlist --print "%(url)s|%(title)s" "${url}"`;
    
    exec(ytdlpCmd, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`yt-dlp error: ${error.message}`);
            console.error(stderr);
            currentSong = '';
            return res.status(500).json({ error: 'Không thể lấy stream' });
        }

        const output = stdout.trim().split('|');
        const streamUrl = output[0];
        const title = output[1] || 'Unknown';

        if (!streamUrl) {
            console.error('Không lấy được stream URL');
            currentSong = '';
            return res.status(500).json({ error: 'Stream URL không hợp lệ' });
        }

        console.log(`Đang phát: ${title}`);
        currentSong = title;

        // Phát bằng MPV với auto-detect audio output
        mpvProcess = spawn('mpv', [
            '--no-video',
            '--no-terminal',
            '--really-quiet',
            '--ao=pulse,alsa,',  // Thử pulse trước, fallback sang alsa
            '--audio-channels=stereo',
            '--volume=100',
            streamUrl
        ], { 
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                PULSE_SERVER: process.env.PULSE_SERVER || 'unix:/run/user/1000/pulse/native',
                AUDIODEV: 'pulse'
            }
        });

        mpvProcess.stdout.on('data', (data) => {
            console.log(`MPV: ${data}`);
        });

        mpvProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (!msg.includes('really-quiet')) {
                console.error(`MPV: ${msg}`);
            }
        });
        
        mpvProcess.on('close', (code) => {
            console.log(`MPV đã đóng với code ${code}`);
            mpvProcess = null;
            currentSong = '';
        });

        mpvProcess.on('error', (err) => {
            console.error(`MPV spawn error: ${err}`);
            mpvProcess = null;
            currentSong = '';
        });
    });

    res.json({ success: true, message: 'Đang phát...' });
});

// Dừng phát
app.post('/stop', (req, res) => {
    if (mpvProcess) {
        try {
            process.kill(-mpvProcess.pid);
            console.log('Đã dừng phát nhạc');
        } catch (e) {
            console.log('Lỗi khi dừng:', e.message);
        }
        mpvProcess = null;
        currentSong = '';
    }
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 YouTube Music Server đang chạy tại http://0.0.0.0:${PORT}`);
    console.log(`📡 Truy cập từ mạng LAN: http://<IP-SERVER>:${PORT}`);
});
