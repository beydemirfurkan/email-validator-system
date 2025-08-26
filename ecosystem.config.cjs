module.exports = {
  apps: [{
    name: 'email-validator-api',
    script: 'dist/app.js',
    instances: 3,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 4444
    },
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_file: './logs/combined.log',
    time: true
  }]
};