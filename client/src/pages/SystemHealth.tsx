 
import { useState, useEffect } from 'react';
import { ServerCard } from '../components/ServerCard';
import { serverHealthApi } from '../services/api';

interface Server {
  ip: string;
  cpu: number;
  ram: number;
  disk: number;
  uptime: string;
  networkData: number[];
  networkTraffic: number;
  os: 'windows' | 'linux';
}

export function SystemHealth() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate unique network traffic pattern for each server
  const generateNetworkData = (traffic: number, serverIp: string): number[] => {
    // Use server IP as seed for consistent but unique patterns
    const seed = serverIp.split('.').reduce((sum, octet) => sum + parseInt(octet), 0);
    const baseValue = Math.min(100, Math.max(20, traffic / 100)); // Scale traffic to reasonable chart values
    
    const data: number[] = [];
    for (let i = 0; i < 12; i++) {
      // Create wave pattern with some randomness based on seed
      const wave = Math.sin((i + seed) * 0.5) * 15;
      const variation = ((seed * i * 7) % 20) - 10; // Pseudo-random variation
      const value = Math.max(5, Math.min(100, baseValue + wave + variation));
      data.push(Math.round(value));
    }
    return data;
  };

  // Fetch servers from backend
  const fetchServers = async () => {
    try {
      const response = await serverHealthApi.getAllServers();
      if (response.success && response.data) {
        // Transform backend data to frontend format
        const transformedServers = response.data.map((server: any) => ({
          ip: server.serverIp,
          cpu: server.cpuUtilization,
          ram: server.ramUsage,
          disk: server.diskSpace,
          uptime: server.uptime,
          networkTraffic: server.networkTraffic || 0,
          networkData: generateNetworkData(server.networkTraffic || 0, server.serverIp),
          os: server.osType || 'linux' as 'windows' | 'linux'  // Use actual osType from API
        }));
        setServers(transformedServers);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchServers();
  }, []);

  // Auto-refresh with configurable interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';

    const setupInterval = (refresh: string) => {
      if (intervalId) clearInterval(intervalId);
      
      if (refresh === 'off' || refresh === 'Off') {
        intervalId = null;
      } else {
        const ms = refresh === '30s' ? 30000 : refresh === '1m' ? 60000 : refresh === '5m' ? 300000 : 30000;
        intervalId = setInterval(fetchServers, ms);
      }
    };

    setupInterval(currentRefresh);

    const handleAutoRefreshChange = (event: any) => {
      const { autoRefresh } = event.detail || {};
      if (autoRefresh) {
        currentRefresh = autoRefresh;
        setupInterval(autoRefresh);
      }
    };

    window.addEventListener('autoRefreshChanged', handleAutoRefreshChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('autoRefreshChanged', handleAutoRefreshChange);
    };
  }, []);

  // Reload servers when changed in admin panel
  useEffect(() => {
    const handleReload = () => {
      fetchServers();
    };
    window.addEventListener('serversUpdated', handleReload);
    return () => window.removeEventListener('serversUpdated', handleReload);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white text-xl">Loading servers...</div>
      </div>
    );
  }

  return <div className="space-y-6">
      <div className="bg-blue-600 rounded-2xl p-6 sm:p-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            System Health Monitoring
          </h2>
          <p className="text-blue-100">
            Real-time monitoring of all production servers (Auto-refresh every 30s)
          </p>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-lg mb-4">No servers added yet</p>
          <p className="text-slate-500">Add servers via Admin Panel to start monitoring</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {servers.map(server => (
            <ServerCard 
              key={server.ip} 
              {...server}
              onRefresh={() => fetchServers()}
            />
          ))}
        </div>
      )}
    </div>;
}
