# 🛠️ MySLT Monitoring: Prerequisite Installation Guide

This guide contains all the commands needed to prepare a fresh server (**RHEL**, **Rocky Linux**, or **Windows**) for the MySLT Monitoring Ecosystem.

> [!NOTE]
> **For Red Hat (RHEL) Users:** Ensure your server is registered with an active subscription using `sudo subscription-manager register`.

---

## 🖥️ 1. Dashboard Server (RHEL / Rocky Linux)

Run these commands on the server that will host the central dashboard.

### 1.1 Base Environment & EPEL
```bash
# Update system
sudo dnf update -y

# Enable EPEL Repository (Often required for extra packages on RHEL)
sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm

# Install Node.js, NPM, and Nginx
sudo dnf install -y nodejs npm nginx

# Install PM2 globally for process management
sudo npm install -g pm2
```

### 1.2 MongoDB 7.0 Installation
```bash
# Add MongoDB Repository
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

# Install and start MongoDB
sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod
```

### 1.3 SSL Certificate Setup (.pfx conversion)
If you have a `.pfx` certificate (e.g., from OpenSSL 1.1.1), use the `-legacy` flag for modern OpenSSL versions:

```bash
# 1. Create a secure directory for SSL
sudo mkdir -p /etc/nginx/ssl

# 2. Extract the private key
openssl pkcs12 -in your_cert.pfx -nocerts -out myslt_privkey.pem -nodes -legacy

# 3. Extract the full certificate chain
openssl pkcs12 -in your_cert.pfx -nokeys -out myslt_fullchain.pem -legacy

# 4. Move to Nginx SSL directory
sudo mv myslt_privkey.pem myslt_fullchain.pem /etc/nginx/ssl/
```

### 1.4 Firewall & Security
```bash
# Allow Nginx to connect to the backend API (Port 5001)
sudo setsebool -P httpd_can_network_connect 1

# Open Web and Log Ingestion ports
sudo firewall-cmd --add-service={http,https} --permanent
sudo firewall-cmd --add-port=5001/tcp --permanent
sudo firewall-cmd --reload
```

---

## 📈 2. Monitored Server: RHEL / Rocky Linux

### 2.1 Infrastructure Metrics (SNMP)
```bash
sudo dnf install -y net-snmp net-snmp-utils
sudo systemctl enable --now snmpd
sudo firewall-cmd --add-service=snmp --permanent
sudo firewall-cmd --reload
```

### 2.2 Log Streaming (Fluent Bit)
```bash
# Add Fluent Bit Repo & Install
sudo tee /etc/yum.repos.d/fluent-bit.repo <<EOF
[fluent-bit]
name = Fluent Bit
baseurl = https://packages.fluentbit.io/centos/7/\$basearch/
gpgcheck = 1
gpgkey = https://packages.fluentbit.io/fluent-bit.gpg
enabled = 1
EOF

sudo dnf install -y fluent-bit
sudo systemctl enable --now fluent-bit
```

> [!TIP]
> **Self-Monitoring:** If you want the dashboard server to monitor itself, run these steps (2.1 and 2.2) on the dashboard server as well.

---

## 🪟 3. Monitored Server: Windows

### 3.1 SNMP Features (PowerShell)
```powershell
Install-WindowsFeature -Name SNMP-Service,SNMP-WMI-Provider
New-NetFirewallRule -DisplayName "SNMP-In" -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow
```

### 3.2 Fluent Bit
1. **MSI Installer**: [fluentbit.io](https://fluentbit.io)
2. **Register Service**:
```cmd
sc create MySLT-Fluent-Bit binPath= "\"C:\Program Files\fluent-bit\bin\fluent-bit.exe\" -c \"C:\Program Files\fluent-bit\conf\fluent-bit.conf\"" start= auto
net start MySLT-Fluent-Bit
```

---

## 📝 Final Nginx Configuration Template
Save this to `/etc/nginx/conf.d/myslt.conf`:

```nginx
server {
    listen 80;
    server_name dpdlab1.slt.lk; # Replace with your domain
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name dpdlab1.slt.lk; # Replace with your domain

    ssl_certificate     /etc/nginx/ssl/myslt_fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/myslt_privkey.pem;

    location / {
        root /var/www/MYSLT-DASHBOARD/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
