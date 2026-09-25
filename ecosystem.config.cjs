module.exports = {
  apps: [
    {
      name: 'campusattend-os',
      script: 'apps/attendance-engine/src/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3000',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 50,
    },
  ],
};
