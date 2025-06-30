
#!/bin/bash

# VPS Auto-Sync Script for VPN Bot
LOG_FILE="/home/$(whoami)/vpn-bot/sync.log"
BOT_DIR="/home/$(whoami)/vpn-bot"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Change to bot directory
cd $BOT_DIR

# Check for updates
log "Checking for GitHub updates..."
git fetch origin

# Check if there are updates
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ $LOCAL != $REMOTE ]; then
    log "Updates found! Pulling changes..."
    
    # Pull latest changes
    git pull origin main
    
    if [ $? -eq 0 ]; then
        log "Successfully pulled updates"
        
        # Install any new dependencies
        npm install
        
        # Restart the bot with PM2
        pm2 restart vpn-bot
        
        if [ $? -eq 0 ]; then
            log "Bot restarted successfully"
        else
            log "ERROR: Failed to restart bot"
        fi
    else
        log "ERROR: Failed to pull updates"
    fi
else
    log "No updates available"
fi

# Keep only last 100 log entries
tail -n 100 $LOG_FILE > $LOG_FILE.tmp && mv $LOG_FILE.tmp $LOG_FILE
