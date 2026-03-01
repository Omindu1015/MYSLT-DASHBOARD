# 🚀 Transition Guide: From Scripts to Fluent Bit

This guide explains how to safely stop the current agents and start using Fluent Bit for production-grade log shipping.

---

## 🐧 Linux (Server 113)

### 1. Stop the current agent
```bash
sudo systemctl stop log-agent
sudo systemctl disable log-agent
```

### 2. Install & Prepare Folder
Run this on **Server 113** to ensure the database folder exists with proper permissions:
```bash
sudo yum install fluent-bit -y
sudo mkdir -p /var/lib/fluent-bit/
sudo chmod 777 /var/lib/fluent-bit/
```

### 3. Deploy Configuration
Run these commands from your **Dashboard Server** (137) to copy the files safely:

```bash
# 1. Copy the main config
scp Scripts/fluent-bit-linux.conf dpd@192.168.100.113:/tmp/
ssh dpd@192.168.100.113 "sudo mv /tmp/fluent-bit-linux.conf /etc/fluent-bit/fluent-bit.conf"

# 2. Copy the parsers config
scp Scripts/parsers.conf dpd@192.168.100.113:/tmp/
ssh dpd@192.168.100.113 "sudo mv /tmp/parsers.conf /etc/fluent-bit/parsers.conf"
```

### 4. Optional: Start Log Simulator
If you want to generate test traffic, copy and run the simulator:
```bash
# Copy the simulator
scp Scripts/simulate-logs.sh dpd@192.168.100.113:/tmp/ && \
ssh dpd@192.168.100.113 "chmod +x /tmp/simulate-logs.sh && sudo mv /tmp/simulate-logs.sh /usr/local/bin/simulate-logs.sh"

# Run it (manual) - Point to the file Fluent Bit is watching
sudo /usr/local/bin/simulate-logs.sh /var/www/MYSLT-DASHBOARD/Server/filtered-log.txt
```

### 5. Start Fluent Bit
```bash
sudo systemctl enable fluent-bit
sudo systemctl start fluent-bit
```

---

## 🪟 Windows (Server 114)

### 1. Stop the current agent
Open **Administrator PowerShell** and run:
```powershell
Stop-ScheduledTask -TaskName "MySLT-Log-Agent"
Unregister-ScheduledTask -TaskName "MySLT-Log-Agent" -Confirm:$false
```

### 2. Install Fluent Bit
1.  **Check your Architecture**: Open PowerShell and run:
    ```powershell
    (Get-WmiObject -Class Win32_OperatingSystem).OSArchitecture
    ```
2.  **Download MSI**:
    - [Download 64-bit MSI](https://fluentbit.io/releases/4.2/fluent-bit-4.2.2-win64.msi) (Recommended for most)
    - [Download 32-bit MSI](https://fluentbit.io/releases/4.2/fluent-bit-4.2.2-win32.msi)
3.  Run the installer (defaults to `C:\Program Files\fluent-bit` on 64-bit).

### 3. Deploy Configuration
1.  Run these commands from your **Dashboard Server** (137) to copy the base files:
    ```bash
    scp Scripts/fluent-bit-windows.conf Administrator@192.168.100.114:"C:\Program Files\fluent-bit\conf\fluent-bit.conf"
    scp Scripts/parsers.conf Administrator@192.168.100.114:"C:\Program Files\fluent-bit\conf\parsers.conf"
    ```
2.  **CRITICAL**: Update your `parsers.conf` on the Windows machine to use the **Space-Separated** regex:
    ```ini
    [PARSER]
        Name        myslt_csv
        Format      regex
        Regex       ^(?<startTimestamp>\d+)\s+(?<accessMethod>\S+)\s+(?<customerEmail>\S+)\s+(?<status>\S+)\s+(?<apiNumber>\S+)\s+(?<endTimestamp>\d+)\s+(?<responseTime>\d+)$
        Types       responseTime:integer
    ```

### 4. Optional: Start Log Simulator
If you want to generate test traffic, copy and run the simulator:
```powershell
# Copy the simulator
scp Scripts/simulate-logs.ps1 Administrator@192.168.100.114:"C:\Program Files (x86)\fluent-bit\conf\simulate-logs.ps1"

# Run it (manual)
powershell -ExecutionPolicy Bypass -File "C:\Program Files (x86)\fluent-bit\conf\simulate-logs.ps1" -LogFilePath "C:\Logs\test.log"
```

### 5. Start Fluent Bit (as a Service)
PowerShell can be tricky with quotes and parentheses. For this step, it is easiest to use a standard **Command Prompt (CMD)**.

Open **Command Prompt (cmd.exe) as Administrator** and run:

```cmd
:: 1. Create the service (Spaces after = are REQUIRED)
sc create MySLT-Fluent-Bit binPath= "\"C:\Program Files (x86)\fluent-bit\bin\fluent-bit.exe\" -c \"C:\Program Files (x86)\fluent-bit\conf\fluent-bit.conf\"" start= auto

:: 2. Start the service
net start MySLT-Fluent-Bit
```

---

## 🔍 How to Verify
Check the Dashboard! Logs should start appearing immediately.
The tags in the Fluent Bit config are set to:
- Linux: `192.168.100.113`
- Windows: `192.168.100.114`

If you need to check Fluent Bit logs:
- Linux: `sudo journalctl -u fluent-bit -f`
- Windows: Check the Event Viewer or run `fluent-bit.exe` manually to see output.
