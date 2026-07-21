import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from 'recharts';
import { dashboardApi } from '../services/api';

export function ErrorRateChart() {
  const [data, setData] = useState<Array<{ api: string; rate: number }>>([]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';
    const activeFiltersRef = { current: {} };

    const fetchData = async (filters?: any) => {
      try {
        const response = await dashboardApi.getSuccessRates({ ...filters, last15MinsOnly: 'true' });
        if (response.success && response.data) {
          const formattedData = response.data.slice(0, 6).map((item: any) => ({
            api: item.apiNumber,
            // Calculate error rate as 100 - successRate
            rate: Math.round(100 - item.successRate)
          }));
          setData(formattedData);
        }
      } catch (error) {
        console.error('Error fetching error rate data:', error);
        // Clear data when backend connection fails
        setData([]);
      }
    };

    const setupInterval = (refresh: string) => {
      if (intervalId) clearInterval(intervalId);
      
      if (refresh === 'off' || refresh === 'Off') {
        intervalId = null;
      } else {
        const ms = refresh === '30s' ? 30000 : refresh === '1m' ? 60000 : refresh === '5m' ? 300000 : 30000;
        intervalId = setInterval(() => fetchData(activeFiltersRef.current), ms);
      }
    };

    fetchData();
    setupInterval(currentRefresh);
    
    const handleFilterChange = (event: any) => {
      const filters = event.detail || {};
      activeFiltersRef.current = filters;
      console.log('ErrorRateChart applying filters:', filters);
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

  const getColor = (rate: number) => {
    if (rate >= 60) return '#ef4444'; // red
    if (rate >= 40) return '#f59e0b'; // amber
    return '#10b981'; // green
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 sm:p-6">
      <h3 className="text-lg font-bold text-white mb-4">API-wise Error Rate (Last 15 Mins)</h3>

      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 30, right: 10, left: 0, bottom: 10 }} barCategoryGap="20%" barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="api" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" domain={[0, 100]} ticks={[0, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value}%`, 'Error Rate']}
          />

          <Bar dataKey="rate" maxBarSize={48} radius={[6, 6, 0, 0]} label={{ position: 'top', formatter: (val: number) => `${val}%`, fill: '#fff', fontSize: 12 }}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={getColor(entry.rate)} />
            ))}
          </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}