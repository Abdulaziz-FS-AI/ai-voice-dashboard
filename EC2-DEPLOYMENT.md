# 🚀 Voice Matrix - EC2 Deployment Guide

## Prerequisites
- AWS EC2 instance (Ubuntu 20.04 or later)
- Security group allowing ports 22, 80, 443
- SSH access to your EC2 instance

## Step 1: Prepare Your EC2 Instance

SSH into your EC2 instance and run:

```bash
wget https://raw.githubusercontent.com/Abdulaziz-FS-AI/ai-voice-dashboard/main/deploy-ec2.sh
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

## Step 2: Upload Your Project Files

### Option A: Using Git (Recommended)
```bash
cd /var/www/voice-matrix
git clone https://github.com/Abdulaziz-FS-AI/ai-voice-dashboard.git .
```

### Option B: Using SCP
From your local machine:
```bash
scp -r /Users/abdulaziz.f/Desktop/abdulaziz/2nd\ project/ai-voice-dashboard/* ubuntu@YOUR-EC2-IP:/var/www/voice-matrix/
```

## Step 3: Setup and Start the Application

```bash
cd /var/www/voice-matrix
chmod +x setup-app.sh
./setup-app.sh
```

## Step 4: Access Your Application

Your Voice Matrix dashboard will be available at:
```
http://YOUR-EC2-PUBLIC-IP
```

## 📊 Management Commands

### Check Application Status
```bash
pm2 status
pm2 monit
```

### View Logs
```bash
pm2 logs voice-matrix
```

### Restart Application
```bash
pm2 restart voice-matrix
```

### Update Application
```bash
cd /var/www/voice-matrix
git pull origin main
npm run build:ec2
pm2 restart voice-matrix
```

## 🔧 Troubleshooting

### If Nginx fails to start:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### If the app doesn't load:
```bash
pm2 logs voice-matrix
```

### Check if ports are open:
```bash
sudo ufw status
netstat -tulnp | grep :80
```

## 🔒 Security Notes

- Change default ports if needed
- Set up SSL certificate for HTTPS
- Configure proper firewall rules
- Regular security updates

## 🌐 Custom Domain Setup

1. Point your domain to EC2 IP
2. Update nginx.conf with your domain name
3. Install SSL certificate with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Your Voice Matrix dashboard is now live on EC2! 🎉