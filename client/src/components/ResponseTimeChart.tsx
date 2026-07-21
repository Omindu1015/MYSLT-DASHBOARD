 
// import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
// export function ResponseTimeChart() {
//   const data = [{
//     api: '',
//     responseTime: 220
//   }, {
//     api: 'A1',
//     responseTime: 180
//   }, {
//     api: 'A2',
//     responseTime: 170
//   }, {
//     api: 'A4',
//     responseTime: 150 
//   }, {
//     api: 'A5',
//     responseTime: 140
//   }, {
//     api: 'A6',
//     responseTime: 110
//   }];
//   return <div className="bg-slate-800 rounded-xl p-6">
//       <h3 className="text-lg font-bold text-white mb-4">
//         API Average Response Time
//       </h3>
//       <ResponsiveContainer width="100%" height={250}>
//         <BarChart data={data}>
//           <defs>
//             <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
//               <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
//               <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
//             </linearGradient>
//           </defs>
//           <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
//           <XAxis dataKey="api" stroke="#94a3b8" />
//           <YAxis stroke="#94a3b8" />
//           <Tooltip contentStyle={{
//           backgroundColor: '#1e293b',
//           border: 'none',
//           borderRadius: '8px',
//           color: '#fff'
//         }} />
//           <Bar dataKey="responseTime" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
//         </BarChart>
//       </ResponsiveContainer>
//     </div>;
// }


 
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import { dashboardApi } from '../services/api';

export function ResponseTimeChart() {
  const [data, setData] = useState<Array<{ api: string; responseTime: number }>>([]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';
    const activeFiltersRef = { current: {} };

    const fetchData = async (filters?: any) => {
      try {
        const response = await dashboardApi.getResponseTimes({ ...filters, last15MinsOnly: 'true' });
        if (response.success && response.data) {
          const formattedData = response.data.slice(0, 6).map((item: any) => ({
            api: item.apiNumber,
            responseTime: item.avgResponseTime
          }));
          setData(formattedData);
        }
      } catch (error) {
        console.error('Error fetching response time data:', error);
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
      console.log('ResponseTimeChart applying filters:', filters);
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
  return <div className="bg-slate-800 rounded-xl p-4 sm:p-6">
      <h3 className="text-lg font-bold text-white mb-4">
        API Average Response Time (Last 15 Mins)
      </h3>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
              <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="api" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip contentStyle={{
          backgroundColor: '#1e293b',
          border: 'none',
          borderRadius: '8px',
          color: '#fff'
        }} />
          <Bar dataKey="responseTime" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>;
}
