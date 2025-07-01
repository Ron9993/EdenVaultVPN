
# EdenVaultVPN Bot - VPS Deployment Guide

## Prerequisites
- Ubuntu/Debian VPS with root access
- GitHub repository with your bot code
- PuTTY or SSH client

## Quick Setup (Automated)

### Step 1: Connect to VPS
```bash
ssh root@your-vps-ip
```

### Step 2: Run Setup Script
```bash
wget https://raw.githubusercontent.com/yourusername/yourrepo/main/vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

## Manual Setup

### 1. Install Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2
```bash
sudo npm install -g pm2
```

### 3. Install Git
```bash
sudo apt install -y git
```

### 4. Clone Repository
```bash
mkdir -p /home/$(whoami)/edenvault-bot
cd /home/$(whoami)/edenvault-bot
git clone https://github.com/yourusername/yourrepo.git .
```

### 5. Install Dependencies
```bash
npm install
```

### 6. Configure Environment
```bash
nano .env
```
Add your environment variables:
```
BOT_TOKEN=your_bot_token
ADMIN_ID=your_telegram_id
US_OUTLINE_API=https://154.53.57.223:32987/W6Si53JA7hsJXZqMLsztAg
SG_OUTLINE_API=https://154.26.138.68:7127/h6bsFmcBWyN8O_0i6BBJiw
PORT=3000
```

### 7. Start Bot
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Monitoring & Management

### PM2 Commands
```bash
pm2 status               # Check status
pm2 logs edenvault-bot   # View logs
pm2 restart edenvault-bot # Restart
pm2 stop edenvault-bot   # Stop
pm2 delete edenvault-bot # Remove
pm2 monit               # Real-time monitoring
```

### Log Files
```bash
# Bot logs
tail -f logs/combined.log
tail -f logs/err.log
tail -f logs/out.log

# System monitoring
htop                    # CPU/Memory usage
df -h                   # Disk usage
free -h                 # Memory usage
```

## Auto-Sync Setup (Optional)

### Setup Auto-Sync
```bash
chmod +x auto-sync.sh
crontab -e
```

Add this line for sync every 5 minutes:
```
*/5 * * * * /home/$(whoami)/edenvault-bot/auto-sync.sh
```

## Bot Features

✅ **Multi-language Support** (English, Myanmar, Chinese)
✅ **Three VPN Plans** (Mini, Power, Ultra)
✅ **Dual Server Support** (US & Singapore)
✅ **Automatic Key Generation** with data limits
✅ **Payment Processing** via KPay/Wave
✅ **Admin Approval System**
✅ **QR Code Generation**
✅ **Health Check Server** (Port 3000)

## Troubleshooting

### Bot Not Starting
```bash
# Check logs
pm2 logs edenvault-bot

# Test manually
node index.js

# Check environment
cat .env
```

### Payment Issues
- Verify Outline API endpoints are accessible
- Check SSL certificate settings
- Ensure data limit calculations are correct

### Memory Issues
```bash
# Check memory usage
free -h

# Restart if needed
pm2 restart edenvault-bot
```

## Security

1. **Use non-root user** for bot execution
2. **Enable firewall**: `ufw enable`
3. **Regular updates**: `apt update && apt upgrade`
4. **Monitor logs** regularly
5. **Use strong passwords** and SSH keys

Your EdenVaultVPN bot is now optimized and ready for 24/7 operation! 🚀
