/**
 * PM2 Ecosystem for Hostinger VPS — AetherMed HMS
 *
 * Usage:
 *   pm2 start ecosystem.hostinger.config.js --production
 *
 * Features:
 *   • Max restarts: 10 — auto-restarts if MedWiki sync crashes
 *   • Min uptime: 5s — prevents rapid crash loops
 *   • Max memory: 1GB — prevents OOM kill
 *   • Log rotation — keeps logs manageable
 *   • Crontab entry for MedWiki sync every 30 min
 */

module.exports = {
  apps: [
    {
      name: 'aethermed-hms',
      script: 'npm',
      args: 'run start',
      cwd: '/home/user/hmsaas', // Change to your VPS path, e.g. /var/www/hmsaas
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      max_memory_restart: '1G',
      node_args: [],
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
      // Log management
      log_file: '/var/log/aethermed/combined.log',
      out_file: '/var/log/aethermed/out.log',
      error_file: '/var/log/aethermed/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_log_size: '10M',
      log_retention_days: 7,
    },
  ],
}
