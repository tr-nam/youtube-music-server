const os = require('os');
const path = require('path');

// Get current user info
const currentUser = os.userInfo();
const uid = currentUser.uid;
const username = currentUser.username;
const homedir = currentUser.homedir;

// Detect script directory (assumes ecosystem.config.js is in project root)
const scriptDir = __dirname;

module.exports = {
  apps: [{
    name: 'youtube-music',
    script: './start.sh',
    cwd: scriptDir,
    interpreter: '/bin/bash',
    env: {
      NODE_ENV: 'production',
      XDG_RUNTIME_DIR: `/run/user/${uid}`,
      PULSE_SERVER: `unix:/run/user/${uid}/pulse/native`,
      PULSE_RUNTIME_PATH: `/run/user/${uid}/pulse`,
      HOME: homedir,
      USER: username
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
