const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// Get current user info
const currentUser = os.userInfo();
const uid = currentUser.uid;
const username = currentUser.username;
const homedir = currentUser.homedir;

// Detect bash location (Termux uses different paths)
let bashPath = '/bin/bash';
try {
  bashPath = execSync('which bash').toString().trim();
} catch (e) {
  // Fallback for Termux
  bashPath = execSync('command -v bash || echo /data/data/com.termux/files/usr/bin/bash').toString().trim();
}

// Detect script directory
const scriptDir = __dirname;

console.log(`Detected bash: ${bashPath}`);
console.log(`User: ${username} (UID: ${uid})`);
console.log(`Home: ${homedir}`);
console.log(`CWD: ${scriptDir}`);

module.exports = {
  apps: [{
    name: 'youtube-music',
    script: './start.sh',
    cwd: scriptDir,
    interpreter: bashPath,
    env: {
      NODE_ENV: 'production',
      XDG_RUNTIME_DIR: `/run/user/${uid}`,
      PULSE_SERVER: `unix:/run/user/${uid}/pulse/native`,
      PULSE_RUNTIME_PATH: `/run/user/${uid}/pulse`,
      HOME: homedir,
      USER: username,
      PREFIX: process.env.PREFIX || '/data/data/com.termux/files/usr',
      TMPDIR: process.env.TMPDIR || `${homedir}/.tmp`
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    error_file: `${homedir}/.pm2/logs/youtube-music-error.log`,
    out_file: `${homedir}/.pm2/logs/youtube-music-out.log`,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
