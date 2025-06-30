
# VPN Bot VPS Deployment Guide

## Prerequisites
- Ubuntu/Debian VPS with root access
- GitHub repository with your bot code
- PuTTY or SSH client for Windows

## Step 1: Connect to Your VPS
```bash
# Using PuTTY or terminal
ssh root@your-vps-ip
# or
ssh username@your-vps-ip
```

## Step 2: Run the Automated Setup
```bash
# Download and run the setup script
wget https://raw.githubusercontent.com/yourusername/yourrepo/main/vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

## Step 3: Manual Setup (Alternative)
If you prefer manual setup:

### 3.1 Install Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3.2 Install PM2
```bash
sudo npm install -g pm2
```

### 3.3 Install Git
```bash
sudo apt install -y git
```

### 3.4 Clone Your Repository
```bash
mkdir -p /home/$(whoami)/vpn-bot
cd /home/$(whoami)/vpn-bot
git clone https://github.com/yourusername/yourrepo.git .
```

### 3.5 Install Dependencies
```bash
npm install
```

### 3.6 Set Environment Variables
```bash
nano .env
```
Add:
```
BOT_TOKEN=your_actual_bot_token
ADMIN_ID=your_telegram_user_id
KPAY_NUMBER=your_kpay_number
WAVE_NUMBER=your_wave_number
PORT=3000
```

### 3.7 Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 4: Set Up Auto-Sync (GitHub Integration)
```bash
# Make auto-sync script executable
chmod +x auto-sync.sh

# Add to crontab (every 5 minutes)
crontab -e
# Add this line:
*/5 * * * * /home/$(whoami)/vpn-bot/auto-sync.sh
```

## Step 5: Verify Everything is Working

### Check Bot Status
```bash
pm2 status
pm2 logs vpn-bot
```

### Check Auto-Sync Logs
```bash
tail -f /home/$(whoami)/vpn-bot/logs/sync.log
```

### Test Bot
Send `/start` to your Telegram bot

## Useful Commands

### PM2 Commands
```bash
pm2 status                # Check status
pm2 logs vpn-bot         # View logs
pm2 restart vpn-bot      # Restart bot
pm2 stop vpn-bot         # Stop bot
pm2 delete vpn-bot       # Remove bot
pm2 monit                # Monitor performance
```

### System Commands
```bash
htop                     # System monitor
df -h                    # Disk usage
free -h                  # Memory usage
```

### Log Files
```bash
# Bot logs
tail -f /home/$(whoami)/vpn-bot/logs/out.log
tail -f /home/$(whoami)/vpn-bot/logs/err.log

# Sync logs
tail -f /home/$(whoami)/vpn-bot/logs/sync.log
tail -f /home/$(whoami)/vpn-bot/logs/sync-error.log
```

## Troubleshooting

### Bot Not Starting
1. Check environment variables: `cat .env`
2. Check logs: `pm2 logs vpn-bot`
3. Test manually: `node index.js`

### Auto-Sync Not Working
1. Check cron job: `crontab -l`
2. Check sync logs: `cat logs/sync.log`
3. Test manually: `./auto-sync.sh`

### Memory Issues
1. Check memory: `free -h`
2. Restart bot: `pm2 restart vpn-bot`
3. Check for memory leaks in logs

## Security Recommendations
1. Use non-root user for running the bot
2. Set up firewall: `ufw enable`
3. Regular system updates: `apt update && apt upgrade`
4. Monitor logs regularly
5. Use strong passwords and SSH keys

## Backup Strategy
```bash
# Backup bot data
tar -czf vpn-bot-backup-$(date +%Y%m%d).tar.gz /home/$(whoami)/vpn-bot

# Backup environment variables
cp .env .env.backup
```

Your VPN bot is now running 24/7 on your VPS with automatic GitHub sync every 5 minutes!
