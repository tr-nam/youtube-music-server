const express = require('express');
const bodyParser = require('body-parser');
const { spawn, exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let mpvProcess = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/play', (req, res) => {
    const url = req.body.url;
    
    if (!url) return res.redirect('/');

    // Kill process cũ
    if (mpvProcess) {
        try {
            process.kill(-mpvProcess.pid);
        } catch (e) {
            console.log("Không kill được process cũ:", e.message);
        }
    }

    console.log(`Đang phát: ${url}`);

    // FIX: Lấy stream URL trước bằng yt-dlp, rồi pipe vào MPV
    exec(`yt-dlp -f bestaudio -g "${url}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`yt-dlp error: ${error.message}`);
            return res.status(500).send('Lỗi khi lấy stream URL');
        }

        const streamUrl = stdout.trim();
        console.log(`Stream URL: ${streamUrl}`);

        // Phát stream URL trực tiếp
        mpvProcess = spawn('mpv', [
            '--no-video',
            '--audio-device=alsa/default',
            streamUrl
        ], { detached: true });

        mpvProcess.stdout.on('data', (data) => console.log(`MPV: ${data}`));
        mpvProcess.stderr.on('data', (data) => console.error(`MPV Error: ${data}`));
        
        mpvProcess.on('close', (code) => {
            console.log(`MPV đã đóng với code ${code}`);
            mpvProcess = null;
        });
    });

    res.redirect('/');
});

app.post('/stop', (req, res) => {
    if (mpvProcess) {
        try {
            process.kill(-mpvProcess.pid);
        } catch (e) {
            console.log("Lỗi khi dừng:", e.message);
        }
        mpvProcess = null;
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
