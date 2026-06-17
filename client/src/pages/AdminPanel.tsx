import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Clock, GitBranch, Trash2, Save, Plus, X } from 'lucide-react';
import { serverHealthApi } from '../services/api';

interface ServerItem {
  ip: string;
  os: 'windows' | 'linux';
  cpu: number;
  ram: number;
  disk: number;
  uptime: string;
  networkData: { time: string; value: number }[];
}

export function AdminPanel() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Server Management
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [newServerIP, setNewServerIP] = useState('');
  const [newServerOS, setNewServerOS] = useState<'windows' | 'linux'>('windows');
  
  // Auto Refresh Settings
  const [refreshRates, setRefreshRates] = useState({
    dashboard: 30,
    liveTraffic: 5,
    charts: 30
  });
  
  // Access Methods - Auto-detected from logs (no manual management needed)

  useEffect(() => {
    // Check authentication
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus !== 'true') {
      navigate('/');
      return;
    }
    setIsAuthenticated(true);

    // Fetch servers from backend
    fetchServers();

    // Load refresh rates
    const savedRates = localStorage.getItem('myslt-refresh-rates');
    if (savedRates) {
      setRefreshRates(JSON.parse(savedRates));
    }
  }, [navigate]);

  const fetchServers = async () => {
    try {
      const response = await serverHealthApi.getAllServers();
      if (response.success && response.data) {
        const transformedServers = response.data.map((server: any) => ({
          ip: server.serverIp,
          os: server.osType || 'linux' as 'windows' | 'linux',  // Use actual osType from API
          cpu: server.cpuUtilization,
          ram: server.ramUsage,
          disk: server.diskSpace,
          uptime: server.uptime,
          networkData: Array.from({ length: 20 }, (_, i) => ({
            time: `${i * 2}h`,
            value: Math.floor(Math.random() * 100)
          }))
        }));
        setServers(transformedServers);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const handleAddServer = async () => {
    if (!newServerIP.trim()) {
      alert('Please enter a valid IP address');
      return;
    }

    // Check for duplicates
    if (servers.some(s => s.ip === newServerIP)) {
      alert('Server with this IP already exists');
      return;
    }

    try {
      setShowAddServerModal(false);
      alert('Adding server... This may take a few seconds while fetching SNMP data.');
      
      // Call SNMP API to add server with real data
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/server-health/snmp/add', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serverIp: newServerIP,
          community: 'public'
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('Server added successfully with real SNMP data!');
        await fetchServers();
        window.dispatchEvent(new Event('serversUpdated'));
        setNewServerIP('');
      } else {
        alert(`Failed to add server: ${result.message}\n\nMake sure SNMP is enabled on the server.`);
        setShowAddServerModal(true);
      }
    } catch (error) {
      console.error('Error adding server:', error);
      alert('Error adding server. Make sure the backend server is running.');
      setShowAddServerModal(true);
    }
  };

  const handleDeleteServer = async (ip: string) => {
    if (!confirm(`Are you sure you want to remove server ${ip}?`)) {
      return;
    }

    try {
      // Call backend API to delete server
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/server-health/${ip}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Server deleted successfully!');
        await fetchServers();
        window.dispatchEvent(new Event('serversUpdated'));
      } else {
        alert('Failed to delete server');
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      alert('Error deleting server. Make sure the backend server is running.');
    }
  };

  const handleSaveRefreshRates = () => {
    localStorage.setItem('myslt-refresh-rates', JSON.stringify(refreshRates));
    alert('Refresh rates saved successfully!');
    
    // Dispatch event to notify components
    window.dispatchEvent(new CustomEvent('refreshRatesChanged', { detail: refreshRates }));
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-slate-400">Manage system settings and configurations</p>
        </div>

        {/* Server Management Section */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-3">
              <Server className="text-blue-500" size={24} />
              <h2 className="text-xl font-bold text-white">Server Management</h2>
            </div>
            <button
              onClick={() => setShowAddServerModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Server
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server) => (
              <div key={server.ip} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server size={18} className="text-cyan-400" />
                    <span className="text-white font-semibold">{server.ip}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteServer(server.ip)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>OS:</span>
                    <span className="font-medium text-white">{server.os === 'windows' ? 'Windows' : 'Linux'}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>CPU:</span>
                    <span className="font-medium text-white">{server.cpu}%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>RAM:</span>
                    <span className="font-medium text-white">{server.ram}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto Refresh Settings */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="text-green-500" size={24} />
            <h2 className="text-xl font-bold text-white">Auto Refresh Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Dashboard Refresh (seconds)
              </label>
              <input
                type="number"
                value={refreshRates.dashboard}
                onChange={(e) => setRefreshRates({ ...refreshRates, dashboard: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                min="5"
                max="300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Live Traffic Refresh (seconds)
              </label>
              <input
                type="number"
                value={refreshRates.liveTraffic}
                onChange={(e) => setRefreshRates({ ...refreshRates, liveTraffic: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                min="1"
                max="60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Charts Refresh (seconds)
              </label>
              <input
                type="number"
                value={refreshRates.charts}
                onChange={(e) => setRefreshRates({ ...refreshRates, charts: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                min="10"
                max="300"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleSaveRefreshRates}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Save size={18} />
              Save Refresh Settings
            </button>
          </div>
        </div>

        {/* Access Methods - Auto-Detected from Logs */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <GitBranch className="text-purple-500" size={24} />
            <h2 className="text-xl font-bold text-white">Access Methods</h2>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <p className="text-slate-300 mb-2">
              ℹ️ Access methods are automatically detected from your API logs
            </p>
            <p className="text-slate-400 text-sm">
              The system reads the access method field (MOBILE, WEB, CHATBOT, etc.) from your log entries and displays them in the dashboard automatically. No manual configuration needed.
            </p>
            <p className="text-slate-400 text-sm mt-2">
              <strong>Log Format:</strong> startTimestamp,<strong className="text-purple-400">ACCESS_METHOD</strong>,email,status,apiNumber,...
            </p>
          </div>
        </div>
      </div>

      {/* Add Server Modal */}
      {showAddServerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Add Server</h3>
              <button
                onClick={() => {
                  setShowAddServerModal(false);
                  setNewServerIP('');
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Server IP Address
                </label>
                <input
                  type="text"
                  value={newServerIP}
                  onChange={(e) => setNewServerIP(e.target.value)}
                  placeholder="e.g., 192.168.1.1"
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Operating System
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewServerOS('windows')}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                      newServerOS === 'windows'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Windows
                  </button>
                  <button
                    onClick={() => setNewServerOS('linux')}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                      newServerOS === 'linux'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Linux
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddServer}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Add Server
                </button>
                <button
                  onClick={() => {
                    setShowAddServerModal(false);
                    setNewServerIP('');
                  }}
                  className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
