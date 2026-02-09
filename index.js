const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let mpvProcess = null;

// Route trang chủ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route phát nhạc
app.post('/play', (req, res) => {
    const url = req.body.url;
    
    if (!url) return res.redirect('/');

    // 1. Kill process cũ nếu đang chạy
    if (mpvProcess) {
        try {
            process.kill(-mpvProcess.pid); // Kill cả nhóm process
        } catch (e) {
            console.log("Không kill được process cũ hoặc đã chết:", e.message);
        }
    }

    console.log(`Đang phát: ${url}`);

    // 2. Chạy MPV mới
    // detached: true để tạo group process riêng, dễ kill sạch sẽ
    mpvProcess = spawn('mpv', ['--no-video', url], { detached: true });

    mpvProcess.stdout.on('data', (data) => console.log(`MPV: ${data}`));
    mpvProcess.stderr.on('data', (data) => console.error(`MPV Error: ${data}`));
    
    mpvProcess.on('close', (code) => {
        console.log(`MPV đã đóng với code ${code}`);
        mpvProcess = null;
    });

    res.redirect('/');
});

// Route dừng nhạc
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
