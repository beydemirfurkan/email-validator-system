module.exports = {
  apps: [
    {
      name: "email-validator-api",
      script: "app.js",
      interpreter: "node",
      instances: "3",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 4444,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4444,
      },
      watch: false,
      max_memory_restart: "256M",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm Z",
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: "10s"
    }
  ]
};