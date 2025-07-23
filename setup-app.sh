#!/bin/bash

# Voice Matrix - Application Setup Script
# Run this AFTER uploading your files to EC2

echo "🔧 Setting up Voice Matrix application..."

# Install dependencies
npm install

# Install serve globally to serve static files
sudo npm install -g serve

# Build the application for production (without GitHub Pages config)
export PUBLIC_URL=""
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'voice-matrix',
    script: 'serve',
    args: '-s build -l 3000',
    cwd: '/var/www/voice-matrix',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Setup Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/voice-matrix 2>/dev/null || echo "⚠️  Copy nginx.conf manually"
sudo ln -sf /etc/nginx/sites-available/voice-matrix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Start the application
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Restart Nginx
sudo nginx -t && sudo systemctl restart nginx

echo "✅ Voice Matrix is now running!"
echo "🌐 Access your app at: http://$(curl -s http://checkip.amazonaws.com/)"
echo "📊 Monitor with: pm2 monit"