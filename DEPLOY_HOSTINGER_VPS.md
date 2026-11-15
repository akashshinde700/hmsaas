# 🚀 AetherMed HMS — Hostinger VPS Deployment Guide

HMS को Hostinger VPS पर live करने के लिए step-by-step गाइड। MedWiki sync crash न हो, इसका पूरा ध्यान रखा गया है।

---

## 📋 Prerequisites

Hostinger VPS पर निम्न इंस्टॉल करें:

```bash
# SSH में कनेक्ट करें
ssh root@your-vps-ip

# System update
apt update && apt upgrade -y

# Node.js 18+ install
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# PM2 globally
npm install -g pm2

# SQLite (Prisma adapter)
apt-get install -y libsqlite3-dev

# Git
apt-get install -y git

# Nginx (reverse proxy)
apt-get install -y nginx

# Log directory
mkdir -p /var/log/aethermed
```

---

## 📦 Project Deploy

```bash
# Clone repo
git clone https://github.com/akashshinde700/hmsaas.git /var/www/hmsaas
cd /var/www/hmsaas

# Checkout production branch
git checkout arena/be419f7a-hmsaas

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Setup database (first time only)
npm run db:setup

# Build for production
npm run build
```

---

## ⚙️ Environment Variables

`.env` फाइल बनाएँ (Hostinger VPS पर):

```env
# Database
DATABASE_URL="file:./prisma/hmsaas.db"

# App
NEXTAUTH_SECRET="your-32-char-random-secret"
NEXTAUTH_URL="https://your-domain.com"
BASE_URL="https://your-domain.com"

# Port
PORT=3000
HOST=0.0.0.0

# MedWiki Sync — Crash-proof remote sync
MEDWIKI_API_BASE_URL="https://your-medwiki-server.com"
MEDWIKI_API_KEY="your-medwiki-api-key"

# MedWiki Sync Webhook (for external MedWiki to push data)
MEDWIKI_SYNC_API_KEY="mwk_live_your_secret_key_here"

# Cron Secret (protect /api/cron/medwiki-sync)
MEDWIKI_CRON_SECRET="cron_secret_change_this"

# Platform Admin
PLATFORM_ADMIN_EMAIL="aetherdevsolutions@gmail.com"
PLATFORM_ADMIN_PASSWORD="Admin@123"
```

`NEXTAUTH_SECRET` generate करें:
```bash
openssl rand -base64 32
```

---

## 🔄 PM2 Start (Crash-Proof)

```bash
# Copy ecosystem file
cp ecosystem.hostinger.config.js /var/www/hmsaas/

# Start with PM2
cd /var/www/hmsaas
pm2 start ecosystem.hostinger.config.js --production

# Save PM2 process list
pm2 save

# Auto-start on server reboot
pm2 startup
# Follow the command it prints to enable startup
```

**HMS अब Port 3000 पर live है।**

---

## 📊 MedWiki Sync Setup (नहीं क्रैश होगा)

MedWiki से दवाओं का डेटा ऑटोमैटिक आना चाहिए। यह crash-proof है:

### Circuit Breaker
अगर MedWiki server 5 बार लगातार फेल होता है, तो sync 1 मिनट के लिए रुक जाता है। फिर एक बार ट्राई करता है।

### Per-Item Isolation
एक दवा की वजह से पूरा बैच फेल नहीं होता। बाकी दवाएं sync होती रहती हैं।

### Timeout Guard
हर API call का 10 सेकंड टाइमआउट है। देर होने पर रिक्वेस्ट कैंसल हो जाती है।

---

### Cron Job सेटअप (हर 30 मिनट में sync)

Hostinger VPS पर crontab में जोड़ें:

```bash
crontab -e
```

यह लाइन add करें:

```cron
*/30 * * * * curl -s -H "x-cron-secret: your_cron_secret" https://your-domain.com/api/cron/medwiki-sync
```

या External Cron Service (cron-job.org) से:

```
URL: https://your-domain.com/api/cron/medwiki-sync
Method: GET
Header: x-cron-secret: your_cron_secret
Interval: Every 30 minutes
```

### मैनुअल Sync (Platform Admin से)

Platform Admin लॉगिन करके:
1. `/platform-admin` पर जाएँ
2. MedWiki सेक्शन में "Run Sample Delta" बटन दबाएँ
3. 10 सैंपल दवाएं instructions के साथ add होंगी

---

## 🌐 Nginx Reverse Proxy (SSL + Port 80/443)

```nginx
# /etc/nginx/sites-available/hmsaas
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# SSL के लिए Certbot:
# certbot --nginx -d your-domain.com
```

साइट enable करें:
```bash
ln -s /etc/nginx/sites-available/hmsaas /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 🛠️ Useful PM2 Commands

```bash
# Logs देखें
pm2 logs aethermed-hms --lines 50

# Status देखें
pm2 status

# Restart करें
pm2 restart aethermed-hms

# Stop करें
pm2 stop aethermed-hms

# Delete करें
pm2 delete aethermed-hms

# Monitor (CPU/RAM)
pm2 monit
```

---

## 🚨 अगर MedWiki Sync Crash हो जाए

PM2 ऑटो-रिस्टार्ट करेगा। अगर बार-बार क्रैश हो:

```bash
# Circuit breaker रीसेट के लिए सर्वर रिस्टार्ट करें
pm2 restart aethermed-hms

# मैनुअल sync ट्राई करें
curl -X POST https://your-domain.com/api/medicines/sync \
  -H "Content-Type: application/json" \
  -H "x-medwiki-key: your_medwiki_sync_key" \
  -d '{"medicines":[],"triggerSource":"manual_recovery"}'
```

---

## ✅ Demo Credentials (Production में change करें)

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | aetherdevsolutions@gmail.com | Admin@123 |
| Hospital Admin | admin@sahyadrihospitalpune.in | Sahyadri@123 |
| Doctor | ananya.kulkarni@sahyadrihospitalpune.in | Doctor@123 |

---

## 📝 What's New in This Deploy

1. **MedWiki Instructions** — हर दवा के साथ `defaultInstructions` save होता है (English/हिन्दी/मराठी)
2. **Crash-Proof Sync** — Circuit breaker + retries + timeouts
3. **Cron Sync** — हर 30 मिनट में ऑटो-सync
4. **PM2 Auto-Restart** — अगर प्रोसेस क्रैश हो तो खुद शुरू होगा
