
import { UsersIcon, TrendingUpIcon, ActivityIcon, ServerIcon } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import emailjs from 'emailjs-com';
import { dashboardApi } from '../services/api';

interface DashboardStats {
  totalActiveCustomers: number;
  totalTrafficCount: number;
  liveTraffic: number;
  serverRequests: Record<string, number>;
  customerChange?: string;
}

interface MetricCard {
  title: string;
  value: string;
  numericValue: number;
  change: string;
  icon: any;
  color: string;
  textColor: string;
  badge?: string;
  threshold?: number;
  alertOnZero?: boolean;
  serverIp?: string;
}

export function MetricCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const alertSentRef = useRef<Set<string>>(new Set());

  const sendAlert = (metricTitle: string, value: number, threshold?: number, serverIp?: string) => {
    const alertKey = `${metricTitle}-${serverIp || 'main'}-${value === 0 ? 'zero' : 'exceeded'}`;
    
    // Prevent duplicate alerts
    if (alertSentRef.current.has(alertKey)) {
      return;
    }

    const subject = value === 0 
      ? `ALERT: ${metricTitle} Dropped to 0${serverIp ? ` (${serverIp})` : ''}` 
      : `ALERT: ${metricTitle} Exceeded Threshold${serverIp ? ` (${serverIp})` : ''}`;
    
    const message = value === 0
      ? `${metricTitle}${serverIp ? ` for server ${serverIp}` : ''} is currently 0. Immediate attention required!`
      : `${metricTitle}${serverIp ? ` for server ${serverIp}` : ''} has exceeded the threshold of ${threshold}. Current value: ${value}.`;

    emailjs.send(
      "service_22depjr",
      "template_wikzlfa",
      {
        subject,
        message
      },
      "BGYMrLhoFJo2n84_3"
    )
    .then(() => {
      console.log(`Alert email sent for ${metricTitle}!`);
      alertSentRef.current.add(alertKey);
      
      // Remove alert key after 5 minutes to allow re-sending if issue persists
      setTimeout(() => {
        alertSentRef.current.delete(alertKey);
      }, 300000);
    })
    .catch((err) => {
      console.log(`Failed to send alert for ${metricTitle}`, err);
    });
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let currentRefresh = '30s';
    const activeFiltersRef = { current: {} };

    const fetchStats = async (filters?: any) => {
      try {
        const response = await dashboardApi.getStats({ ...filters, last15MinsOnly: 'true' });
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Clear data when backend connection fails
        setStats(null);
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
        intervalId = setInterval(() => fetchStats(activeFiltersRef.current), ms);
      }
    };

    fetchStats();
    setupInterval(currentRefresh);

    // Listen for filter changes
    const handleFilterChange = (event: any) => {
      const filters = event.detail || {};
      activeFiltersRef.current = filters;
      console.log('MetricCards applying filters:', filters);
      fetchStats(filters);
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

  // Check for alerts whenever stats change
  useEffect(() => {
    if (!stats) return;

    // Check base metrics
    if (stats.totalActiveCustomers === 0) {
      sendAlert('Total Active Customers', 0);
    }
    if (stats.totalActiveCustomers > 5000) {
      sendAlert('Total Active Customers', stats.totalActiveCustomers, 5000);
    }

    if (stats.totalTrafficCount === 0) {
      sendAlert('Total Traffic Count', 0);
    }
    if (stats.totalTrafficCount > 40000000) {
      sendAlert('Total Traffic Count', stats.totalTrafficCount, 40000000);
    }

    if (stats.liveTraffic === 0) {
      sendAlert('Live Traffic', 0);
    }
    if (stats.liveTraffic > 300000) {
      sendAlert('Live Traffic', stats.liveTraffic, 300000);
    }

    // Check server metrics
    if (stats.serverRequests) {
      Object.entries(stats.serverRequests).forEach(([ip, count]) => {
        if (count === 0) {
          sendAlert('Number of Requests', 0, undefined, ip);
        }
        if (count > 30000000) {
          sendAlert('Number of Requests', count, 30000000, ip);
        }
      });
    }
  }, [stats]);

  if (loading) {
    return <div className="text-white">Loading...</div>;
  }

  // Define colors for server cards (cycle through these)
  const serverColors = [
    { color: 'bg-cyan-500', textColor: 'text-cyan-100' },
    { color: 'bg-purple-500', textColor: 'text-purple-100' },
    { color: 'bg-indigo-500', textColor: 'text-indigo-100' },
    { color: 'bg-pink-500', textColor: 'text-pink-100' },
    { color: 'bg-rose-500', textColor: 'text-rose-100' },
    { color: 'bg-orange-500', textColor: 'text-orange-100' },
  ];

  // Helper method to get dynamic color for Total Active Customers
  const getActiveCustomersColor = (value: number) => {
    if (value < 500) return 'bg-red-500';
    if (value > 2000) return 'bg-lime-500'; // Bright Green/Lime for high numbers
    return 'bg-blue-500';
  };

  // Base metrics (always shown)
  const baseMetrics: MetricCard[] = [{
    title: 'Total Active Customers',
    value: stats?.totalActiveCustomers.toString() || '0',
    numericValue: stats?.totalActiveCustomers || 0,
    change: 'Last 15 minutes',
    icon: UsersIcon,
    color: getActiveCustomersColor(stats?.totalActiveCustomers || 0),
    textColor: 'text-white',
    threshold: 5000,
    alertOnZero: true
  }, {
    title: 'Live Traffic',
    value: stats?.liveTraffic?.toString() || '0',
    numericValue: stats?.liveTraffic || 0,
    change: 'Last 2 minutes',
    icon: ActivityIcon,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-100',
    badge: 'LIVE',
    threshold: 300000,
    alertOnZero: true
  }, {
    title: 'Total Request Count',
    value: stats?.totalTrafficCount.toLocaleString() || '0',
    numericValue: stats?.totalTrafficCount || 0,
    change: 'Last 15 minutes',
    icon: TrendingUpIcon,
    color: 'bg-green-500',
    textColor: 'text-green-100',
    threshold: 40000000,
    alertOnZero: true
  }];

  // Dynamic server metrics (only show servers that have been added)
  const serverMetrics: MetricCard[] = stats?.serverRequests 
    ? Object.entries(stats.serverRequests).map(([ip, count], index) => ({
        title: 'Number of Requests',
        value: count.toLocaleString(),
        numericValue: count,
        change: `Server ${ip.split('.').pop()} (Last 15 mins)`,
        icon: ServerIcon,
        ...serverColors[index % serverColors.length],
        threshold: 30000000,
        alertOnZero: true,
        serverIp: ip
      }))
    : [];

  const metrics = [...baseMetrics, ...serverMetrics];

  const shouldBlink = (metric: MetricCard) => {
    const isZero = metric.numericValue === 0 && metric.alertOnZero;
    const isExceeded = metric.threshold && metric.numericValue > metric.threshold;
    return isZero || isExceeded;
  };
  
  // Use CSS Grid auto-fit to create flexible columns that adapt to content
  return (
    <>
      <style>{`
        @keyframes blink-red {
          0%, 100% { background-color: rgb(239 68 68); }
          50% { background-color: rgb(153 27 27); }
        }
        .blink-red-animation {
          animation: blink-red 1s ease-in-out infinite;
        }
      `}</style>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {metrics.map((metric, index) => (
          <div 
            key={`${metric.change}-${index}`} 
            className={`${shouldBlink(metric) ? 'blink-red-animation' : metric.color} rounded-lg p-4 text-white relative overflow-hidden`}
          >
            {'badge' in metric && metric.badge && (
              <div className="absolute top-2 right-2 bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                {metric.badge}
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-2 rounded-lg w-fit">
                  <metric.icon size={15} />
                </div>
                {metric.serverIp && (
                  <span className="text-lg font-bold opacity-90">
                    {metric.serverIp.split('.').pop()}
                  </span>
                )}
              </div>
              <div>
                <p className={`text-xs ${metric.textColor} mb-1`}>
                  {metric.title}
                </p>
                <p className="text-2xl font-bold mb-0.5">{metric.value}</p>
                {metric.change && <p className={`text-xs ${metric.textColor}`}>{metric.change}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}


// import React, { useState, useEffect } from 'react';
// import { Users, TrendingUp, Activity, Server } from 'lucide-react';
// import emailjs from "emailjs-com";


// export function MetricCards() {
//   const [refreshInterval, setRefreshInterval] = useState(5000); // 30 seconds default
//   const [metrics, setMetrics] = useState([
//     {
//       title: 'Total Active Customers',
//       value: 637,
//       change: '+12% from last hour',
//       icon: Users,
//       color: 'bg-blue-500',
//       textColor: 'text-blue-100',
//       threshold: 1000
//     },
//     {
//       title: 'Total Traffic Count',
//       value: 15200,
//       change: '+8% from yesterday',
//       icon: TrendingUp,
//       color: 'bg-green-500',
//       textColor: 'text-green-100',
//       threshold: 20000
//     },
//     {
//       title: 'Live Traffic',
//       value: 500,
//       change: 'Real-time monitoring',
//       icon: Activity,
//       color: 'bg-emerald-500',
//       textColor: 'text-emerald-100',
//       badge: 'LIVE',
//       threshold: 502
//     },
//     {
//       title: 'Number of Requests',
//       value: 2481,
//       change: 'Server A',
//       icon: Server,
//       color: 'bg-cyan-500',
//       textColor: 'text-cyan-100',
//       threshold: 3000
//     },
//     {
//       title: 'Number of Requests',
//       value: 2472,
//       change: 'Server B',
//       icon: Server,
//       color: 'bg-purple-500',
//       textColor: 'text-purple-100',
//       threshold: 3000
//     },
//     {
//       title: 'Number of Requests',
//       value: 1847,
//       change: 'Server C',
//       icon: Server,
//       color: 'bg-indigo-500',
//       textColor: 'text-indigo-100',
//       threshold: 3000
//     }
//   ]);

//   // Function to simulate fetching new data
//   const refreshMetrics = () => {
//   setMetrics(prevMetrics => {
//     const updated = prevMetrics.map(metric => ({
//       ...metric,
//       value: metric.value + Math.floor(Math.random() * 100) - 50
//     }));

//     // Find the LIVE TRAFFIC card
//     const liveTrafficCard = updated.find(m => m.title === "Live Traffic");

//     // Alert condition
//     if (liveTrafficCard && liveTrafficCard.value <= 0) {
//       sendTrafficAlert();
//     }

//     return updated;
//   });
// };


//   // Auto refresh effect
//   useEffect(() => {
//     const interval = setInterval(() => {
//       refreshMetrics();
//     }, refreshInterval);

//     return () => clearInterval(interval);
//   }, [refreshInterval]);

//   // Format number with K notation
//   const formatValue = (value) => {
//     if (value >= 1000) {
//       return (value / 1000).toFixed(1) + 'K';
//     }
//     return value.toLocaleString();
//   };

//   // Check if value exceeds threshold
//   const isHighTraffic = (value, threshold) => {
//     return value > threshold;
//   };

//   const sendTrafficAlert = () => {
//   emailjs.send(
//     "service_22depjr",
//     "template_wikzlfa",
//     {
//       subject: "ALERT: Live Traffic Dropped to 0",
//       message: "Live Traffic value is currently 0. Immediate attention required!"
//     },
//     "BGYMrLhoFJo2n84_3"
//   )
//   .then(() => {
//     console.log("Traffic alert email sent!");
//   })
//   .catch((err) => {
//     console.log("Failed to send traffic alert", err);
//   });
// };


//   return (
//     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
//       {metrics.map((metric, index) => (
//         <div
//           key={index}
//           className={`${metric.color} rounded-lg p-3 text-white relative overflow-hidden`}
//         >
//           {metric.badge && (
//             <div className="absolute top-2 right-2 bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
//               {metric.badge}
//             </div>
//           )}
//           <div className="space-y-2">
//             <div className="bg-white/20 p-2 rounded-lg w-fit">
//               <metric.icon size={16} />
//             </div>
//             <div>
//               <p className={`text-[10px] ${metric.textColor} mb-1`}>
//                 {metric.title}
//               </p>
//               <p 
//                 className={`text-3xl font-bold mb-0.5 transition-colors duration-300 ${
//                   isHighTraffic(metric.value, metric.threshold) 
//                     ? 'text-red-400 animate-pulse' 
//                     : ''
//                 }`}
//               >
//                 {formatValue(metric.value)}
//               </p>
//               <p className={`text-[10px] ${metric.textColor}`}>
//                 {metric.change}
//               </p>
//             </div>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }


 