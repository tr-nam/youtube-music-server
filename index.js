const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

let currentSong = '';
let isPlaying = false;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/status', (req, res) => {
    res.json({
        playing: isPlaying,
        currentSong: currentSong
    });
});

app.post('/play', (req, res) => {
    const url = req.body.url;
    
    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    console.log(`Đang phát: ${url}`);
    
    // Stop bài cũ
    exec('pkill -9 mpv', () => {});
    
    // Lấy title
    exec(`yt-dlp --no-playlist --print "%(title)s" "${url}"`, (err, title) => {
        if (!err && title) {
            currentSong = title.trim();
            console.log(`Title: ${currentSong}`);
        }
    });

    // Escape URL
    const escapedUrl = url.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    
    // Chạy MPV container mới với host audio
    const playCmd = `docker run -d --rm \
        --name mpv-player-${Date.now()} \
        --device /dev/snd:/dev/snd \
        --network host \
        alpine sh -c "
            apk add --no-cache mpv yt-dlp > /dev/null 2>&1
            streamUrl=\\$(yt-dlp -f bestaudio --no-playlist -g '${escapedUrl}')
            mpv --no-video --really-quiet \\$streamUrl
        "`;
    
    console.log('Starting playback container...');
    
    exec(playCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            isPlaying = false;
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Không thể phát nhạc' });
            }
            return;
        }
        
        isPlaying = true;
        console.log('Playback container started');
    });

    // Gửi response ngay
    return res.json({ success: true, message: 'Đang phát...' });
});

app.post('/stop', (req, res) => {
    exec('docker ps -q --filter "name=mpv-player" | xargs -r docker stop', (error) => {
        if (error) {
            console.log('No container to stop');
        }
        isPlaying = false;
        currentSong = '';
        console.log('Stopped playback');
    });
    res.json({ success: true });
});

// Monitor playback
setInterval(() => {
    if (isPlaying) {
        exec('docker ps --filter "name=mpv-player" --format "{{.Names}}"', (err, stdout) => {
            if (!stdout.trim()) {
                isPlaying = false;
                currentSong = '';
                console.log('Playback ended');
            }
        });
    }
}, 5000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 YouTube Music Server: http://0.0.0.0:${PORT}`);
    console.log(`📡 Audio plays on HOST speakers`);
});
