 
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
import { useLocation } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { TrendingUp, TrendingDown, List, Eye, Calendar, Filter, X, ArrowRight, Clock } from 'lucide-react';
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
type FilterTab = 'duration' | 'dateRange';

export function ApiDetailsTable() {
  const location = useLocation();
  const [apiData, setApiData] = useState<ApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>(
    (location.state as any)?.activeTab || 'all'
  );
  const [selectedApi, setSelectedApi] = useState<ApiData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter Tab State
  const [activeTab, setActiveTab] = useState<FilterTab>('duration');

  // Duration Filter State (defaults to 15 mins)
  const [customMinutes, setCustomMinutes] = useState<string>('15');

  // Date Filter State
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');

  // Applied Filter State: defaults to showing last 15 minutes!
  const [appliedDateFilters, setAppliedDateFilters] = useState<{
    dateFrom?: string;
    dateTo?: string;
    minutes?: number | string;
  }>({ minutes: 15 });

  const handleViewClick = (api: ApiData) => {
    setSelectedApi(api);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedApi(null);
  };

  const handleApplyDuration = (mins?: number | string) => {
    const value = mins !== undefined ? mins : customMinutes;
    if (value === '' || value === 'all' || Number(value) <= 0 || isNaN(Number(value))) {
      if (value === 'all') setCustomMinutes('');
      setAppliedDateFilters({});
    } else {
      setCustomMinutes(String(value));
      setAppliedDateFilters({ minutes: value });
    }
  };

  const handleApplyDateFilter = () => {
    if (!startDateInput && !endDateInput) return;
    const newFilters: { dateFrom?: string; dateTo?: string } = {};

    if (startDateInput) {
      const dateFrom = new Date(startDateInput);
      dateFrom.setHours(0, 0, 0, 0);
      newFilters.dateFrom = dateFrom.toISOString();
    }

    if (endDateInput) {
      const dateTo = new Date(endDateInput);
      dateTo.setHours(23, 59, 59, 999);
      newFilters.dateTo = dateTo.toISOString();
    }

    setAppliedDateFilters(newFilters);
  };

  const handleClearFilter = () => {
    setStartDateInput('');
    setEndDateInput('');
    setCustomMinutes('');
    setAppliedDateFilters({});
  };

  const handlePresetDate = (preset: 'today' | 'yesterday' | 'last7') => {
    const now = new Date();
    const newFilters: { dateFrom?: string; dateTo?: string } = {};

    if (preset === 'today') {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      setStartDateInput(today.toISOString().split('T')[0]);
      setEndDateInput('');
      newFilters.dateFrom = today.toISOString();
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      setStartDateInput(yesterday.toISOString().split('T')[0]);
      setEndDateInput(yesterday.toISOString().split('T')[0]);
      newFilters.dateFrom = yesterday.toISOString();
      newFilters.dateTo = yesterdayEnd.toISOString();
    } else if (preset === 'last7') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      setStartDateInput(start.toISOString().split('T')[0]);
      setEndDateInput(now.toISOString().split('T')[0]);
      newFilters.dateFrom = start.toISOString();
      newFilters.dateTo = now.toISOString();
    }

    setAppliedDateFilters(newFilters);
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';

    const fetchData = async (filters?: any) => {
      try {
        let response;
        const combinedFilters = { ...appliedDateFilters, ...filters };
        
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
  }, [filterMode, appliedDateFilters]);

  if (loading && apiData.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">API Details</h3>
        <div className="text-slate-400 text-center py-8">Loading...</div>
      </div>
    );
  }
  return <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-xl border border-slate-700/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          API Details
        </h3>
        
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              filterMode === 'all' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
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
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' 
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
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <TrendingDown size={18} />
            Top Errors
          </button>
        </div>
      </div>

      {/* Time & Date Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 sm:p-5 mb-6 shadow-inner transition-all">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <button
            onClick={() => setActiveTab('duration')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'duration'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock size={14} />
            Recent Duration (Minutes / Hours)
          </button>
          <button
            onClick={() => setActiveTab('dateRange')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'dateRange'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calendar size={14} />
            Custom Date Range / Start Date
          </button>
        </div>

        {activeTab === 'duration' ? (
          /* Duration / Minutes Filter UI */
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <span className="text-xs font-medium text-slate-400 mr-1">Quick Select:</span>
              <button
                onClick={() => handleApplyDuration(15)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                  appliedDateFilters.minutes == 15
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Last 15m (Default)
              </button>
              <button
                onClick={() => handleApplyDuration(30)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                  appliedDateFilters.minutes == 30
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Last 30m
              </button>
              <button
                onClick={() => handleApplyDuration(60)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                  appliedDateFilters.minutes == 60
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Last 1h
              </button>
              <button
                onClick={() => handleApplyDuration(360)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                  appliedDateFilters.minutes == 360
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Last 6h
              </button>
              <button
                onClick={() => handleApplyDuration(1440)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                  appliedDateFilters.minutes == 1440
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Last 24h
              </button>
              <button
                onClick={() => handleApplyDuration('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                  !appliedDateFilters.minutes && !appliedDateFilters.dateFrom
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Custom Minutes Input */}
            <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
              <span className="text-xs text-slate-400 whitespace-nowrap">Custom Minutes:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 45"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyDuration()}
                  className="w-24 px-2.5 py-1 bg-slate-800 border border-slate-600 rounded-md text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleApplyDuration()}
                  disabled={!customMinutes}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium rounded-md transition-all active:scale-95"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Date Range / Start Date Filter UI */
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm whitespace-nowrap">
                <Calendar size={18} className="text-blue-400" />
                <span>Date Filter:</span>
              </div>
              
              {/* Start Date Input */}
              <div className="flex flex-col w-full sm:w-auto">
                <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-600/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-full sm:w-44 shadow-sm"
                />
              </div>

              <div className="hidden sm:flex items-center pt-5 text-slate-500">
                <ArrowRight size={16} />
              </div>

              {/* End Date Input */}
              <div className="flex flex-col w-full sm:w-auto">
                <label className="text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                  End Date <span className="text-slate-500 font-normal text-[10px] lowercase">(optional for range)</span>
                </label>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(e) => setEndDateInput(e.target.value)}
                  min={startDateInput || undefined}
                  disabled={!startDateInput}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-600/80 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-44 shadow-sm"
                />
              </div>
            </div>

            {/* Action Buttons & Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 lg:self-end">
              <div className="flex items-center gap-1.5 mr-2">
                <button
                  onClick={() => handlePresetDate('today')}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => handlePresetDate('yesterday')}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors"
                >
                  Yesterday
                </button>
                <button
                  onClick={() => handlePresetDate('last7')}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors"
                >
                  Last 7d
                </button>
              </div>

              <button
                onClick={handleApplyDateFilter}
                disabled={!startDateInput && !endDateInput}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-slate-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95"
              >
                <Filter size={15} />
                Apply Filter
              </button>
            </div>
          </div>
        )}

        {/* Active Filter Indicator */}
        {(appliedDateFilters.minutes !== undefined || appliedDateFilters.dateFrom) && (
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400 font-medium">Active Filter:</span>
              <span className="font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                {appliedDateFilters.minutes ? (
                  <>
                    <Clock size={13} />
                    <span>Last {appliedDateFilters.minutes} Minutes</span>
                  </>
                ) : appliedDateFilters.dateTo ? (
                  <>
                    <span>Range:</span>
                    <span className="text-white">
                      {new Date(appliedDateFilters.dateFrom!).toLocaleDateString()} — {new Date(appliedDateFilters.dateTo).toLocaleDateString()}
                    </span>
                  </>
                ) : (
                  <>
                    <span>Start Date Only:</span>
                    <span className="text-white">
                      From {new Date(appliedDateFilters.dateFrom!).toLocaleDateString()}
                    </span>
                  </>
                )}
              </span>
              {(appliedDateFilters.minutes || appliedDateFilters.dateFrom) && (
                <button
                  onClick={handleClearFilter}
                  className="text-slate-400 hover:text-white underline ml-1 text-xs transition-colors"
                >
                  Reset to All Time
                </button>
              )}
            </div>
            <div className="text-slate-400 font-medium bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
              Showing <span className="text-white font-semibold">{apiData.length}</span> API{apiData.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
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
