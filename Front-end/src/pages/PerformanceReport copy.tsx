import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  ChartLine, 
  CreditCard, 
  Calendar, 
  RefreshCw, 
  Filter, 
  ShoppingBag, 
  Users, 
  Package,
  Store,
  Utensils
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js/auto';

// Register Chart.js components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend
);

// Define a type alias for Chart instance
type Chart = ChartJS;

// --- Types ---
interface LaundryOrderItem {
  id: number;
  servicetype: string[];
  itemtype: string;
  itemname: string;
  quantity: number;
  unit_price: string;
  total_item_price: string;
}

interface LaundryOrder {
  id: number;
  uniquecode: string;
  total_price: string;
  amount_paid: string;
  balance: string;
  payment_type: string;
  payment_status: 'pending' | 'partial' | 'complete';
  shop: string;
  delivery_date: string;
  order_status: string;
  customer: { name: string };
  items: LaundryOrderItem[];
  created_at: string;
}

interface HotelOrderItem {
  id: number;
  food_item_name: string;
  total_price: number;
  quantity: number;
  price: number;
}

interface HotelOrder {
  id: number;
  order_items: HotelOrderItem[];
  total_amount: number;
  created_at: string;
  created_by: { first_name: string; last_name: string };
}

// --- Constants ---
const API_BASE = 'http://127.0.0.1:8080/api';

const COLORS = {
  primary: '#2563EB',    // Blue 600
  primaryLight: '#60A5FA', // Blue 400
  secondary: '#475569',  // Slate 600
  accent: '#3B82F6',     // Blue 500
  success: '#10B981',    // Emerald 500
  danger: '#EF4444',     // Red 500
  warning: '#F59E0B',    // Amber 500
  bgLight: '#F3F4F6',    // Gray 100
};

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(amount);

export default function PerformanceReport() { 
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [laundryData, setLaundryData] = useState<LaundryOrder[]>([]);
  const [hotelData, setHotelData] = useState<HotelOrder[]>([]);

  // Filters
  const [filterYear, setFilterYear] = useState(2025); // Keep internal state for default view
  const [filterMonth, setFilterMonth] = useState<string>(""); // Keep internal state, though UI removed
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Chart Refs
  const revenueComparisonRef = useRef<HTMLCanvasElement>(null);
  const revenueDistributionRef = useRef<HTMLCanvasElement>(null);
  const monthlyTrendRef = useRef<HTMLCanvasElement>(null);
  const topServicesRef = useRef<HTMLCanvasElement>(null);
  const topItemsRef = useRef<HTMLCanvasElement>(null);
  const topCustomersRef = useRef<HTMLCanvasElement>(null);

  // FIX: Store chart instances to prevent "Canvas is already in use" error
  const chartInstances = useRef<Map<HTMLCanvasElement, Chart>>(new Map());

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      
      const [laundryRes, hotelRes] = await Promise.all([
        fetch(`${API_BASE}/Laundry/orders/`, { headers }),
        fetch(`${API_BASE}/Hotel/orders/`, { headers })
      ]);

      if (!laundryRes.ok || !hotelRes.ok) throw new Error('Failed to fetch data');

      const laundry = await laundryRes.json();
      const hotel = await hotelRes.json();

      setLaundryData(Array.isArray(laundry) ? laundry : (laundry.results || []));
      setHotelData(Array.isArray(hotel) ? hotel : (hotel.results || []));
    } catch (err) {
      setError('Error loading dashboard data. Please ensure API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Helper: Parse Money ---
  const parseMoney = (val: string | number): number => {
    if (typeof val === 'number') return val;
    return parseFloat(String(val)) || 0;
  };

  // --- Data Processing (Aggregation) ---
  const processedData = useMemo(() => {
    const isDateInRange = (dateStr: string) => {
      const date = new Date(dateStr);
      
      // Priority 1: Explicit Date Range overrides Year/Month
      if (fromDate || toDate) {
        if (fromDate && date < new Date(fromDate)) return false;
        if (toDate && date > new Date(toDate)) return false;
        return true;
      }

      // Priority 2: Year/Month Filter (Default if no range selected)
      const year = date.getFullYear();
      
      // Check Year
      if (year !== filterYear) return false;

      // Check Month
      if (filterMonth) {
        const [y, m] = filterMonth.split('-');
        if (year !== parseInt(y) || date.getMonth() + 1 !== parseInt(m)) return false;
      }

      return true;
    };

    // 1. Filter Data
    const filteredLaundry = laundryData.filter(o => isDateInRange(o.created_at));
    const filteredHotel = hotelData.filter(o => isDateInRange(o.created_at));

    // 2. Core Metrics
    const laundryRevenue = filteredLaundry.reduce((sum, o) => sum + parseMoney(o.total_price), 0);
    const hotelRevenue = filteredHotel.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalRevenue = laundryRevenue + hotelRevenue;
    
    // NOTE: Expenses are hardcoded to 0 as no Expense API endpoint was provided.
    const totalExpenses = 0; 
    const netProfit = totalRevenue - totalExpenses;

    // 3. Shop Metrics (Laundry Only)
    const shopAOrders = filteredLaundry.filter(o => o.shop === 'Shop A');
    const shopBOrders = filteredLaundry.filter(o => o.shop === 'Shop B');

    const getShopStats = (orders: LaundryOrder[]) => {
      const revenue = orders.reduce((s, o) => s + parseMoney(o.total_price), 0);
      const count = orders.length;
      const pendingAmt = orders.filter(o => o.payment_status === 'pending').reduce((s, o) => s + parseMoney(o.total_price), 0);
      const partialAmt = orders.filter(o => o.payment_status === 'partial').reduce((s, o) => s + parseMoney(o.total_price), 0);
      const completeAmt = orders.filter(o => o.payment_status === 'complete').reduce((s, o) => s + parseMoney(o.total_price), 0);
      
      const pendingCount = orders.filter(o => o.payment_status === 'pending').length;
      const partialCount = orders.filter(o => o.payment_status === 'partial').length;
      const completeCount = orders.filter(o => o.payment_status === 'complete').length;

      return { revenue, count, pendingAmt, partialAmt, completeAmt, pendingCount, partialCount, completeCount };
    };

    const shopA = getShopStats(shopAOrders);
    const shopB = getShopStats(shopBOrders);

    // 4. Payment Type Summary (Laundry)
    const paymentTypes: Record<string, number> = {};
    filteredLaundry.forEach(o => {
      const type = o.payment_type || 'Unknown';
      paymentTypes[type] = (paymentTypes[type] || 0) + parseMoney(o.total_price);
    });

    // 5. Top Services/Items/Customers
    const serviceCounts: Record<string, number> = {};
    const itemCounts: Record<string, number> = {};
    const customerSpends: Record<string, number> = {};

    filteredLaundry.forEach(o => {
      // Services
      o.items.forEach(i => {
        const type = Array.isArray(i.servicetype) ? i.servicetype[0] : 'Unknown';
        serviceCounts[type] = (serviceCounts[type] || 0) + 1;
      });
      // Items
      o.items.forEach(i => {
        itemCounts[i.itemname] = (itemCounts[i.itemname] || 0) + 1;
      });
      // Customers
      if (o.customer?.name) {
        customerSpends[o.customer.name] = (customerSpends[o.customer.name] || 0) + parseMoney(o.total_price);
      }
    });

    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topCustomers = Object.entries(customerSpends)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);

    // 6. Monthly Trend (Whole Year context for chart)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const laundryMonthly = Array(12).fill(0);
    const hotelMonthly = Array(12).fill(0);

    laundryData.forEach(o => {
      const d = new Date(o.created_at);
      if (d.getFullYear() === filterYear) {
        laundryMonthly[d.getMonth()] += parseMoney(o.total_price);
      }
    });
    hotelData.forEach(o => {
      const d = new Date(o.created_at);
      if (d.getFullYear() === filterYear) {
        hotelMonthly[d.getMonth()] += (o.total_amount || 0);
      }
    });

    return {
      totalRevenue,
      netProfit,
      totalExpenses,
      laundryRevenue,
      hotelRevenue,
      laundryOrders: filteredLaundry.length,
      hotelOrders: filteredHotel.length,
      shopA,
      shopB,
      paymentTypes,
      topServices,
      topItems,
      topCustomers,
      monthlyData: { months, laundry: laundryMonthly, hotel: hotelMonthly }
    };
  }, [laundryData, hotelData, filterYear, filterMonth, fromDate, toDate]);

  // --- Chart Rendering ---
  useEffect(() => {
    if (loading) return;

    // FIX: Safe chart creation helper
    const createChart = (ref: React.RefObject<HTMLCanvasElement>, config: any) => {
      if (!ref.current) return;

      // 1. Get existing chart instance for this canvas
      const existingChart = chartInstances.current.get(ref.current);

      // 2. Destroy existing chart if it exists
      if (existingChart) {
        existingChart.destroy();
        chartInstances.current.delete(ref.current);
      }

      // 3. Create new chart
      const ctx = ref.current.getContext('2d');
      if (!ctx) return;
      const newChart = new ChartJS(ctx, config);
      
      // 4. Store the new instance
      chartInstances.current.set(ref.current, newChart);
    };

    // 1. Revenue Comparison (Laundry vs Hotel) - Doughnut
    createChart(revenueComparisonRef, {
      type: 'doughnut',
      data: {
        labels: ['Laundry Business', 'Hotel Business'],
        datasets: [{
          data: [processedData.laundryRevenue, processedData.hotelRevenue],
          backgroundColor: [COLORS.primary, COLORS.secondary],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // 2. Revenue Distribution - Pie (By Shop A/B + Hotel)
    createChart(revenueDistributionRef, {
      type: 'pie',
      data: {
        labels: ['Shop A', 'Shop B', 'Hotel'],
        datasets: [{
          data: [processedData.shopA.revenue, processedData.shopB.revenue, processedData.hotelRevenue],
          backgroundColor: ['#3B82F6', '#60A5FA', '#94A3B8'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // 3. Monthly Trend - Line
    createChart(monthlyTrendRef, {
      type: 'line',
      data: {
        labels: processedData.monthlyData.months,
        datasets: [
          {
            label: 'Laundry Revenue',
            data: processedData.monthlyData.laundry,
            borderColor: COLORS.primary,
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Hotel Revenue',
            data: processedData.monthlyData.hotel,
            borderColor: COLORS.secondary,
            borderDash: [5, 5],
            tension: 0.4
          }
        ]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        interaction: { mode: 'index', intersect: false }
      }
    });

    // 4. Top Services - Horizontal Bar
    createChart(topServicesRef, {
      type: 'bar',
      data: {
        labels: processedData.topServices.map(s => s[0]),
        datasets: [{
          label: 'Orders',
          data: processedData.topServices.map(s => s[1]),
          backgroundColor: COLORS.primary
        }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 5. Top Items - Horizontal Bar
    createChart(topItemsRef, {
      type: 'bar',
      data: {
        labels: processedData.topItems.map(i => i[0]),
        datasets: [{
          label: 'Count',
          data: processedData.topItems.map(i => i[1]),
          backgroundColor: COLORS.accent
        }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 6. Top Customers - Horizontal Bar
    createChart(topCustomersRef, {
      type: 'bar',
      data: {
        labels: processedData.topCustomers.map(c => c[0]),
        datasets: [{
          label: 'Total Spent (KES)',
          data: processedData.topCustomers.map(c => c[1]),
          backgroundColor: COLORS.success
        }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // CLEANUP: Destroy all charts when component unmounts
    return () => {
      chartInstances.current.forEach(chart => chart.destroy());
      chartInstances.current.clear();
    };
  }, [processedData, loading]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Header & Filters */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg text-white">
                <ChartLine size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
                <p className="text-sm text-gray-500">Laundry & Hotel Management System</p>
              </div>
            </div>
            <button 
              onClick={fetchData}
              className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Filter Bar - UPDATED: Year and Month removed */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50 p-4 rounded-xl">
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">From Date</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">To Date</label>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <button 
                onClick={() => { setFilterYear(new Date().getFullYear()); setFilterMonth(""); setFromDate(""); setToDate(""); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase">Total Revenue</p>
              <h2 className="text-3xl font-bold text-blue-600 mt-2">{formatCurrency(processedData.totalRevenue)}</h2>
              <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <TrendingUp size={14} className="text-green-500"/> <span>+0.0% vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Wallet size={24}/></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase">Net Profit</p>
              <h2 className="text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(processedData.netProfit)}</h2>
              <div className="mt-2 text-xs text-gray-400">Based on Revenue (No Expense Data)</div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600"><ChartLine size={24}/></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase">Total Expenses</p>
              <h2 className="text-3xl font-bold text-red-500 mt-2">{formatCurrency(processedData.totalExpenses)}</h2>
              <div className="mt-2 text-xs text-gray-400">Data not available via Order APIs</div>
            </div>
            <div className="p-3 bg-red-50 rounded-full text-red-500"><Filter size={24}/></div>
          </div>
        </div>

        {/* Charts Row 1: Comparison & Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Comparison ({fromDate || toDate ? 'Selected Range' : filterYear})</h3>
            <div className="h-64 relative">
              <canvas ref={revenueComparisonRef}></canvas>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-semibold text-blue-700">Laundry Business</div>
                <div className="text-lg font-bold text-blue-900">{formatCurrency(processedData.laundryRevenue)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-semibold text-gray-700">Hotel Business</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(processedData.hotelRevenue)}</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Trend ({filterYear})</h3>
            <div className="h-64 relative">
              <canvas ref={monthlyTrendRef}></canvas>
            </div>
          </div>
        </div>

        {/* Business Sections: Laundry & Hotel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Laundry Business */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-600">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Laundry Business</h3>
              <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-bold">Primary</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-bold uppercase">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(processedData.laundryRevenue)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-bold uppercase">Orders</p>
                <p className="text-2xl font-bold text-gray-900">{processedData.laundryOrders}</p>
              </div>
            </div>

            <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Payment Methods</h4>
            <div className="grid grid-cols-2 gap-2 mb-6">
               {Object.entries(processedData.paymentTypes).map(([type, amount]) => (
                 <div key={type} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                   <span className="text-gray-600">{type} ({processedData.laundryOrders})</span>
                   <span className="font-bold text-gray-900">{formatCurrency(amount)}</span>
                 </div>
               ))}
            </div>

            <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Payments</h4>
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 capitalize">Pending Payment</div>
                <div className="text-sm font-bold text-gray-800">{formatCurrency(processedData.shopA.pendingAmt + processedData.shopB.pendingAmt)}</div>
                <div className="text-xs text-gray-400">{processedData.shopA.pendingCount + processedData.shopB.pendingCount}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 capitalize">Partial Payment</div>
                <div className="text-sm font-bold text-gray-800">{formatCurrency(processedData.shopA.partialAmt + processedData.shopB.partialAmt)}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 capitalize">Complete Payment</div>
                <div className="text-sm font-bold text-gray-800">{formatCurrency(processedData.shopA.completeAmt + processedData.shopB.completeAmt)}</div>
              </div>
            </div>

            <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Expenses</h4>
            <div className="p-4 bg-red-50 rounded-lg text-center text-red-800">
               Operational costs: <span className="font-bold ml-2">{formatCurrency(processedData.totalExpenses)}</span>
            </div>
          </div>

          {/* Hotel Business */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-gray-600">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Hotel Business</h3>
              <span className="bg-gray-200 text-gray-800 text-xs px-3 py-1 rounded-full font-bold">Secondary</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-bold uppercase">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(processedData.hotelRevenue)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-bold uppercase">Orders</p>
                <p className="text-2xl font-bold text-gray-900">{processedData.hotelOrders}</p>
              </div>
            </div>

            <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Profit & Expenses</h4>
            <div className="flex gap-4">
               <div className="flex-1 p-4 bg-gray-50 rounded-lg text-center">
                 <div className="text-xs text-gray-500">Net Profit</div>
                 <div className="text-lg font-bold text-gray-900">{formatCurrency(processedData.hotelRevenue)}</div>
               </div>
               <div className="flex-1 p-4 bg-red-50 rounded-lg text-center">
                 <div className="text-xs text-gray-500">Expenses</div>
                 <div className="text-lg font-bold text-red-700">{formatCurrency(0)}</div>
               </div>
            </div>
          </div>
        </div>

        {/* Shop Performance Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Shop A Performance</h3>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-gray-700">Revenue</span>
                <span className="font-bold text-blue-700">{formatCurrency(processedData.shopA.revenue)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-gray-700">Orders</span>
                <span className="font-bold text-gray-700">{processedData.shopA.count}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center bg-yellow-50 p-2 rounded">
                  <div className="text-yellow-800">Pending ({processedData.shopA.pendingCount})</div>
                  <div className="font-bold">{formatCurrency(processedData.shopA.pendingAmt)}</div>
                </div>
                <div className="text-center bg-blue-50 p-2 rounded">
                  <div className="text-blue-800">Partial ({processedData.shopA.partialCount})</div>
                  <div className="font-bold">{formatCurrency(processedData.shopA.partialAmt)}</div>
                </div>
                <div className="text-center bg-green-50 p-2 rounded">
                  <div className="text-green-800">Complete ({processedData.shopA.completeCount})</div>
                  <div className="font-bold">{formatCurrency(processedData.shopA.completeAmt)}</div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-gray-700">Profit</span>
                <span className="font-bold text-green-600">{formatCurrency(processedData.shopA.revenue)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-medium text-gray-700">Expenses</span>
                <span className="font-bold text-red-600">{formatCurrency(0)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Shop B Performance</h3>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
             <div className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-gray-700">Revenue</span>
                <span className="font-bold text-blue-700">{formatCurrency(processedData.shopB.revenue)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-gray-700">Orders</span>
                <span className="font-bold text-gray-700">{processedData.shopB.count}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center bg-yellow-50 p-2 rounded">
                  <div className="text-yellow-800">Pending ({processedData.shopB.pendingCount})</div>
                  <div className="font-bold">{formatCurrency(processedData.shopB.pendingAmt)}</div>
                </div>
                <div className="text-center bg-blue-50 p-2 rounded">
                  <div className="text-blue-800">Partial ({processedData.shopB.partialCount})</div>
                  <div className="font-bold">{formatCurrency(processedData.shopB.partialAmt)}</div>
                </div>
                <div className="text-center bg-green-50 p-2 rounded">
                  <div className="text-green-800">Complete ({processedData.shopB.completeCount})</div>
                  <div className="font-bold">{formatCurrency(processedData.shopB.completeAmt)}</div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-gray-700">Profit</span>
                <span className="font-bold text-green-600">{formatCurrency(processedData.shopB.revenue)}</span>
              </div>
               <div className="flex justify-between items-center pt-1">
                <span className="font-medium text-gray-700">Expenses</span>
                <span className="font-bold text-red-600">{formatCurrency(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Distribution Pie */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Revenue Distribution</h3>
           <div className="h-64 max-w-md mx-auto">
             <canvas ref={revenueDistributionRef}></canvas>
           </div>
        </div>

        {/* Insights Section */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Laundry Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Top Services */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Package size={20} className="text-blue-600"/>
                <h4 className="font-bold text-gray-700">Top Services</h4>
              </div>
              <div className="h-48">
                <canvas ref={topServicesRef}></canvas>
              </div>
            </div>

            {/* Top Items */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag size={20} className="text-blue-600"/>
                <h4 className="font-bold text-gray-700">Top Items</h4>
              </div>
              <div className="h-48">
                <canvas ref={topItemsRef}></canvas>
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Users size={20} className="text-blue-600"/>
                <h4 className="font-bold text-gray-700">Top Customers</h4>
              </div>
              <div className="h-48">
                <canvas ref={topCustomersRef}></canvas>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="text-center py-6 text-gray-400 text-sm">
        &copy; 2025 Laundry & Hotel Management System
      </div>
    </div>
  );
}