#!/bin/bash

# VPS Setup Script for VPN Bot
set -e

echo "🚀 VPN Bot VPS Setup Starting..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
echo "📥 Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Create directories
echo "📁 Creating directories..."
mkdir -p /home/$(whoami)/vpn-bot
mkdir -p /home/$(whoami)/vpn-bot/logs
cd /home/$(whoami)/vpn-bot

# Clone repository
echo "📥 Cloning repository..."
read -p "Enter your GitHub repository URL: " REPO_URL
git clone $REPO_URL .

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up environment variables
echo "🔐 Setting up environment variables..."
echo "Please enter your environment variables:"
read -p "BOT_TOKEN: " BOT_TOKEN
read -p "ADMIN_ID: " ADMIN_ID

# Create .env file
cat > .env << EOF
BOT_TOKEN=$BOT_TOKEN
ADMIN_ID=$ADMIN_ID
PORT=3000
EOF

echo "✅ Environment variables saved to .env"

# Start bot with PM2
echo "🚀 Starting bot with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $(whoami) --hp /home/$(whoami)

echo "🎉 VPS Setup Complete!"
echo ""
echo "📋 Your bot is now running!"
echo ""
echo "📊 Useful Commands:"
echo "pm2 status          - Check bot status"
echo "pm2 logs vpn-bot    - View bot logs"
echo "pm2 restart vpn-bot - Restart bot"
echo "pm2 stop vpn-bot    - Stop bot"
echo ""
echo "✅ Your VPN bot is ready for production!"