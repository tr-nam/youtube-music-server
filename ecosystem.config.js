module.exports = {
  apps: [{
    name: 'youtube-music',
    script: './start.sh',
    cwd: '/home/home-server/youtube-music-server',
    interpreter: '/bin/bash',
    env: {
      NODE_ENV: 'production',
      XDG_RUNTIME_DIR: '/run/user/1000',
      PULSE_SERVER: 'unix:/run/user/1000/pulse/native',
      PULSE_RUNTIME_PATH: '/run/user/1000/pulse',
      HOME: '/home/home-server',
      USER: 'home-server'
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    error_file: '/home/home-server/.pm2/logs/youtube-music-error.log',
    out_file: '/home/home-server/.pm2/logs/youtube-music-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
