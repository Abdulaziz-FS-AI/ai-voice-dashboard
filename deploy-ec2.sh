#!/bin/bash

# Voice Matrix - EC2 Deployment Script
# Run this script on your EC2 instance

echo "🚀 Starting Voice Matrix deployment on EC2..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Create application directory
sudo mkdir -p /var/www/voice-matrix
sudo chown -R $USER:$USER /var/www/voice-matrix

echo "✅ EC2 setup completed!"
echo "📁 Now upload your project files to /var/www/voice-matrix/"
echo "🔄 Then run: cd /var/www/voice-matrix && chmod +x setup-app.sh && ./setup-app.sh"