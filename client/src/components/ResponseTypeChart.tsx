 
// import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from 'recharts';

// export function ResponseTypeChart() {
//   const data = [
//     {
//       name: 'Information',
//       value: 2100
//     },
//     {
//       name: 'Warning',
//       value: 80
//     },
//     {
//       name: 'Error',
//       value: 60
//     }
//   ];

//   return (
//     <div className="bg-slate-800 rounded-xl p-6">
//       <h3 className="text-lg font-bold text-white mb-4">
//         Response Type Distribution
//       </h3>
//       <ResponsiveContainer width="100%" height={250}>
//         <BarChart data={data}>
//           <defs>
//             <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
//               <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
//               <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
//             </linearGradient>
//             <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
//               <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
//               <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
//             </linearGradient>
//             <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
//               <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
//               <stop offset="100%" stopColor="#f87171" stopOpacity={0.8} />
//             </linearGradient>
//           </defs>
//           <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
//           <XAxis dataKey="name" stroke="#94a3b8" />
//           <YAxis stroke="#94a3b8" />
//           <Tooltip 
//             contentStyle={{
//               backgroundColor: '#1e293b',
//               border: 'none',
//               borderRadius: '8px',
//               color: '#fff'
//             }} 
//           />
//           <Bar dataKey="value" radius={[8, 8, 0, 0]}>
//             <Cell fill="url(#blueGradient)" />
//             <Cell fill="url(#orangeGradient)" />
//             <Cell fill="url(#redGradient)" />
//           </Bar>
//         </BarChart>
//       </ResponsiveContainer>
//     </div>
//   );
// }


 
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from 'recharts';
import { dashboardApi } from '../services/api';

export function ResponseTypeChart() {
  const navigate = useNavigate();
  const [data, setData] = useState([
    { name: 'Success', value: 0 },
    { name: 'Warning', value: 0 },
    { name: 'Failed', value: 0 }
  ]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';
    const activeFiltersRef = { current: {} };

    const fetchData = async (filters?: any) => {
      try {
        const response = await dashboardApi.getStats({ ...filters, last15MinsOnly: 'true' });
        if (response.success && response.data.responseTypeDistribution) {
          const dist = response.data.responseTypeDistribution;
          setData([
            { name: 'Success', value: dist.Information || 0 },
            { name: 'Warning', value: dist.Warning || 0 },
            { name: 'Failed', value: dist.Error || 0 }
          ]);
        }
      } catch (error) {
        console.error('Error fetching response type data:', error);
        // Clear data when backend connection fails
        setData([
          { name: 'Success', value: 0 },
          { name: 'Warning', value: 0 },
          { name: 'Failed', value: 0 }
        ]);
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
      console.log('ResponseTypeChart applying filters:', filters);
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
      <h3 className="text-lg font-bold text-white mb-4">
        Response Type Distribution (Last 15 Mins)
      </h3>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
          <defs>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '8px',
              color: '#fff'
            }} 
            itemStyle={{ color: '#fff' }}
            cursor={{fill: 'rgba(255, 255, 255, 0.1)'}}
          />
          <Bar 
            dataKey="value" 
            radius={[8, 8, 0, 0]}
            onClick={(data, index) => {
              if (data.name === 'Success') {
                navigate('/api-details', { state: { activeTab: 'success' } });
              } else if (data.name === 'Failed') {
                navigate('/api-details', { state: { activeTab: 'error' } });
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <Cell fill="url(#blueGradient)" />
            <Cell fill="url(#orangeGradient)" />
            <Cell fill="url(#redGradient)" />
          </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
