/**
 * PM2 Ecosystem for Hostinger VPS — AetherMed HMS + MedWiki Service
 *
 * Two independent processes:
 *   • aethermed-hms       → Port 3000 (main HMS app)
 *   • medwiki-service     → Port 4000 (MedWiki sync, decoupled from HMS)
 *
 * If MedWiki service crashes/restarts, HMS keeps working normally.
 *
 * Usage:
 *   pm2 start ecosystem.hostinger.config.js --production
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
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
      log_file: '/var/log/aethermed/hms-combined.log',
      out_file: '/var/log/aethermed/hms-out.log',
      error_file: '/var/log/aethermed/hms-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_log_size: '10M',
      log_retention_days: 7,
    },
    {
      name: 'medwiki-service',
      script: 'node',
      args: 'services/medwiki/server.js',
      cwd: '/home/user/hmsaas', // Change to your VPS path, e.g. /var/www/hmsaas
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        // MedWiki remote API (set your MedWiki endpoint)
        MEDWIKI_API_BASE_URL: 'https://api.medwiki.example.com',
        MEDWIKI_API_KEY: '', // your MedWiki API key
        // HMS sync webhook
        HMS_SYNC_URL: 'http://localhost:3000/api/medicines/sync',
        HMS_SYNC_KEY: '', // match MEDWIKI_SYNC_API_KEY in HMS .env
        // GLM free API (Z.AI / Zhipu AI) — generates medicine instructions
        GLM_API_KEY: '', // your Z.ai API key (free tier: glm-4.7-flash)
        GLM_API_BASE: 'https://api.z.ai/api/paas/v4',
        // Sync interval (default 30 min)
        SYNC_INTERVAL_MS: '1800000',
      },
      log_file: '/var/log/aethermed/medwiki-combined.log',
      out_file: '/var/log/aethermed/medwiki-out.log',
      error_file: '/var/log/aethermed/medwiki-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_log_size: '10M',
      log_retention_days: 7,
    },
  ],
}
