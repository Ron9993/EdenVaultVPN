
#!/bin/bash

# VPS Auto-Sync Script for VPN Bot
BOT_DIR="/home/$(whoami)/vpn-bot"
LOG_FILE="$BOT_DIR/logs/sync.log"
ERROR_LOG="$BOT_DIR/logs/sync-error.log"

# Create logs directory if it doesn't exist
mkdir -p "$BOT_DIR/logs"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to log errors
log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a $ERROR_LOG
    log "ERROR: $1"
}

# Check if bot directory exists
if [ ! -d "$BOT_DIR" ]; then
    log_error "Bot directory not found: $BOT_DIR"
    exit 1
fi

# Change to bot directory
cd $BOT_DIR || {
    log_error "Failed to change to bot directory"
    exit 1
}

# Check if git repository
if [ ! -d ".git" ]; then
    log_error "Not a git repository"
    exit 1
fi

# Check for updates
log "Checking for GitHub updates..."

# Fetch with timeout
timeout 30 git fetch origin 2>/dev/null
if [ $? -ne 0 ]; then
    log_error "Failed to fetch from origin (timeout or network error)"
    exit 1
fi

# Check if there are updates
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    log_error "Failed to get git revision information"
    exit 1
fi

if [ "$LOCAL" != "$REMOTE" ]; then
    log "Updates found! Pulling changes..."
    
    # Stash any local changes
    git stash push -u -m "Auto-stash before sync $(date)"
    
    # Pull latest changes
    if git pull origin main; then
        log "Successfully pulled updates"
        
        # Install any new dependencies
        log "Installing dependencies..."
        if npm install --production; then
            log "Dependencies installed successfully"
        else
            log_error "Failed to install dependencies"
        fi
        
        # Check if PM2 process exists
        if pm2 list | grep -q "vpn-bot"; then
            log "Restarting bot with PM2..."
            if pm2 restart vpn-bot; then
                log "Bot restarted successfully"
                
                # Wait and check if bot is running
                sleep 5
                if pm2 list | grep -q "vpn-bot.*online"; then
                    log "Bot is running successfully after restart"
                else
                    log_error "Bot failed to start after restart"
                    pm2 logs vpn-bot --lines 10 >> $ERROR_LOG
                fi
            else
                log_error "Failed to restart bot with PM2"
            fi
        else
            log "Starting bot with PM2 (not running)..."
            if pm2 start ecosystem.config.js; then
                log "Bot started successfully"
            else
                log_error "Failed to start bot with PM2"
            fi
        fi
    else
        log_error "Failed to pull updates from origin"
        git stash pop 2>/dev/null || log "No stash to restore"
    fi
else
    log "No updates available"
fi

# Clean up log files (keep last 500 lines)
if [ -f "$LOG_FILE" ]; then
    tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

if [ -f "$ERROR_LOG" ]; then
    tail -n 200 "$ERROR_LOG" > "$ERROR_LOG.tmp" && mv "$ERROR_LOG.tmp" "$ERROR_LOG"
fi

log "Auto-sync completed"
