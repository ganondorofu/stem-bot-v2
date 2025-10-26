module.exports = {
  apps : [{
    name: 'stem-bot-v2',
    script: 'dist/index.js',
    cwd: '/opt/stem-bot-v2',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true,
    // ↓ここを追加
    post_update: [
      'npm install -y', // 依存パッケージ自動更新
      'npm run build'   // TypeScriptのjsビルドaaaaaa
    ]
  }]
};
