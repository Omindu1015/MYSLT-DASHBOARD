 
import { ServerIcon, RefreshCwIcon, Monitor, Trash2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis } from 'recharts';
interface ServerCardProps {
  ip: string;
  cpu: number;
  ram: number;
  disk: number;
  uptime: string;
  networkData: number[];
  networkTraffic?: number;
  os?: 'windows' | 'linux';
  onDelete?: () => void;
  onRefresh?: () => void;
}
export function ServerCard({
  ip,
  cpu,
  ram,
  disk,
  uptime,
  networkData,
  networkTraffic = 0,
  os = 'windows',
  onDelete,
  onRefresh
}: ServerCardProps) {
  const getColor = (value: number) => {
    if (value < 50) return 'text-green-400';
    if (value < 70) return 'text-orange-400';
    return 'text-red-400';
  };
  const getBarColor = (value: number) => {
    if (value < 50) return 'bg-green-400';
    if (value < 70) return 'bg-orange-400';
    return 'bg-red-400';
  };
  const chartData = networkData.map((value) => ({
    value
  }));
  return <div className="bg-slate-800 rounded-xl p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <ServerIcon className="text-blue-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{ip}</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-400">Production Server</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 flex items-center gap-1">
                <Monitor size={12} />
                {os === 'windows' ? 'Windows' : 'Linux'}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={onRefresh}
          className="text-slate-400 hover:text-green-400 transition-colors"
          title="Refresh server data"
        >
          <RefreshCwIcon size={20} />
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-slate-400 hover:text-red-500 transition-colors ml-2"
            title="Delete server"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">CPU Utilization</span>
            <span className={`text-sm font-bold ${getColor(cpu)}`}>{cpu}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className={`h-2 rounded-full ${getBarColor(cpu)}`} style={{
            width: `${cpu}%`
          }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">RAM Usage</span>
            <span className={`text-sm font-bold ${getColor(ram)}`}>{ram}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className={`h-2 rounded-full ${getBarColor(ram)}`} style={{
            width: `${ram}%`
          }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">Disk Space</span>
            <span className={`text-sm font-bold ${getColor(disk)}`}>
              {disk}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className={`h-2 rounded-full ${getBarColor(disk)}`} style={{
            width: `${disk}%`
          }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">Network Traffic</span>
            <span className="text-sm font-bold text-blue-400">{networkTraffic.toFixed(2)} MB</span>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis hide />
                <YAxis hide />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-white">System Uptime</span>
            <span className="text-sm font-bold text-green-400">{uptime}</span>
          </div>
        </div>
      </div>
    </div>;
}
