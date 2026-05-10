import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { dashboardApi } from '../services/api';

interface AccessMethod {
  name: string;
  value: number;
}

const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange/Amber
  '#a855f7', // Purple
  '#ef4444', // Red
  '#ec4899', // Pink
];

export function AccessMethodChart() {
  const [data, setData] = useState<AccessMethod[]>([]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';

    const fetchData = async (filters?: any) => {
      try {
        const response = await dashboardApi.getStats(filters);
        if (response.success && response.data.accessMethodDistribution) {
          const dist = response.data.accessMethodDistribution;
          // Convert backend data to chart format
          const chartData = Object.entries(dist).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), // Capitalize first letter
            value: value as number
          }));
          
          // Group values under 1% as "Others"
          const processedData = processAccessMethodData(chartData);
          setData(processedData);
        }
      } catch (error) {
        console.error('Error fetching access method data:', error);
        // Clear data when backend connection fails
        setData([]);
      }
    };
    
    const processAccessMethodData = (rawData: AccessMethod[]) => {
      const threshold = 1; // Group values under 1%
      const total = rawData.reduce((sum, item) => sum + item.value, 0);
      let othersTotal = 0;
      
      const mainData = rawData.filter(item => {
        const percentage = (item.value / total) * 100;
        if (percentage < threshold) {
          othersTotal += item.value;
          return false; // Exclude from main data
        }
        return true; // Keep in main data
      });
      
      // Add "Others" category if there are small values
      if (othersTotal > 0) {
        mainData.push({
          name: 'Others',
          value: othersTotal
        });
      }
      
      return mainData;
    };

    const setupInterval = (refresh: string) => {
      if (intervalId) clearInterval(intervalId);
      
      if (refresh === 'off' || refresh === 'Off') {
        intervalId = null;
      } else {
        const ms = refresh === '30s' ? 30000 : refresh === '1m' ? 60000 : refresh === '5m' ? 300000 : 30000;
        intervalId = setInterval(() => fetchData(), ms);
      }
    };

    fetchData();
    setupInterval(currentRefresh);
    
    const handleFilterChange = (event: any) => {
      const filters = event.detail || {};
      console.log('AccessMethodChart applying filters:', filters);
      fetchData(filters);
    };
    
    const handleAutoRefreshChange = (event: any) => {
      const { autoRefresh } = event.detail || {};
      if (autoRefresh) {
        currentRefresh = autoRefresh;
        setupInterval(autoRefresh);
      }
    };
    
    window.addEventListener('filtersChanged', handleFilterChange);
    window.addEventListener('autoRefreshChanged', handleAutoRefreshChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('filtersChanged', handleFilterChange);
      window.removeEventListener('autoRefreshChanged', handleAutoRefreshChange);
    };
  }, []);

  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6">
      <h3 className="text-lg font-bold text-white mb-4">Access Method Distribution</h3>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
          <defs>
            <linearGradient id="cyanGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="tealGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0891b2" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
            <linearGradient id="purpleGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>

          <Pie
            data={data}
            cx="50%"
            cy="55%"
            outerRadius={85}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Pie>

          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#94a3b8', fontSize: 12 }}
            itemStyle={{ color: '#fff', fontSize: 13 }}
            formatter={(value: number, _name: string) => {
              const total = data.reduce((sum, item) => sum + item.value, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return [`${value.toLocaleString()} (${percentage}%)`, _name];
            }}
          />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
