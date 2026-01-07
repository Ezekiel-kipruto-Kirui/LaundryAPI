import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import {
  TrendingUp,
  Wallet,
  ChartLine,
  ShoppingBag,
  CreditCard,
  Utensils,
  Filter,
  RefreshCw,
  Crown,
  Box,
  Bath
} from "lucide-react";
import Chart from 'chart.js/auto';
import { getAccessToken } from "@/services/api";
import { API_BASE_URL } from "@/services/url";

import type { Chart as ChartType } from 'chart.js/auto';

// --- Types & Interfaces ---

interface HotelOrderItem {
  id: number;
  total_price: number;
  created_at: string | null;
}

interface HotelOrder {
  id: number;
  order_items: HotelOrderItem[];
  total_amount: number | string;
  created_at: string;
  date?: string;
}

interface HotelExpense {
  id: number;
  amount: string;
  date: string;
}

interface LaundryOrderItem {
  id: number;
  servicetype: string[];
  itemname: string;
  created_at: string;
}

interface LaundryOrder {
  id: number;
  uniquecode: string;
  customer: {
    id: number;
    name: string;
  };
  payment_type: string;
  payment_status: "pending" | "partial" | "complete";
  shop: "Shop A" | "Shop B";
  total_price: string | number;
  balance: string | number;
  created_at: string;
  items: LaundryOrderItem[];
}

interface LaundryExpense {
  id: number;
  shop: "Shop A" | "Shop B";
  amount: string;
  date: string;
}

interface Customer {
  id: number;
  name: string;
}

interface TopCustomer {
  customerName: string;
  orderCount: number;
  totalSpent: number;
}

interface ShopMetrics {
  revenue: number;
  totalOrders: number;
  pendingPayments: number;
  pendingAmount: number;
  partialPayments: number;
  partialAmount: number;
  completePayments: number;
  completeAmount: number;
  netProfit: number;
  totalExpenses: number;
}

interface ProcessedData {
  totalBusinessRevenue: number;
  totalNetProfit: number;
  totalBusinessExpenses: number;
  hotelRevenue: number;
  hotelTotalOrders: number;
  hotelNetProfit: number;
  hotelTotalExpenses: number;
  laundryRevenue: number;
  cashPaymentsAmount: number;
  mpesaPaymentsAmount: number;
  cardPaymentsAmount: number;
  bankTransferPaymentsAmount: number;
  otherPaymentsAmount: number;
  nonePaymentsAmount: number;
  totalBalanceAmount: number;
  pendingPayments: number;
  totalPendingAmount: number;
  partialPayments: number;
  totalPartialAmount: number;
  completePayments: number;
  totalCompleteAmount: number;
  totalExpenses: number;
  shopA: ShopMetrics;
  shopB: ShopMetrics;
  revenueComparisonLabels: string[];
  revenueComparisonData: number[];
  revenueComparisonColors: string[];
  pieChartLabels: string[];
  pieChartValues: number[];
  lineChartData: Array<{
    label: string;
    months: string[];
    data: number[];
  }>;
  servicesLabels: string[];
  servicesCounts: number[];
  itemLabels: string[];
  itemCounts: number[];
  commonCustomers: TopCustomer[];
  monthlyData: Array<{
    month: string;
    year: number;
    hotelRevenue: number;
    laundryRevenue: number;
    totalRevenue: number;
    hotelExpenses: number;
    laundryExpenses: number;
    totalExpenses: number;
    netProfit: number;
  }>;
  paymentMethods: Array<{
    name: string;
    amount: number;
    count: number;
  }>;
  displayYear: number;
}

// --- Constants & Helpers ---

const COLOR_PALETTE = {
  navyBlue: '#1E3A8A',
  orangeYellow: '#F59E0B',
  lightOrange: '#FBBF24',
  pink: '#EC407A',
  lightPink: '#F48FB1',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  blue: '#36A2EB',
  red: '#FF6384',
  teal: '#4BC0C0'
};

const STYLE_MAPS = {
  card: {
    blue: 'bg-blue-50 text-blue-800',
    purple: 'bg-purple-50 text-purple-800',
    red: 'bg-red-50 text-red-800'
  },
  metric: {
    red: 'from-red-50 to-red-100 border-red-100',
    orange: 'from-orange-50 to-orange-100 border-orange-100',
    blue: 'from-blue-50 to-blue-100 border-blue-100',
    pink: 'from-pink-50 to-pink-100 border-pink-100',
    green: 'from-green-50 to-emerald-100 border-green-100'
  },
  badge: {
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800'
  },
  chartTitle: {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    gray: 'text-gray-500',
    blue: 'text-blue-500',
    red: 'text-red-500'
  }
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
const formatCurrencyFull = (amount: number) => new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const CHART_COMMON_OPTIONS = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: { labels: { color: '#1E293B', font: { size: 11, weight: 500 } } },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      titleColor: '#1E293B',
      bodyColor: '#1E293B',
      callbacks: { label: (ctx: any) => `Ksh ${ctx.raw.toLocaleString('en-US')}` }
    }
  }
};

const parseMoney = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleanStr = String(val).replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
};

// FIXED: Improved Date Extraction to avoid Timezone shifting
const getISODate = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  // Check if it's an ISO string (YYYY-MM-DDTHH:mm:ss...)
  // We extract the date part directly to preserve the business day.
  // Example: "2026-01-02T17:58:38.708259+03:00" -> "2026-01-02"
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  // Fallback for other formats
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
};

// --- Main Component ---

export default function PerformanceReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [rawData, setRawData] = useState<{
    hotelOrders: HotelOrder[];
    hotelExpenses: HotelExpense[];
    laundryOrders: LaundryOrder[];
    laundryExpenses: LaundryExpense[];
    customers: Customer[];
  } | null>(null);

  // State for Date Range Filtering
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [today] = useState(new Date().toISOString().split('T')[0]);

  const revenueComparisonChartRef = useRef<HTMLCanvasElement>(null);
  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const servicesChartRef = useRef<HTMLCanvasElement>(null);
  const productsChartRef = useRef<HTMLCanvasElement>(null);

  const chartInstances = useRef<Map<HTMLCanvasElement, ChartType>>(new Map());
  const updateIntervalRef = useRef<NodeJS.Timeout>();

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const simpleFetch = async (url: string) => {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        const data = await response.json();
        return Array.isArray(data) ? data : (data.results || []);
      };

      const [hotelOrders, hotelExpenses, laundryOrders, laundryExpenses, customers] = await Promise.all([
        simpleFetch(`${API_BASE_URL}/Hotel/orders/`),
        simpleFetch(`${API_BASE_URL}/Hotel/Hotelexpense-records/`),
        simpleFetch(`${API_BASE_URL}/Laundry/orders/`),
        simpleFetch(`${API_BASE_URL}/Laundry/expense-records/`),
        simpleFetch(`${API_BASE_URL}/Laundry/customers/`)
      ]);

      setRawData({ hotelOrders, hotelExpenses, laundryOrders, laundryExpenses, customers });
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    updateIntervalRef.current = interval;

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, [fetchData]);

  const calculateShopMetrics = useCallback((
    orders: LaundryOrder[], 
    expenses: LaundryExpense[], 
    shopName: "Shop A" | "Shop B",
    isDateInRange: (dateStr: string) => boolean
  ): ShopMetrics => {
    const shopOrders = orders.filter(o => o.shop === shopName && isDateInRange(o.created_at));
    const revenue = shopOrders.reduce((sum, order) => sum + parseMoney(order.total_price), 0);
    const totalOrders = shopOrders.length;
    
    const pendingOrders = shopOrders.filter(o => o.payment_status === 'pending');
    const partialOrders = shopOrders.filter(o => o.payment_status === 'partial');
    const completeOrders = shopOrders.filter(o => o.payment_status === 'complete');

    const shopExpenses = expenses.filter(e => e.shop === shopName && isDateInRange(e.date))
      .reduce((sum, expense) => sum + parseMoney(expense.amount), 0);

    return {
      revenue,
      totalOrders,
      pendingPayments: pendingOrders.length,
      pendingAmount: pendingOrders.reduce((sum, o) => sum + parseMoney(o.total_price), 0),
      partialPayments: partialOrders.length,
      partialAmount: partialOrders.reduce((sum, o) => sum + parseMoney(o.total_price), 0),
      completePayments: completeOrders.length,
      completeAmount: completeOrders.reduce((sum, o) => sum + parseMoney(o.total_price), 0),
      netProfit: revenue - shopExpenses,
      totalExpenses: shopExpenses
    };
  }, []);

  const data = useMemo<ProcessedData | null>(() => {
    if (!rawData) return null;

    const { hotelOrders, hotelExpenses, laundryOrders, laundryExpenses, customers } = rawData;

    // --- LOGIC FIX: Determine Display Year ---
    // If a date range is selected by user, use that year.
    // Otherwise, default to the latest year found in the data (to avoid showing 2025 when data is 2026).
    // Fallback to current system year if no data exists.
    let derivedYear = new Date().getFullYear();
    
    if (fromDate) {
      derivedYear = new Date(fromDate).getFullYear();
    } else {
      // Auto-detect latest year from available data
      const years: number[] = [];
      hotelOrders.forEach(o => {
         const d = getISODate(o.created_at || o.date);
         if(d) years.push(parseInt(d.split('-')[0], 10));
      });
      laundryOrders.forEach(o => {
         const d = getISODate(o.created_at);
         if(d) years.push(parseInt(d.split('-')[0], 10));
      });
      hotelExpenses.forEach(e => {
         const d = getISODate(e.date);
         if(d) years.push(parseInt(d.split('-')[0], 10));
      });
      laundryExpenses.forEach(e => {
         const d = getISODate(e.date);
         if(d) years.push(parseInt(d.split('-')[0], 10));
      });

      if (years.length > 0) {
        derivedYear = Math.max(...years);
      }
    }

    // FILTERING LOGIC
    // If no range is selected, we default to the full derived year (Jan 1 to Dec 31)
    const effectiveStartDate = fromDate || `${derivedYear}-01-01`;
    const effectiveEndDate = toDate || `${derivedYear}-12-31`;

    // DEBUG: Log date filter details
    console.log('[DEBUG] Date Filter Details:', {
      fromDate,
      toDate,
      derivedYear,
      effectiveStartDate,
      effectiveEndDate,
      today
    });

    // Pre-filter totals for comparison
    const rawHotelRevenue = hotelOrders.reduce((sum, order) => sum + parseMoney(order.total_amount || (order as any).total), 0);
    const rawLaundryRevenue = laundryOrders.reduce((sum, order) => sum + parseMoney(order.total_price), 0);
    
    console.log('[DEBUG] Raw totals (no filter):', {
      hotelRevenue: rawHotelRevenue,
      laundryRevenue: rawLaundryRevenue,
      hotelOrders: hotelOrders.length,
      laundryOrders: laundryOrders.length
    });

    const isDateInRange = (dateString: string | null | undefined, source: string = 'unknown'): boolean => {
      if (!dateString) return false;
      const itemISO = getISODate(dateString);
      if (!itemISO) {
        console.log(`[DEBUG] isDateInRange: Failed to parse date "${dateString}" from ${source}`);
        return false;
      }
      
      const inRange = itemISO >= effectiveStartDate && itemISO <= effectiveEndDate;
      // Only log if in range to avoid spam
      if (inRange) {
        console.log(`[DEBUG] isDateInRange: "${dateString}" -> "${itemISO}" is IN range [${effectiveStartDate} to ${effectiveEndDate}]`);
      }
      return inRange;
    };

    const filteredHotelOrders = hotelOrders.filter(order => isDateInRange(order.created_at || order.date, 'hotelOrder'));
    const filteredLaundryOrders = laundryOrders.filter(order => isDateInRange(order.created_at, 'laundryOrder'));

    // Hotel Calcs
    const hotelRevenue = filteredHotelOrders.reduce((sum, order) => sum + parseMoney(order.total_amount || (order as any).total), 0);
    const hotelTotalOrders = filteredHotelOrders.length;
    const hotelExpensesTotal = hotelExpenses.filter(e => isDateInRange(e.date, 'hotelExpense')).reduce((sum, expense) => sum + parseMoney(expense.amount), 0);
    const hotelNetProfit = hotelRevenue - hotelExpensesTotal;

    // DEBUG: Sample of hotel order dates
    console.log('[DEBUG] Sample Hotel Order Dates (first 5):', 
      hotelOrders.slice(0, 5).map(o => ({
        id: o.id,
        created_at: o.created_at,
        isoDate: getISODate(o.created_at || o.date),
        total: o.total_amount
      }))
    );

    // Laundry Calcs
    const laundryRevenue = filteredLaundryOrders.reduce((sum, order) => sum + parseMoney(order.total_price), 0);
    const laundryExpensesTotal = laundryExpenses.filter(e => isDateInRange(e.date, 'laundryExpense')).reduce((sum, expense) => sum + parseMoney(expense.amount), 0);
    const laundryNetProfit = laundryRevenue - laundryExpensesTotal;

    // DEBUG: Sample of laundry order dates
    console.log('[DEBUG] Sample Laundry Order Dates (first 5):', 
      laundryOrders.slice(0, 5).map(o => ({
        id: o.id,
        created_at: o.created_at,
        isoDate: getISODate(o.created_at),
        total: o.total_price
      }))
    );

    console.log('[DEBUG] Filtered totals (with date filter):', {
      hotelRevenue,
      laundryRevenue,
      filteredHotelOrders: filteredHotelOrders.length,
      filteredLaundryOrders: filteredLaundryOrders.length
    });

    const totalBusinessRevenue = hotelRevenue + laundryRevenue;
    const totalBusinessExpenses = hotelExpensesTotal + laundryExpensesTotal;
    const totalNetProfit = totalBusinessRevenue - totalBusinessExpenses;

    // Shop Metrics
    const shopA = calculateShopMetrics(filteredLaundryOrders, laundryExpenses.filter(e => isDateInRange(e.date, 'shopAExpense')), 'Shop A', isDateInRange);
    const shopB = calculateShopMetrics(filteredLaundryOrders, laundryExpenses.filter(e => isDateInRange(e.date, 'shopBExpense')), 'Shop B', isDateInRange);

    // Payment Methods
    const paymentMethodsData: Record<string, { amount: number; count: number }> = {};
    filteredLaundryOrders.forEach(order => {
      // Ensure we handle the string "None" or other cases correctly
      const type = (order.payment_type || 'none').toString().toLowerCase();
      if (!paymentMethodsData[type]) paymentMethodsData[type] = { amount: 0, count: 0 };
      paymentMethodsData[type].amount += parseMoney(order.total_price);
      paymentMethodsData[type].count += 1;
    });

    const paymentMethods = Object.entries(paymentMethodsData).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      amount: data.amount,
      count: data.count
    }));

    const getPaymentAmount = (key: string) => paymentMethodsData[key]?.amount || 0;
    
    const getStatsByStatus = (status: string) => {
      const subset = filteredLaundryOrders.filter(o => o.payment_status === status);
      return { 
        count: subset.length, 
        amount: subset.reduce((sum, o) => sum + parseMoney(o.total_price), 0) 
      };
    };
    const pendingStats = getStatsByStatus('pending');
    const partialStats = getStatsByStatus('partial');
    const completeStats = getStatsByStatus('complete');
    const totalBalanceAmount = filteredLaundryOrders.reduce((sum, order) => sum + parseMoney(order.balance), 0);

    // Top Customers
    const customerMap = new Map<string, { count: number; total: number }>();
    filteredLaundryOrders.forEach(order => {
      if (order.customer?.name) {
        const curr = customerMap.get(order.customer.name) || { count: 0, total: 0 };
        curr.count++;
        curr.total += parseMoney(order.total_price);
        customerMap.set(order.customer.name, curr);
      }
    });
    
    const commonCustomers = Array.from(customerMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, stats]) => ({ customerName: name, orderCount: stats.count, totalSpent: stats.total }));

    const tallyItems = (keyExtractor: (item: any) => string) => {
      const counts: Record<string, number> = {};
      filteredLaundryOrders.forEach(order => {
        order.items?.forEach(item => {
          const key = keyExtractor(item);
          if (key) counts[key] = (counts[key] || 0) + 1;
        });
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    };

    const topServices = tallyItems(item => Array.isArray(item.servicetype) ? item.servicetype[0] : '');
    const topItems = tallyItems(item => item.itemname);

    // Monthly Trend - Always plots the derivedYear context
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyHotelRevenue = Array(12).fill(0);
    const monthlyLaundryRevenue = Array(12).fill(0);
    const monthlyHotelExpenses = Array(12).fill(0);
    const monthlyLaundryExpenses = Array(12).fill(0);

    // DEBUG: Log date range and data counts
    console.log('[DEBUG] Monthly Aggregation - Date Range:', { effectiveStartDate, effectiveEndDate, derivedYear });
    console.log('[DEBUG] Raw data counts:', {
      hotelOrders: hotelOrders.length,
      laundryOrders: laundryOrders.length,
      hotelExpenses: hotelExpenses.length,
      laundryExpenses: laundryExpenses.length
    });
    console.log('[DEBUG] Filtered data counts:', {
      filteredHotelOrders: filteredHotelOrders.length,
      filteredLaundryOrders: filteredLaundryOrders.length
    });

    const processMonthly = (items: any[], dateKey: string, valKey: string, arr: number[], sourceName: string) => {
      let processedCount = 0;
      items.forEach(item => {
        const dateVal = dateKey === 'created_at' ? (item.created_at || item.date) : item[dateKey];
        const itemISO = getISODate(dateVal);
        // DEBUG: Log each date processing
        if (itemISO && itemISO.startsWith(String(derivedYear))) {
          const monthIndex = parseInt(itemISO.split('-')[1], 10) - 1; // 0-11
          if (monthIndex >= 0 && monthIndex <= 11) {
            arr[monthIndex] += parseMoney(item[valKey] || (valKey === 'total_amount' ? (item as any).total : 0));
            processedCount++;
          }
        }
      });
      console.log(`[DEBUG] ${sourceName}: processed ${processedCount} items out of ${items.length}`);
    };

    // FIX: Use filtered data instead of raw data for monthly aggregation
    processMonthly(filteredHotelOrders, 'created_at', 'total_amount', monthlyHotelRevenue, 'Hotel Orders');
    processMonthly(filteredLaundryOrders, 'created_at', 'total_price', monthlyLaundryRevenue, 'Laundry Orders');
    // Filter expenses by date range for monthly aggregation
    const filteredHotelExpenses = hotelExpenses.filter(e => isDateInRange(e.date));
    const filteredLaundryExpenses = laundryExpenses.filter(e => isDateInRange(e.date));
    processMonthly(filteredHotelExpenses, 'date', 'amount', monthlyHotelExpenses, 'Hotel Expenses');
    processMonthly(filteredLaundryExpenses, 'date', 'amount', monthlyLaundryExpenses, 'Laundry Expenses');

    const monthlyData = months.map((m, i) => {
      const totalRevenue = monthlyHotelRevenue[i] + monthlyLaundryRevenue[i];
      const totalExpenses = monthlyHotelExpenses[i] + monthlyLaundryExpenses[i];
      const dataPoint = {
        month: m,
        year: derivedYear,
        hotelRevenue: monthlyHotelRevenue[i],
        laundryRevenue: monthlyLaundryRevenue[i],
        totalRevenue,
        hotelExpenses: monthlyHotelExpenses[i],
        laundryExpenses: monthlyLaundryExpenses[i],
        totalExpenses,
        netProfit: totalRevenue - totalExpenses
      };
      return dataPoint;
    });

    // DEBUG: Log monthly data summary
    console.log('[DEBUG] Monthly Data Summary:', {
      year: derivedYear,
      months: monthlyData.map(d => ({
        month: d.month,
        hotelRevenue: d.hotelRevenue,
        laundryRevenue: d.laundryRevenue,
        totalRevenue: d.totalRevenue,
        netProfit: d.netProfit
      }))
    });

    return {
      totalBusinessRevenue,
      totalNetProfit,
      totalBusinessExpenses,
      hotelRevenue,
      hotelTotalOrders,
      hotelNetProfit,
      hotelTotalExpenses: hotelExpensesTotal,
      laundryRevenue,
      cashPaymentsAmount: getPaymentAmount('cash'),
      mpesaPaymentsAmount: getPaymentAmount('mpesa'),
      cardPaymentsAmount: getPaymentAmount('card'),
      bankTransferPaymentsAmount: getPaymentAmount('bank'),
      otherPaymentsAmount: Object.entries(paymentMethodsData)
        .filter(([k]) => !['cash', 'mpesa', 'card', 'bank', 'none'].includes(k))
        .reduce((sum, [, data]) => sum + data.amount, 0),
      nonePaymentsAmount: getPaymentAmount('none'),
      totalBalanceAmount,
      pendingPayments: pendingStats.count,
      totalPendingAmount: pendingStats.amount,
      partialPayments: partialStats.count,
      totalPartialAmount: partialStats.amount,
      completePayments: completeStats.count,
      totalCompleteAmount: completeStats.amount,
      totalExpenses: laundryExpensesTotal,
      shopA,
      shopB,
      revenueComparisonLabels: ['Laundry', 'Hotel'],
      revenueComparisonData: [laundryRevenue, hotelRevenue],
      revenueComparisonColors: [COLOR_PALETTE.blue, COLOR_PALETTE.red],
      pieChartLabels: ['Shop A', 'Shop B', 'Hotel'],
      pieChartValues: [shopA.revenue, shopB.revenue, hotelRevenue],
      lineChartData: [
        { label: 'Laundry Revenue', months, data: monthlyLaundryRevenue },
        { label: 'Hotel Revenue', months, data: monthlyHotelRevenue }
      ],
      servicesLabels: topServices.map(([k]) => k),
      servicesCounts: topServices.map(([, v]) => v),
      itemLabels: topItems.map(([k]) => k),
      itemCounts: topItems.map(([, v]) => v),
      commonCustomers,
      monthlyData,
      paymentMethods,
      displayYear: derivedYear
    };
  }, [rawData, fromDate, toDate, calculateShopMetrics]);

  // --- Chart Rendering ---
  useEffect(() => {
    if (!data) return;

    const createChart = (ref: React.RefObject<HTMLCanvasElement>, config: any) => {
      if (!ref.current) return;

      const existingChart = chartInstances.current.get(ref.current);
      if (existingChart) {
        existingChart.destroy();
        chartInstances.current.delete(ref.current);
      }

      const ctx = ref.current.getContext('2d');
      if (!ctx) return;
      const chart = new Chart(ctx, config);
      chartInstances.current.set(ref.current, chart);
    };

    createChart(revenueComparisonChartRef, {
      type: 'doughnut',
      data: {
        labels: data.revenueComparisonLabels,
        datasets: [{ data: data.revenueComparisonData, backgroundColor: data.revenueComparisonColors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: { ...CHART_COMMON_OPTIONS, cutout: '70%', plugins: { ...CHART_COMMON_OPTIONS.plugins, legend: { position: 'bottom' } } }
    });

    createChart(revenueChartRef, {
      type: 'doughnut',
      data: {
        labels: data.pieChartLabels,
        datasets: [{ data: data.pieChartValues, backgroundColor: [COLOR_PALETTE.navyBlue, COLOR_PALETTE.orangeYellow, COLOR_PALETTE.lightOrange], borderWidth: 0, hoverOffset: 4 }]
      },
      options: { ...CHART_COMMON_OPTIONS, cutout: '70%', plugins: { ...CHART_COMMON_OPTIONS.plugins, legend: { position: 'bottom' } } }
    });

    createChart(trendChartRef, {
      type: 'line',
      data: {
        labels: data.lineChartData[0].months,
        datasets: data.lineChartData.map((series, i) => ({
          label: series.label,
          data: series.data,
          borderColor: [COLOR_PALETTE.pink, COLOR_PALETTE.orangeYellow][i],
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }))
      },
      options: {
        ...CHART_COMMON_OPTIONS,
        scales: { x: { grid: { display: false }, ticks: { color: '#1E293B' } }, y: { display: false, grid: { display: false } } },
        interaction: { mode: 'index', intersect: false }
      }
    });

    if (data.servicesLabels.length > 0) {
      createChart(servicesChartRef, {
        type: 'bar',
        data: {
          labels: data.servicesLabels,
          datasets: [{ data: data.servicesCounts, backgroundColor: [COLOR_PALETTE.navyBlue, COLOR_PALETTE.orangeYellow, COLOR_PALETTE.pink, COLOR_PALETTE.success], borderRadius: 4, barThickness: 10 }]
        },
        options: { ...CHART_COMMON_OPTIONS, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false } } } }
      });
    } else {
       if (servicesChartRef.current) {
          const chart = chartInstances.current.get(servicesChartRef.current);
          if(chart) chart.destroy();
       }
    }

    if (data.itemLabels.length > 0) {
      createChart(productsChartRef, {
        type: 'bar',
        data: {
          labels: data.itemLabels,
          datasets: [{ data: data.itemCounts, backgroundColor: [COLOR_PALETTE.navyBlue, COLOR_PALETTE.orangeYellow, COLOR_PALETTE.pink, COLOR_PALETTE.success], borderRadius: 4, barThickness: 10 }]
        },
        options: { ...CHART_COMMON_OPTIONS, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false } } } }
      });
    } else {
       if (productsChartRef.current) {
          const chart = chartInstances.current.get(productsChartRef.current);
          if(chart) chart.destroy();
       }
    }

    return () => {
      chartInstances.current.forEach(chart => chart.destroy());
      chartInstances.current.clear();
    };
  }, [data]);

  // --- Handlers ---

  const handleFromDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFromDate(e.target.value);
  }, []);

  const handleToDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setToDate(e.target.value);
  }, []);

  const handleReset = useCallback(() => {
    setFromDate("");
    setToDate("");
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-lg">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Business Performance Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              {(fromDate || toDate) ? `Range: ${fromDate || '...'} to ${toDate || '...'}` : 
               `Year Overview - ${data?.displayYear}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
          <Filter className="h-5 w-5 text-blue-500" />
          <span className="font-semibold text-gray-700">{data?.displayYear}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input type="date" value={fromDate} onChange={handleFromDateChange} max={today} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input type="date" value={toDate} onChange={handleToDateChange} max={today} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={fetchData} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5" /> Refresh
            </button>
            <button onClick={handleReset} className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2">
              <Filter className="h-5 w-5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Business Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard icon={<Wallet className="h-5 w-5 text-blue-600" />} bg="blue" title="Total Revenue" value={`Ksh ${formatCurrencyFull(data?.totalBusinessRevenue || 0)}`} subtitle="Combined earnings" />
        <StatCard icon={<ChartLine className="h-5 w-5 text-purple-600" />} bg="purple" title="Net Profit" value={`Ksh ${formatCurrencyFull(data?.totalNetProfit || 0)}`} subtitle="After expenses" />
        <StatCard icon={<Wallet className="h-5 w-5 text-red-600" />} bg="red" title="Total Expenses" value={`Ksh ${formatCurrencyFull(data?.totalBusinessExpenses || 0)}`} subtitle="Combined expenses" />
      </div>

      {/* Revenue Comparison & Hotel Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">Revenue Comparison</h2>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">{data?.displayYear}</span>
          </div>
          <div className="h-64"><canvas ref={revenueComparisonChartRef} /></div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-semibold text-blue-700">Laundry Business</div>
              <div className="text-lg font-bold text-blue-900">Ksh {formatCurrencyFull(data?.laundryRevenue || 0)}</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-sm font-semibold text-red-700">Hotel Business</div>
              <div className="text-lg font-bold text-red-900">Ksh {formatCurrencyFull(data?.hotelRevenue || 0)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-gradient-to-b from-red-500 to-orange-600 rounded-full"></div>
              <h2 className="text-lg font-bold text-gray-900">Hotel Business</h2>
            </div>
          </div>
          <div className="space-y-4">
            <MetricBox label="Revenue" value={`Ksh ${formatCurrencyFull(data?.hotelRevenue || 0)}`} sub={`${data?.hotelTotalOrders} orders`} color="red" icon={<Wallet />} />
            <MetricBox label="Orders" value={`${data?.hotelTotalOrders}`} color="orange" icon={<Utensils />} />
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
              <div className="flex items-center gap-3 mb-2">
                <ChartLine className="h-5 w-5 text-green-600" />
                <span className="text-sm font-semibold text-gray-700">Profit & Expenses</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <div className="text-lg font-bold text-green-600">Ksh {formatCurrencyFull(data?.hotelNetProfit || 0)}</div>
                  <div className="text-xs text-gray-500">Net Profit</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">Ksh {formatCurrencyFull(data?.hotelTotalExpenses || 0)}</div>
                  <div className="text-xs text-gray-500">Expenses</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Laundry Business Stats */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
          <h2 className="text-xl font-bold text-gray-900">Laundry Business</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Wallet className="h-5 w-5 text-blue-600" /></div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Revenue</h3>
                <div className="text-xl font-bold text-gray-900">Ksh {formatCurrencyFull(data?.laundryRevenue || 0)}</div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Methods</h4>
              <div className="space-y-2">
                {data?.paymentMethods.map((method, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{method.name} <span className="text-xs text-gray-500">({method.count})</span></span>
                    <span className="font-bold text-gray-900">Ksh {formatCurrency(method.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
             <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center"><CreditCard className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Payments</h3>
                <div className="text-xl font-bold text-gray-900">Ksh {formatCurrency(data?.totalBalanceAmount || 0)}</div>
              </div>
            </div>
            <div className="space-y-3">
              <PaymentBadge label="Pending" count={data?.pendingPayments} amount={data?.totalPendingAmount} color="yellow" />
              <PaymentBadge label="Partial" count={data?.partialPayments} amount={data?.totalPartialAmount} color="blue" />
              <PaymentBadge label="Complete" count={data?.completePayments} amount={data?.totalCompleteAmount} color="green" />
            </div>
          </div>

           <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
             <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><Wallet className="h-5 w-5 text-red-600" /></div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Expenses</h3>
                  <div className="text-xl font-bold text-gray-900">Ksh {formatCurrencyFull(data?.totalExpenses || 0)}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-500 mt-4">
              <ChartLine className="h-3 w-3 text-red-500 mr-1" /> <span>Operational costs</span>
            </div>
          </div>
        </div>

        {/* Shop Performance Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ShopPerformanceCard title="Shop A" metrics={data?.shopA} />
          <ShopPerformanceCard title="Shop B" metrics={data?.shopB} />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">Revenue Distribution</h2>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">Total</span>
          </div>
          <div className="h-64"><canvas ref={revenueChartRef} /></div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">Revenue Trend - {data?.displayYear}</h2>
            <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm font-semibold">Monthly</span>
          </div>
          <div className="h-64"><canvas ref={trendChartRef} /></div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChartCard title="Top Services" color="green" icon={<Bath />} canvasRef={servicesChartRef} dataAvailable={!!data?.servicesLabels.length} />
        <ChartCard title="Common Items" color="yellow" icon={<Box />} canvasRef={productsChartRef} dataAvailable={!!data?.itemLabels.length} />
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Crown className="h-5 w-5 text-yellow-500" /> Top Customers</h2>
          </div>
          <div className="h-72 overflow-y-auto pr-2">
            {data?.commonCustomers.length ? data.commonCustomers.map((c, i) => (
              <div key={i} className="flex items-center p-4 bg-gray-50 rounded-lg mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold mr-4">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 truncate">{c.customerName}</div>
                  <div className="text-xs text-gray-500">{c.orderCount} orders</div>
                </div>
                <div className="font-bold text-pink-600">Ksh {formatCurrency(c.totalSpent)}</div>
              </div>
            )) : <div className="text-center text-gray-500 mt-10">No data available</div>}
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 p-4 rounded-lg shadow-lg flex justify-between items-center z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-900 font-bold ml-4">✕</button>
        </div>
      )}
    </div>
  );
}

// --- Optimized Sub-Components ---

const StatCard = memo(({ icon, bg, title, value, subtitle }: { 
  icon: React.ReactNode, 
  bg: 'blue' | 'purple' | 'red', 
  title: string, 
  value: string, 
  subtitle: string 
}) => {
  const classes = STYLE_MAPS.card[bg];
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg ${classes.split(' ')[0]} flex items-center justify-center`}>{icon}</div>
        <span className={`${classes} text-xs font-semibold px-2 py-1 rounded-full capitalize`}>Total</span>
      </div>
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</h3>
      <div className="text-xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="flex items-center text-xs text-gray-500"><TrendingUp className="h-3 w-3 text-green-500 mr-1" /> <span>{subtitle}</span></div>
    </div>
  );
});

const MetricBox = memo(({ label, value, sub, color, icon }: { 
  label: string; 
  value: string; 
  sub?: string; 
  color: string; 
  icon: React.ReactNode 
}) => {
  const classes = STYLE_MAPS.metric[color as keyof typeof STYLE_MAPS.metric] || STYLE_MAPS.metric.blue;

  return (
    <div className={`bg-gradient-to-br ${classes} rounded-lg p-4 border`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm`}>{icon}</div>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900 mb-1">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
});

const PaymentBadge = memo(({ label, count, amount, color }: { 
  label: string; 
  count?: number; 
  amount?: number; 
  color: 'yellow' | 'blue' | 'green' 
}) => {
  const classes = STYLE_MAPS.badge[color];

  return (
    <div className="flex justify-between items-center">
      <div>
        <span className={`${classes} px-2 py-1 rounded-full text-xs font-medium mr-2`}>{count}</span>
        <span className="text-sm text-gray-700">{label} Payment</span>
      </div>
      <span className={`${classes} px-2 py-1 rounded-full text-xs font-medium`}>{amount ? formatCurrency(amount) : 'Ksh 0'}</span>
    </div>
  );
});

const ShopPerformanceCard = memo(({ title, metrics }: { title: string, metrics?: ShopMetrics }) => {
  if (!metrics) return null;
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
          <h2 className="text-lg font-bold text-gray-900">{title} Performance</h2>
        </div>
        <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">Active</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricBox label="Revenue" value={`Ksh ${formatCurrencyFull(metrics.revenue)}`} sub={`${title} earnings`} color="blue" icon={<Wallet className="h-5 w-5 text-gray-600" />} />
        <MetricBox label="Orders" value={`${metrics.totalOrders}`} color="blue" icon={<ShoppingBag className="h-5 w-5 text-blue-600" />} />
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center gap-3 mb-2"><CreditCard className="h-5 w-5 text-purple-600" /><span className="text-sm font-semibold text-gray-700">Payments</span></div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between"><span className="text-yellow-600">{metrics.pendingPayments} pending</span><span className="text-yellow-600">Ksh {formatCurrency(metrics.pendingAmount)}</span></div>
            <div className="flex justify-between"><span className="text-blue-600">{metrics.partialPayments} partial</span><span className="text-blue-600">Ksh {formatCurrency(metrics.partialAmount)}</span></div>
            <div className="flex justify-between"><span className="text-green-600">{metrics.completePayments} complete</span><span className="text-green-600">Ksh {formatCurrency(metrics.completeAmount)}</span></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center gap-3 mb-2"><ChartLine className="h-5 w-5 text-green-600" /><span className="text-sm font-semibold text-gray-700">Profit & Expenses</span></div>
          <div className="flex flex-col gap-2">
            <div>
              <div className="text-md font-bold text-green-600">Ksh {formatCurrencyFull(metrics.netProfit)}</div>
              <div className="text-xs text-gray-500">Profit</div>
            </div>
            <div>
              <div className="text-md font-bold text-blue-600">Ksh {formatCurrencyFull(metrics.totalExpenses)}</div>
              <div className="text-xs text-gray-500">Expenses</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const ChartCard = memo(({ title, icon, canvasRef, dataAvailable, color = "gray" }: { 
  title: string, 
  icon: React.ReactNode, 
  canvasRef: React.RefObject<HTMLCanvasElement>, 
  dataAvailable: boolean,
  color?: 'green' | 'yellow' | 'gray' | 'blue' | 'red'
}) => {
  const titleColorClass = STYLE_MAPS.chartTitle[color] || STYLE_MAPS.chartTitle.gray;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          {icon}
          <span className={titleColorClass}>{title}</span>
        </h2>
      </div>
      <div className="h-72">
        {dataAvailable ? (
          <canvas ref={canvasRef} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            {icon}
            <p className="mt-2">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
});