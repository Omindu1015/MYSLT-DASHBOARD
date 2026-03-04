# 🚀 MySLT Dashboard: Production Deployment

This guide provides the complete, end-to-end instructions for deploying the MySLT Monitoring Ecosystem. It covers central dashboard hosting (MERN) and remote agent setup (SNMP + Fluent Bit) for Windows and Rocky Linux.

---

## ⚙️ Configuration Variables (Update These!)

Before starting, identify your IP addresses. Replace placeholders in the scripts below with your actual values:

- **`DASHBOARD_IP`**: The IP of your new Rocky Linux Dashboard Server (e.g., `192.168.100.137`).
- **`MONITORED_LINUX_IP`**: The IP of your remote Rocky Linux application server.
- **`MONITORED_WIN_IP`**: The IP of your remote Windows application server.

---

## 🏗️ Architecture Overview

- **Central Dashboard Server (Rocky Linux)**: Hosts the React frontend, Node.js backend, and MongoDB.
- **Remote Monitored Servers (Windows & Rocky)**:
    - **Infrastructure Metrics**: Gathered via **SNMP** (UDP 161) by the Dashboard.
    - **Log Streaming**: Pushed via **Fluent Bit** (TCP 5001) to the Dashboard.

---

## 🏁 Phase 1: Central Dashboard Hosting (Rocky Linux)

### 1.1 Base Environment Setup
SSH into your new Rocky Linux dashboard server and install dependencies:
```bash
# Update and install Node.js, MongoDB, and Nginx
sudo dnf update -y
sudo dnf install -y nodejs npm nginx

# Install MongoDB (Requires adding the MongoDB repo)
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod

# Install PM2 globally
sudo npm install -g pm2
```

### 1.2 Backend Deployment
```bash
cd /var/www/MYSLT-DASHBOARD/Server
npm install --production
pm2 start src/server.js --name myslt-backend
```

### 1.3 Frontend Deployment (Nginx)
1. **Build the production assets**:
   ```bash
   cd /var/www/MYSLT-DASHBOARD/client
   npm install
   npm run build
   ```
2. **Configure Nginx**:
   Edit `/etc/nginx/sites-available/default`:
   ```nginx
   server {
       listen 80;
       server_name _;

       root /var/www/MYSLT-DASHBOARD/client/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api {
           proxy_pass http://localhost:5001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
3. **SELinux & Firewall Configuration (Mandatory for Rocky Linux)**:
   Apply these permissions to ensure Nginx can serve files and connect to the backend:
   ```bash
   # Set SELinux contexts for the frontend build
   sudo chcon -Rt httpd_sys_content_t /var/www/MYSLT-DASHBOARD/client/dist
   
   # Allow Nginx to connect to the backend (Port 5001)
   sudo setsebool -P httpd_can_network_connect 1
   
   # Open Firewall ports (80/443 for web, 5001 for log ingest)
   sudo firewall-cmd --add-service={http,https} --permanent
   sudo firewall-cmd --add-port=5001/tcp --permanent
   sudo firewall-cmd --reload
   
   sudo systemctl restart nginx
   ```

---

## 📈 Phase 2: Infrastructure Metrics (SNMP)

### 2.1 Rocky Linux Setup
```bash
sudo dnf install -y net-snmp net-snmp-utils
sudo systemctl enable --now snmpd
# Configure /etc/snmp/snmpd.conf with 'rocommunity public'
# Firewall:
sudo firewall-cmd --add-service=snmp --permanent
sudo firewall-cmd --reload
```

### 2.2 Windows Server Setup
1. **Enable Feature**: `Server Manager` > `Add Features` > `SNMP Service`.
2. **Configure**: `Services.msc` > `SNMP Service` Properties > `Security`.
    - Add "public" (Read Only).
    - List authorized manager IP (.137).
3. **Firewall**: Allow UDP 161.

---

## 🪵 Phase 3: Log Streaming (Fluent Bit)

### 3.1 Rocky Linux Setup
```bash
# Add Fluent Bit repo
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

#### Configure Fluent Bit:
1. Copy `fluent-bit-linux.conf` to `/etc/fluent-bit/fluent-bit.conf`.
2. **Crucial**: Edit `/etc/fluent-bit/fluent-bit.conf` and update the `Host` to your `DASHBOARD_IP`:
   ```ini
   [OUTPUT]
       Name          http
       Match         myslt.logs
       Host          <DASHBOARD_IP>  # Put your new Rocky Dashboard IP here
       Port          5001
       URI           /api/logs/ingest/stream
   ```

### 3.2 Windows Server Setup
1. **Install**: Use the MSI installer from [fluentbit.io](https://fluentbit.io).
2. **Configure**: Place `fluent-bit-windows.conf` in `C:\Program Files\fluent-bit\conf\`.
3. **Crucial**: Edit `fluent-bit.conf` and update the `Host` and `Header` to your `DASHBOARD_IP`:
   ```ini
   [OUTPUT]
       Name          http
       Host          <DASHBOARD_IP>  # Put your new Rocky Dashboard IP here
       Port          5001
       URI           /api/logs/ingest/stream
       Header        x-server-id <LOCAL_SERVER_IP> # The IP of this Windows Server
   ```
4. **Service**:
   ```cmd
   sc create MySLT-Fluent-Bit binPath= "\"C:\Program Files\fluent-bit\bin\fluent-bit.exe\" -c \"C:\Program Files\fluent-bit\conf\fluent-bit.conf\"" start= auto
   net start MySLT-Fluent-Bit
   ```

---

## 🔒 Security & Ports Matrix

| Service | Port | Protocol | Source | Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Web UI** | 80/443 | TCP | Any | Dashboard (.137) |
| **Log Ingest**| 5001 | TCP | Remote Agents | Dashboard (.137) |
| **SNMP Query**| 161 | UDP | Dashboard (.137) | Remote Servers |
| **MongoDB** | 27017 | TCP | Localhost | Dashboard (.137) |

---
**Happy Monitoring!** 🚀
