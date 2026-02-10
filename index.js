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
    
    // Stop MPV cũ trên HOST
    const killCmd = 'nsenter -t 1 -m -u -n -p pkill -9 mpv';
    exec(killCmd, () => {
        console.log('Stopped old playback');
    });
    
    // Lấy title (chạy trong container)
    exec(`yt-dlp --no-playlist --print "%(title)s" "${url}"`, (err, title) => {
        if (!err && title) {
            currentSong = title.trim();
            console.log(`Title: ${currentSong}`);
        }
    });

    // Escape URL cho shell
    const escapedUrl = url.replace(/'/g, "'\\''");
    
    // Chạy MPV trên HOST qua nsenter
    // nsenter -t 1 = vào namespace của PID 1 (init/systemd trên host)
    const playCmd = `nsenter -t 1 -m -u -n -p bash -c "
        nohup bash -c '
            streamUrl=\\$(yt-dlp -f bestaudio --no-playlist -g \"${escapedUrl}\" 2>&1)
            if [ \\$? -eq 0 ]; then
                echo \"Playing: \\$streamUrl\" >> /tmp/mpv.log
                mpv --no-video --really-quiet \"\\$streamUrl\" >> /tmp/mpv.log 2>&1
            else
                echo \"yt-dlp error: \\$streamUrl\" >> /tmp/mpv.log
            fi
        ' > /dev/null 2>&1 &
    "`;
    
    console.log('Starting playback on host...');
    
    exec(playCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec error: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            isPlaying = false;
            return res.status(500).json({ error: 'Không thể phát nhạc' });
        }
        
        isPlaying = true;
        console.log('Playback started on host');
        
        // Check sau 2s xem MPV có chạy không
        setTimeout(() => {
            exec('nsenter -t 1 -m -u -n -p pgrep -f "mpv.*youtube"', (err, output) => {
                if (!output) {
                    console.error('MPV not running after 2s');
                    isPlaying = false;
                }
            });
        }, 2000);
    });

    res.json({ success: true, message: 'Đang phát...' });
});

app.post('/stop', (req, res) => {
    exec('nsenter -t 1 -m -u -n -p pkill -9 mpv', (error) => {
        if (error) {
            console.log('No MPV to kill');
        }
        isPlaying = false;
        currentSong = '';
        console.log('Stopped playback');
    });
    res.json({ success: true });
});

// Monitor MPV status trên host
setInterval(() => {
    if (isPlaying) {
        exec('nsenter -t 1 -m -u -n -p pgrep -f "mpv"', (err, stdout) => {
            if (!stdout) {
                isPlaying = false;
                currentSong = '';
                console.log('MPV process ended');
            }
        });
    }
}, 5000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 YouTube Music Server: http://0.0.0.0:${PORT}`);
    console.log(`📡 Audio plays on HOST speakers`);
});
