// import { useState } from 'react';
// import { ClockIcon, Filter, ChevronDown, ChevronUp } from 'lucide-react';

// export function FilterSection() {
//   const [isOpen, setIsOpen] = useState(false);

//   return (
//     <div className="space-y-4">
//       {/* Filter Toggle Button */}
//       <button
//         onClick={() => setIsOpen(!isOpen)}
//         className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
//       >
//         <Filter size={20} />
//         <span>{isOpen ? 'Hide Filters' : 'Show Filters'}</span>
//         {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
//       </button>

//       {/* Collapsible Filter Panel */}
//       {isOpen && (
//         <div className="bg-slate-800 rounded-xl p-6 shadow-lg animate-slideDown">
//           <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
//             <div>
//               <label className="block text-sm font-medium text-white mb-2">API Number</label>
//               <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
//                 <option>All APIs</option>
//                 <option>API-001</option>
//                 <option>API-002</option>
//                 <option>API-003</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-white mb-2">API Name</label>
//               <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
//                 <option>API Names</option>
//                 <option>/customers</option>
//                 <option>/orders</option>
//                 <option>/products</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-white mb-2">Customer Number</label>
//               <input
//                 type="text"
//                 placeholder="Enter customer number"
//                 className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-white mb-2">Date</label>
//               <input
//                 type="date"
//                 placeholder="mm/dd/yyyy"
//                 className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-white mb-2">Time</label>
//               <div className="relative">
//                 <input
//                   type="time"
//                   className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 />
//                 <ClockIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
//               </div>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-white mb-2">Auto Refresh</label>
//               <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
//                 <option>Every 30s</option>
//                 <option>Every 1m</option>
//                 <option>Every 5m</option>
//                 <option>Off</option>
//               </select>
//             </div>
//             <div className="flex items-end">
//               <button className="w-full px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2">
//                 <span>🔍</span>
//                 Apply Filters
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


import { useState, useEffect } from 'react';
import { Filter, ChevronDown, ChevronUp, RefreshCw, X, Search } from 'lucide-react';
import { dashboardApi } from '../services/api';

interface ApiItem {
  number: string;
  name: string;
}

interface CustomerLog {
  startTimestamp: string;
  accessMethod: string;
  status: string;
  apiNumber: string;
  endTimestamp: string;
  responseTime: number;
  serverIdentifier: string;
}

interface FilterValues {
  apiNumber: string;
  apiName: string;
  customerNumber: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  autoRefresh: string;
  serverIdentifier: string;
}

// Store active filters globally
let activeFilters: FilterValues = {
  apiNumber: 'ALL',
  apiName: '',
  customerNumber: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  autoRefresh: '30s',
  serverIdentifier: ''
};

export function getActiveFilters() {
  return { ...activeFilters };
}

export function FilterSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiList, setApiList] = useState<ApiItem[]>([]);
  const [filters, setFilters] = useState<FilterValues>({
    apiNumber: 'ALL',
    apiName: '',
    customerNumber: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    autoRefresh: '30s',
    serverIdentifier: ''
  });
  const [serverList, setServerList] = useState<any[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerLogs, setCustomerLogs] = useState<CustomerLog[]>([]);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);
  
  // Removed authentication check for rendering
  const isAuthenticated = true; // Always allow the filter to show

  // Check if any filters are active
  const hasActiveFilters = () => {
    return filters.apiNumber !== 'ALL' || 
           filters.customerNumber !== '' || 
           filters.startDate !== '' || 
           filters.endDate !== '';
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [apiResponse, serverResponse] = await Promise.all([
          dashboardApi.getApiList(),
          dashboardApi.getStats() // To get server requests/identities or serverHealthApi
        ]);
        
        if (apiResponse.success) {
          setApiList(apiResponse.data);
        }

        // Fetch servers from ServerHealth (using dashboardApi.getStats data or direct call)
        // For simplicity, let's use the dashboard stats which has serverRequests keys
        if (serverResponse.success) {
          const servers = Object.keys(serverResponse.data.serverRequests).map(ip => ({
            id: ip,
            name: ip
          }));
          setServerList(servers);
        }
      } catch (error) {
        console.error('Error fetching initial filter data:', error);
      }
    };
    fetchInitialData();
    
    // Dispatch initial autoRefresh setting
    window.dispatchEvent(new CustomEvent('autoRefreshChanged', { 
      detail: { autoRefresh: '30s' } 
    }));
  }, []);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => {
      const updated = { ...prev, [field]: value };
      
      // Sync API number and name
      if (field === 'apiNumber') {
        // Find the corresponding API name
        const api = apiList.find(a => a.number === value);
        if (api) {
          updated.apiName = api.name;
        } else if (value === 'ALL') {
          updated.apiName = '';
        }
      } else if (field === 'apiName') {
        // Find the corresponding API number
        const api = apiList.find(a => a.name === value);
        if (api) {
          updated.apiNumber = api.number;
        } else if (!value) {
          updated.apiNumber = 'ALL';
        }
      }
      
      // Dispatch autoRefresh change immediately
      if (field === 'autoRefresh') {
        window.dispatchEvent(new CustomEvent('autoRefreshChanged', { 
          detail: { autoRefresh: value } 
        }));
      }
      
      return updated;
    });
  };

  const handleApplyFilters = () => {
    // Build filter object for API
    const apiFilters: any = {};
    
    // Use apiNumber (either from direct selection or from apiName selection)
    if (filters.apiNumber && filters.apiNumber !== 'ALL') {
      apiFilters.apiNumber = filters.apiNumber;
    }
    
    if (filters.customerNumber) {
      apiFilters.customerEmail = filters.customerNumber;
    }
    
    // Handle date and time range filtering
    if (filters.startDate) {
      const dateFrom = new Date(filters.startDate);
      if (filters.startTime) {
        const [hours, minutes] = filters.startTime.split(':');
        dateFrom.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        dateFrom.setHours(0, 0, 0, 0);
      }
      apiFilters.dateFrom = dateFrom.toISOString();
    }
    
    if (filters.serverIdentifier) {
      apiFilters.serverIdentifier = filters.serverIdentifier;
    }
    
    if (filters.endDate) {
      const dateTo = new Date(filters.endDate);
      if (filters.endTime) {
        const [hours, minutes] = filters.endTime.split(':');
        dateTo.setHours(parseInt(hours), parseInt(minutes), 59, 999);
      } else {
        dateTo.setHours(23, 59, 59, 999);
      }
      apiFilters.dateTo = dateTo.toISOString();
    }
    
    // Update global filters
    activeFilters = { ...filters };
    
    console.log('Applied filters:', apiFilters);
    
    // Dispatch event with the formatted API filters
    window.dispatchEvent(new CustomEvent('filtersChanged', { 
      detail: apiFilters 
    }));
  };

  const handleClearFilters = () => {
    const defaultFilters: FilterValues = {
      apiNumber: 'ALL',
      apiName: '',
      customerNumber: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      autoRefresh: '30s',
      serverIdentifier: ''
    };
    setFilters(defaultFilters);
    activeFilters = { ...defaultFilters };
    
    // Dispatch event to clear filters
    window.dispatchEvent(new CustomEvent('filtersChanged', { 
      detail: {} 
    }));
  };

  const handleRefreshData = () => {
    // Clear all filters and refresh to main dataset
    const defaultFilters: FilterValues = {
      apiNumber: 'ALL',
      apiName: '',
      customerNumber: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      autoRefresh: '30s',
      serverIdentifier: ''
    };
    setFilters(defaultFilters);
    activeFilters = { ...defaultFilters };
    
    // Dispatch refresh event to reload main dataset
    window.dispatchEvent(new CustomEvent('dataRefresh', { 
      detail: { refresh: true } 
    }));
    
    // Also clear filters
    window.dispatchEvent(new CustomEvent('filtersChanged', { 
      detail: {} 
    }));
  };

  const handleViewCustomer = async () => {
    if (!filters.customerNumber) return;
    
    setLoadingCustomerData(true);
    setShowCustomerModal(true);
    
    try {
      const response = await dashboardApi.getCustomerLogs(filters.customerNumber);
      if (response.success) {
        setCustomerLogs(response.data);
      }
    } catch (error) {
      console.error('Error fetching customer logs:', error);
    } finally {
      setLoadingCustomerData(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Toggle Button - Only show for authenticated users */}
      {isAuthenticated && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Filter size={20} />
            <span>{isOpen ? 'Hide Filters' : 'Show Filters'}</span>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <button
            onClick={handleRefreshData}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            title="Refresh to main dataset"
          >
            <RefreshCw size={20} />
            <span>Refresh Data</span>
          </button>
          {hasActiveFilters() && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500 text-green-400 rounded-lg text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Filters Active
            </div>
          )}
        </div>
      )}

      {/* Collapsible Filter Panel - Only show for authenticated users */}
      {isAuthenticated && isOpen && (
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-lg animate-slideDown">
          <div className="space-y-4">
            {/* First Row - Main Filters */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">API Number</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.apiNumber}
                  onChange={(e) => handleFilterChange('apiNumber', e.target.value)}
                >
                  <option value="ALL">All APIs</option>
                  {apiList.map((api) => (
                    <option key={api.number} value={api.number}>
                      {api.number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">API Name</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.apiName}
                  onChange={(e) => handleFilterChange('apiName', e.target.value)}
                >
                  <option value="">API Names</option>
                  {apiList.map((api) => (
                    <option key={api.number} value={api.name}>
                      {api.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white mb-2">Customer Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter username (email/phone)"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                    value={filters.customerNumber}
                    onChange={(e) => handleFilterChange('customerNumber', e.target.value)}
                  />
                  <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    onClick={handleViewCustomer}
                    disabled={!filters.customerNumber}
                    title="View customer details"
                  >
                    View
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Auto Refresh</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.autoRefresh}
                  onChange={(e) => handleFilterChange('autoRefresh', e.target.value)}
                >
                  <option value="30s">Every 30s</option>
                  <option value="1m">Every 1m</option>
                  <option value="5m">Every 5m</option>
                  <option value="off">Off</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Dashboard Server</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.serverIdentifier}
                  onChange={(e) => handleFilterChange('serverIdentifier', e.target.value)}
                >
                  <option value="">All Servers</option>
                  {serverList.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Second Row - Date/Time Range and Controls */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Start Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Start Time</label>
                <input
                  type="time"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.startTime}
                  onChange={(e) => handleFilterChange('startTime', e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">End Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">End Time</label>
                <input
                  type="time"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                  value={filters.endTime}
                  onChange={(e) => handleFilterChange('endTime', e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2 opacity-0">Apply</label>
                <button 
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                  onClick={handleApplyFilters}
                >
                  <Search size={18} />
                  Apply
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2 opacity-0">Clear</label>
                <button 
                  className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                  onClick={handleClearFilters}
                  title="Clear all filters"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal - Only show for authenticated users */}
      {isAuthenticated && showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white">
                Customer Details: {filters.customerNumber}
              </h2>
              <button 
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingCustomerData ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  Loading customer logs...
                </div>
              ) : customerLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No logs found for this customer.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400 text-sm">Total Requests</div>
                      <div className="text-2xl font-bold text-white">{customerLogs.length}</div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400 text-sm">Success Rate</div>
                      <div className="text-2xl font-bold text-green-400">
                        {Math.round((customerLogs.filter(log => log.status === 'Information').length / customerLogs.length) * 100)}%
                      </div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400 text-sm">Avg Response Time</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {Math.round(customerLogs.reduce((sum, log) => sum + log.responseTime, 0) / customerLogs.length)}ms
                      </div>
                    </div>
                    <div className="bg-slate-700 rounded-lg p-4">
                      <div className="text-slate-400 text-sm">Unique APIs</div>
                      <div className="text-2xl font-bold text-purple-400">
                        {new Set(customerLogs.map(log => log.apiNumber)).size}
                      </div>
                    </div>
                  </div>

                  {/* Logs Table */}
                  <div className="bg-slate-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-600">
                          <tr>
                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Timestamp</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-medium">API Number</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Access Method</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Status</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Response Time</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Server</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerLogs.map((log, index) => (
                            <tr key={index} className="border-t border-slate-600 hover:bg-slate-600/50 transition-colors">
                              <td className="py-3 px-4 text-slate-300">{log.startTimestamp}</td>
                              <td className="py-3 px-4 text-slate-300">{log.apiNumber}</td>
                              <td className="py-3 px-4 text-slate-300">{log.accessMethod}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  log.status === 'Information' ? 'bg-green-500/20 text-green-400' :
                                  log.status === 'Warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                  log.status === 'Error' ? 'bg-red-500/20 text-red-400' :
                                  'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-300">{log.responseTime}ms</td>
                              <td className="py-3 px-4 text-slate-300">{log.serverIdentifier}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-700 flex justify-end">
              <button 
                onClick={() => setShowCustomerModal(false)}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}                                           