 
// export function ApiDetailsTable() {
//   const apiData = [{
//     id: 'API-001',
//     method: 'GET',
//     path: '/customers',
//     successRate: '98%',
//     avgResponse: '120ms',
//     requestCount: 1240
//   }, {
//     id: 'API-002',
//     method: 'POST',
//     path: '/orders',
//     successRate: '97%',
//     avgResponse: '180ms',
//     requestCount: 840
//   }, {
//     id: 'API-003',
//     method: 'GET',
//     path: '/products',
//     successRate: '99%',
//     avgResponse: '90ms',
//     requestCount: 1520
//   }, {
//     id: 'API-004',
//     method: 'PUT',
//     path: '/users',
//     successRate: '96%',
//     avgResponse: '150ms',
//     requestCount: 680
//   }, {
//     id: 'API-005',
//     method: 'DELETE',
//     path: '/carts',
//     successRate: '98%',
//     avgResponse: '110ms',
//     requestCount: 320
//   }];
//   return <div className="bg-slate-800 rounded-xl p-6">
//       <h3 className="text-lg font-bold text-white mb-4">API Details</h3>
//       <div className="overflow-x-auto">
//         <table className="w-full">
//           <thead>
//             <tr className="border-b border-slate-700">
//               <th className="text-left py-3 px-4 text-slate-400 font-medium">
//                 API ID
//               </th>
//               <th className="text-left py-3 px-4 text-slate-400 font-medium">
//                 Method
//               </th>
//               <th className="text-left py-3 px-4 text-slate-400 font-medium">
//                 Path
//               </th>
//               <th className="text-left py-3 px-4 text-slate-400 font-medium">
//                 Success Rate
//               </th>
//               <th className="text-left py-3 px-4 text-slate-400 font-medium">
//                 Avg. Response
//               </th>
//               <th className="text-left py-3 px-4 text-slate-400 font-medium">
//                 Request Count
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {apiData.map(api => <tr key={api.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
//                 <td className="py-4 px-4 text-slate-300">{api.id}</td>
//                 <td className="py-4 px-4 text-slate-300">{api.method}</td>
//                 <td className="py-4 px-4 text-slate-300">{api.path}</td>
//                 <td className="py-4 px-4 text-slate-300">{api.successRate}</td>
//                 <td className="py-4 px-4 text-slate-300">{api.avgResponse}</td>
//                 <td className="py-4 px-4 text-slate-300">{api.requestCount}</td>
//               </tr>)}
//           </tbody>
//         </table>
//       </div>
//     </div>;
// }


 
import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';
import { TrendingUp, TrendingDown, List, Eye } from 'lucide-react';
import { ApiSuccessRateModal } from '../components/ApiSuccessRateModal';

interface ApiData {
  apiId: string;
  method: string;
  path: string;
  successRate: string;
  avgResponse: string;
  requestCount: number;
}

type FilterMode = 'all' | 'success' | 'error';

export function ApiDetailsTable() {
  const [apiData, setApiData] = useState<ApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedApi, setSelectedApi] = useState<ApiData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewClick = (api: ApiData) => {
    setSelectedApi(api);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedApi(null);
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';

    const fetchData = async (filters?: any) => {
      try {
        let response;
        const combinedFilters = { ...filters };
        
        if (filterMode === 'success') {
          // Fetch all APIs with highest success rate
          combinedFilters.limit = 1000; // High limit to get all APIs
          response = await dashboardApi.getTopSuccessApis(combinedFilters);
        } else if (filterMode === 'error') {
          // Fetch all APIs with highest error rate
          combinedFilters.limit = 1000; // High limit to get all APIs
          response = await dashboardApi.getTopErrorApis(combinedFilters);
        } else {
          // Default: fetch all APIs (no limit)
          combinedFilters.limit = 1000; // High limit to get all APIs
          response = await dashboardApi.getApiDetails(combinedFilters);
        }
        
        if (response.success && response.data) {
          setApiData(response.data);
        }
      } catch (error) {
        console.error('Error fetching API details:', error);
      } finally {
        setLoading(false);
      }
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
      console.log('ApiDetailsTable applying filters:', filters);
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
  }, [filterMode]);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">API Details</h3>
        <div className="text-slate-400 text-center py-8">Loading...</div>
      </div>
    );
  }
  return <div className="bg-slate-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h3 className="text-lg font-bold text-white">API Details</h3>
        
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterMode === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <List size={18} />
            All APIs
          </button>
          <button
            onClick={() => setFilterMode('success')}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterMode === 'success' 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <TrendingUp size={18} />
            Top Success
          </button>
          <button
            onClick={() => setFilterMode('error')}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterMode === 'error' 
                ? 'bg-red-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <TrendingDown size={18} />
            Top Errors
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                API ID
              </th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Method
              </th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Path
              </th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Success Rate
              </th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Avg. Response
              </th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Request Count
              </th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {apiData.map(api => <tr key={api.apiId} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                <td className="py-4 px-4 text-slate-300">{api.apiId}</td>
                <td className="py-4 px-4 text-slate-300">{api.method}</td>
                <td className="py-4 px-4 text-slate-300">{api.path}</td>
                <td className="py-4 px-4 text-slate-300">{api.successRate}</td>
                <td className="py-4 px-4 text-slate-300">{api.avgResponse}</td>
                <td className="py-4 px-4 text-slate-300">{api.requestCount}</td>
                <td className="py-4 px-4">
                  <button
                    onClick={() => handleViewClick(api)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Eye size={16} />
                    View
                  </button>
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>

      {/* Success Rate Modal */}
      {selectedApi && (
        <ApiSuccessRateModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          apiId={selectedApi.apiId}
          apiPath={selectedApi.path}
        />
      )}
    </div>;
}
