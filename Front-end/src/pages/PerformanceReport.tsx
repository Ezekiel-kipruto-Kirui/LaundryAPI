import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
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
import { fetchApi } from "@/services/api";
import Chart from 'chart.js/auto';
import 'chartjs-plugin-datalabels';

// Type imports
import type { ChartDataset, ChartTypeRegistry, TooltipItem } from 'chart.js';

// Interfaces - UPDATED BASED ON API RESPONSES
interface HotelOrderItem {
  id: number;
  food_item_name: string;
  total_price: number;
  quantity: number;
  price: string;
  name: string | null;
  oncredit: boolean;
  created_at: string | null;
  order: number;
  food_item: number;
}

interface HotelOrder {
  id: number;
  order_items: HotelOrderItem[];
  total_amount: number;
  created_by_username: string | null;
  created_by_email: string;
  created_at: string;
  created_by: number;
}

interface HotelOrdersResponse {
  total_items: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: HotelOrder[];
}

interface HotelExpense {
  id: number;
  field: {
    id: number;
    label: string;
    created_at: string;
  };
  amount: string;
  date: string;
  notes: string | null;
}

interface LaundryOrderItem {
  id: number;
  servicetype: string[];
  itemtype: string;
  itemname: string;
  quantity: number;
  itemcondition: string;
  additional_info: string | null;
  unit_price: string;
  total_item_price: string;
  created_at: string;
}

interface LaundryOrder {
  id: number;
  uniquecode: string;
  customer: {
    id: number;
    name: string;
    phone: string;
    created_by: any;
  };
  payment_type: string;
  payment_status: "pending" | "partial" | "complete";
  shop: "Shop A" | "Shop B";
  delivery_date: string;
  order_status: string;
  addressdetails: string;
  amount_paid: string;
  total_price: string;
  balance: string;
  created_at: string;
  updated_at: string;
  created_by: any;
  updated_by: any;
  items: LaundryOrderItem[];
}

interface LaundryExpense {
  id: number;
  field: {
    id: number;
    label: string;
    created_at: string;
  };
  shop: "Shop A" | "Shop B";
  amount: string;
  date: string;
  notes: string | null;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  created_by: any;
}

interface TopCustomer {
  customerName: string;
  orderCount: number;
  totalSpent: number;
}

interface ProcessedData {
  // Summary Stats
  totalBusinessRevenue: number;
  totalNetProfit: number;
  totalBusinessExpenses: number;

  // Hotel Stats
  hotelRevenue: number;
  hotelTotalOrders: number;
  hotelInProgressOrders: number;
  hotelServedOrders: number;
  hotelNetProfit: number;
  hotelTotalExpenses: number;

  // Laundry Stats
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

  // Shop Stats
  shopARevenue: number;
  shopATotalOrders: number;
  shopAPendingPayments: number;
  shopAPendingAmount: number;
  shopAPartialPayments: number;
  shopAPartialAmount: number;
  shopACompletePayments: number;
  shopACompleteAmount: number;
  shopANetProfit: number;
  shopATotalExpenses: number;

  shopBRevenue: number;
  shopBTotalOrders: number;
  shopBPendingPayments: number;
  shopBPendingAmount: number;
  shopBPartialPayments: number;
  shopBPartialAmount: number;
  shopBCompletePayments: number;
  shopBCompleteAmount: number;
  shopBNetProfit: number;
  shopBTotalExpenses: number;

  // Chart Data
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

  currentYear: number;
  selectedMonth?: number;
}

// Helper function to safely extract array from response
const extractArrayFromResponse = (response: any): any[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.results && Array.isArray(response.results)) return response.results;
  return [];
};

// Type guard for paginated response
const isPaginatedResponse = (response: any): response is { next: string | null; results: any[] } => {
  return response && typeof response === 'object' && 'results' in response;
};

// Type guard for HotelOrdersResponse
const isHotelOrdersResponse = (response: any): response is HotelOrdersResponse => {
  return response && typeof response === 'object' && 'results' in response;
};

// Helper function to fetch all paginated data
const fetchAllPaginatedData = async (endpoint: string, service: "hotel" | "laundry" | "auth"): Promise<any[]> => {
  let allData: any[] = [];
  let nextUrl: string | null = endpoint;
  
  while (nextUrl) {
    try {
      const response = await fetchApi(nextUrl, { method: 'GET' }, service);
      
      // Check if response is a paginated response
      if (isPaginatedResponse(response)) {
        const data = extractArrayFromResponse(response);
        allData = [...allData, ...data];
        
        // Check for next page
        if (response.next) {
          nextUrl = response.next;
        } else {
          nextUrl = null;
        }
      } else {
        // If not paginated, treat as array
        const data = extractArrayFromResponse(response);
        allData = [...allData, ...data];
        nextUrl = null;
      }
    } catch (error) {
      console.error(`Error fetching paginated data from ${endpoint}:`, error);
      nextUrl = null;
    }
  }
  
  return allData;
};

export default function PerformanceReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcessedData | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [today] = useState(new Date().toISOString().split('T')[0]);

  // Chart refs
  const revenueComparisonChartRef = useRef<HTMLCanvasElement>(null);
  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const servicesChartRef = useRef<HTMLCanvasElement>(null);
  const productsChartRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const revenueComparisonChartInstance = useRef<Chart | null>(null);
  const revenueChartInstance = useRef<Chart | null>(null);
  const trendChartInstance = useRef<Chart | null>(null);
  const servicesChartInstance = useRef<Chart | null>(null);
  const productsChartInstance = useRef<Chart | null>(null);

  // Real-time update interval
  const updateIntervalRef = useRef<NodeJS.Timeout>();

  // Color palette
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

  const processData = useCallback((
    hotelOrders: HotelOrder[],
    hotelExpenses: HotelExpense[],
    laundryOrders: LaundryOrder[],
    laundryExpenses: LaundryExpense[],
    customers: Customer[]
  ): ProcessedData => {
    // Ensure arrays exist
    hotelOrders = hotelOrders || [];
    hotelExpenses = hotelExpenses || [];
    laundryOrders = laundryOrders || [];
    laundryExpenses = laundryExpenses || [];
    customers = customers || [];

    // Helper function to parse date and check filters
    const isDateInRange = (dateString: string): boolean => {
      try {
        if (!dateString) return false;
        const itemDate = new Date(dateString);
        const filterFrom = fromDate ? new Date(fromDate) : null;
        const filterTo = toDate ? new Date(toDate) : null;

        if (filterFrom && itemDate < filterFrom) return false;
        if (filterTo && itemDate > filterTo) return false;
        if (filterYear && itemDate.getFullYear() !== filterYear) return false;
        if (filterMonth) {
          const [year, month] = filterMonth.split('-').map(Number);
          if (itemDate.getFullYear() !== year || (itemDate.getMonth() + 1) !== month) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    };

    // Filter hotel orders by date range
    const filteredHotelOrders = hotelOrders.filter(order => {
      return isDateInRange(order.created_at);
    });

    // Filter laundry orders by date range
    const filteredLaundryOrders = laundryOrders.filter(order => {
      return isDateInRange(order.created_at);
    });

    // Calculate hotel revenue from order items
    const hotelRevenue = filteredHotelOrders.reduce((sum, order) => {
      try {
        // Sum up all order items' total_price
        const orderTotal = order.order_items.reduce((orderSum, item) => {
          const price = item.total_price || 0;
          return orderSum + price;
        }, 0);
        
        // Also add the order's total_amount if available
        return sum + (order.total_amount || orderTotal);
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate total hotel orders count
    const hotelTotalOrders = filteredHotelOrders.length;

    // Calculate laundry revenue
    const laundryRevenue = filteredLaundryOrders.reduce((sum, order) => {
      try {
        const price = parseFloat(order.total_price) || 0;
        return sum + price;
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate hotel expenses
    const hotelExpensesTotal = hotelExpenses.reduce((sum, expense) => {
      try {
        const amount = parseFloat(expense.amount || '0') || 0;
        // Filter expenses by date
        if (!isDateInRange(expense.date)) return sum;
        return sum + amount;
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate laundry expenses
    const laundryExpensesTotal = laundryExpenses.reduce((sum, expense) => {
      try {
        // Filter expenses by date
        if (!isDateInRange(expense.date)) return sum;
        return sum + (parseFloat(expense.amount) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate total expenses
    const totalBusinessExpenses = hotelExpensesTotal + laundryExpensesTotal;

    // Calculate net profits
    const hotelNetProfit = hotelRevenue - hotelExpensesTotal;
    const laundryNetProfit = laundryRevenue - laundryExpensesTotal;
    const totalNetProfit = hotelNetProfit + laundryNetProfit;

    // Calculate shop-specific stats
    const shopAOrders = filteredLaundryOrders.filter(order => order.shop === 'Shop A');
    const shopBOrders = filteredLaundryOrders.filter(order => order.shop === 'Shop B');

    const shopARevenue = shopAOrders.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const shopBRevenue = shopBOrders.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate payment method amounts
    const cashPayments = filteredLaundryOrders.filter(order => 
      order.payment_type && order.payment_type.toLowerCase() === 'cash'
    );
    const mpesaPayments = filteredLaundryOrders.filter(order => 
      order.payment_type && order.payment_type.toLowerCase() === 'mpesa'
    );
    const cardPayments = filteredLaundryOrders.filter(order => 
      order.payment_type && order.payment_type.toLowerCase() === 'card'
    );
    const bankPayments = filteredLaundryOrders.filter(order => 
      order.payment_type && order.payment_type.toLowerCase() === 'bank'
    );
    const otherPayments = filteredLaundryOrders.filter(order => {
      if (!order.payment_type) return false;
      const paymentType = order.payment_type.toLowerCase();
      return !['cash', 'mpesa', 'card', 'bank', 'none'].includes(paymentType);
    });
    const nonepayment = filteredLaundryOrders.filter(order => 
      order.payment_type && order.payment_type.toLowerCase() === 'none'
    );

    // Calculate payment amounts for each method
    const cashPaymentsAmount = cashPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const mpesaPaymentsAmount = mpesaPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const cardPaymentsAmount = cardPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const bankTransferPaymentsAmount = bankPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const otherPaymentsAmount = otherPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const nonePaymentsAmount = nonepayment.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate payment status
    const pendingPayments = filteredLaundryOrders.filter(order => order.payment_status === 'pending');
    const partialPayments = filteredLaundryOrders.filter(order => order.payment_status === 'partial');
    const completePayments = filteredLaundryOrders.filter(order => order.payment_status === 'complete');

    // Calculate total amounts for each payment status
    const totalPendingAmount = pendingPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const totalPartialAmount = partialPayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    const totalCompleteAmount = completePayments.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.total_price) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate customer spending
    const customerSpending: Record<string, { name: string; count: number; total: number }> = {};
    filteredLaundryOrders.forEach(order => {
      try {
        if (!order.customer?.name) return;
        const customerName = order.customer.name;
        if (!customerSpending[customerName]) {
          customerSpending[customerName] = { name: customerName, count: 0, total: 0 };
        }
        customerSpending[customerName].count++;
        customerSpending[customerName].total += (parseFloat(order.total_price) || 0);
      } catch (e) {
        // Silently handle errors
      }
    });

    const topCustomers = Object.values(customerSpending)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(customer => ({
        customerName: customer.name,
        orderCount: customer.count,
        totalSpent: customer.total
      }));

    // Calculate service frequencies
    const serviceCounts: Record<string, number> = {};
    filteredLaundryOrders.forEach(order => {
      try {
        order.items?.forEach(item => {
          item.servicetype?.forEach(service => {
            if (service) {
              serviceCounts[service] = (serviceCounts[service] || 0) + 1;
            }
          });
        });
      } catch (e) {
        // Silently handle errors
      }
    });

    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Calculate item frequencies
    const itemCounts: Record<string, number> = {};
    filteredLaundryOrders.forEach(order => {
      try {
        order.items?.forEach(item => {
          if (item.itemname) {
            itemCounts[item.itemname] = (itemCounts[item.itemname] || 0) + 1;
          }
        });
      } catch (e) {
        // Silently handle errors
      }
    });

    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Generate monthly revenue data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyHotelRevenue = Array(12).fill(0);
    const monthlyLaundryRevenue = Array(12).fill(0);

    filteredHotelOrders.forEach(order => {
      try {
        const month = new Date(order.created_at).getMonth();
        const orderTotal = order.order_items.reduce((sum, item) => sum + (item.total_price || 0), 0);
        monthlyHotelRevenue[month] += (order.total_amount || orderTotal);
      } catch (e) {
        // Silently handle errors
      }
    });

    filteredLaundryOrders.forEach(order => {
      try {
        const month = new Date(order.created_at).getMonth();
        monthlyLaundryRevenue[month] += (parseFloat(order.total_price) || 0);
      } catch (e) {
        // Silently handle errors
      }
    });

    // Calculate total balance amount
    const totalBalanceAmount = filteredLaundryOrders.reduce((sum, order) => {
      try {
        return sum + (parseFloat(order.balance) || 0);
      } catch (e) {
        return sum;
      }
    }, 0);

    // Calculate shop-specific expenses
    const shopAExpenses = laundryExpenses.filter(e => e.shop === 'Shop A' && isDateInRange(e.date))
      .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
    
    const shopBExpenses = laundryExpenses.filter(e => e.shop === 'Shop B' && isDateInRange(e.date))
      .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

    return {
      // Summary Stats
      totalBusinessRevenue: hotelRevenue + laundryRevenue,
      totalNetProfit,
      totalBusinessExpenses,

      // Hotel Stats
      hotelRevenue,
      hotelTotalOrders,
      hotelInProgressOrders: 0, // This field doesn't exist in the API response
      hotelServedOrders: 0,     // This field doesn't exist in the API response
      hotelNetProfit,
      hotelTotalExpenses: hotelExpensesTotal,

      // Laundry Stats
      laundryRevenue,
      cashPaymentsAmount,
      mpesaPaymentsAmount,
      cardPaymentsAmount,
      bankTransferPaymentsAmount,
      otherPaymentsAmount,
      nonePaymentsAmount,
      totalBalanceAmount,
      pendingPayments: pendingPayments.length,
      totalPendingAmount,
      partialPayments: partialPayments.length,
      totalPartialAmount,
      completePayments: completePayments.length,
      totalCompleteAmount,
      totalExpenses: laundryExpensesTotal,

      // Shop Stats
      shopARevenue,
      shopATotalOrders: shopAOrders.length,
      shopAPendingPayments: shopAOrders.filter(o => o.payment_status === 'pending').length,
      shopAPendingAmount: shopAOrders.filter(o => o.payment_status === 'pending')
        .reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0),
      shopAPartialPayments: shopAOrders.filter(o => o.payment_status === 'partial').length,
      shopAPartialAmount: shopAOrders.filter(o => o.payment_status === 'partial')
        .reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0),
      shopACompletePayments: shopAOrders.filter(o => o.payment_status === 'complete').length,
      shopACompleteAmount: shopAOrders.filter(o => o.payment_status === 'complete')
        .reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0),
      shopANetProfit: shopARevenue - shopAExpenses,
      shopATotalExpenses: shopAExpenses,

      shopBRevenue,
      shopBTotalOrders: shopBOrders.length,
      shopBPendingPayments: shopBOrders.filter(o => o.payment_status === 'pending').length,
      shopBPendingAmount: shopBOrders.filter(o => o.payment_status === 'pending')
        .reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0),
      shopBPartialPayments: shopBOrders.filter(o => o.payment_status === 'partial').length,
      shopBPartialAmount: shopBOrders.filter(o => o.payment_status === 'partial')
        .reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0),
      shopBCompletePayments: shopBOrders.filter(o => o.payment_status === 'complete').length,
      shopBCompleteAmount: shopBOrders.filter(o => o.payment_status === 'complete')
        .reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0),
      shopBNetProfit: shopBRevenue - shopBExpenses,
      shopBTotalExpenses: shopBExpenses,

      // Chart Data
      revenueComparisonLabels: ['Laundry', 'Hotel'],
      revenueComparisonData: [laundryRevenue, hotelRevenue],
      revenueComparisonColors: [COLOR_PALETTE.blue, COLOR_PALETTE.red],

      pieChartLabels: ['Shop A', 'Shop B', 'Hotel'],
      pieChartValues: [shopARevenue, shopBRevenue, hotelRevenue],

      lineChartData: [
        {
          label: 'Laundry Revenue',
          months,
          data: monthlyLaundryRevenue
        },
        {
          label: 'Hotel Revenue',
          months,
          data: monthlyHotelRevenue
        }
      ],

      servicesLabels: topServices.map(([label]) => label),
      servicesCounts: topServices.map(([, count]) => count),

      itemLabels: topItems.map(([label]) => label),
      itemCounts: topItems.map(([, count]) => count),

      commonCustomers: topCustomers,

      currentYear: filterYear,
      selectedMonth: filterMonth ? parseInt(filterMonth.split('-')[1]) : undefined
    };
  }, [filterYear, filterMonth, fromDate, toDate]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel with pagination support
      const [
        hotelOrdersResponse,
        hotelExpensesResponse,
        laundryOrdersResponse,
        laundryExpensesResponse,
        customersResponse
      ] = await Promise.allSettled([
        // Fetch hotel orders (paginated)
        fetchAllPaginatedData('orders/', 'hotel'),
        // Fetch hotel expenses
        fetchAllPaginatedData('Hotelexpense-records/', 'hotel'),
        // Fetch laundry orders (paginated)
        fetchAllPaginatedData('orders/', 'laundry'),
        // Fetch laundry expenses
        fetchAllPaginatedData('expense-records/', 'laundry'),
        // Fetch customers
        fetchAllPaginatedData('customers/', 'laundry')
      ]);

      // Extract data from responses with error handling
      const hotelOrders = hotelOrdersResponse.status === 'fulfilled' 
        ? hotelOrdersResponse.value as HotelOrder[] 
        : [];

      const hotelExpenses = hotelExpensesResponse.status === 'fulfilled' 
        ? hotelExpensesResponse.value as HotelExpense[] 
        : [];

      const laundryOrders = laundryOrdersResponse.status === 'fulfilled' 
        ? laundryOrdersResponse.value as LaundryOrder[] 
        : [];

      const laundryExpenses = laundryExpensesResponse.status === 'fulfilled' 
        ? laundryExpensesResponse.value as LaundryExpense[] 
        : [];

      const customers = customersResponse.status === 'fulfilled' 
        ? customersResponse.value as Customer[] 
        : [];

      // Process the data even if some requests failed
      const processedData = processData(
        hotelOrders,
        hotelExpenses,
        laundryOrders,
        laundryExpenses,
        customers
      );

      setData(processedData);

    } catch (err: any) {
      let errorMessage = `Failed to fetch dashboard data: ${err.message}`;
      if (err.response) {
        errorMessage += ` (Status: ${err.response.status})`;
      }
      setError(errorMessage);

      // Set empty data structure to prevent further errors
      setData({
        // Summary Stats
        totalBusinessRevenue: 0,
        totalNetProfit: 0,
        totalBusinessExpenses: 0,

        // Hotel Stats
        hotelRevenue: 0,
        hotelTotalOrders: 0,
        hotelInProgressOrders: 0,
        hotelServedOrders: 0,
        hotelNetProfit: 0,
        hotelTotalExpenses: 0,

        // Laundry Stats
        laundryRevenue: 0,
        cashPaymentsAmount: 0,
        mpesaPaymentsAmount: 0,
        cardPaymentsAmount: 0,
        bankTransferPaymentsAmount: 0,
        otherPaymentsAmount: 0,
        nonePaymentsAmount: 0,
        totalBalanceAmount: 0,
        pendingPayments: 0,
        totalPendingAmount: 0,
        partialPayments: 0,
        totalPartialAmount: 0,
        completePayments: 0,
        totalCompleteAmount: 0,
        totalExpenses: 0,

        // Shop Stats
        shopARevenue: 0,
        shopATotalOrders: 0,
        shopAPendingPayments: 0,
        shopAPendingAmount: 0,
        shopAPartialPayments: 0,
        shopAPartialAmount: 0,
        shopACompletePayments: 0,
        shopACompleteAmount: 0,
        shopANetProfit: 0,
        shopATotalExpenses: 0,

        shopBRevenue: 0,
        shopBTotalOrders: 0,
        shopBPendingPayments: 0,
        shopBPendingAmount: 0,
        shopBPartialPayments: 0,
        shopBPartialAmount: 0,
        shopBCompletePayments: 0,
        shopBCompleteAmount: 0,
        shopBNetProfit: 0,
        shopBTotalExpenses: 0,

        // Chart Data
        revenueComparisonLabels: [],
        revenueComparisonData: [],
        revenueComparisonColors: [],

        pieChartLabels: [],
        pieChartValues: [],

        lineChartData: [],

        servicesLabels: [],
        servicesCounts: [],

        itemLabels: [],
        itemCounts: [],

        commonCustomers: [],

        currentYear: filterYear,
        selectedMonth: filterMonth ? parseInt(filterMonth.split('-')[1]) : undefined
      });
    } finally {
      setLoading(false);
    }
  }, [processData, filterYear, filterMonth]);

  // Initialize real-time updates
  useEffect(() => {
    fetchDashboardData();

    // Set up real-time updates every 30 seconds
    updateIntervalRef.current = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    // Cleanup interval on unmount
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [fetchDashboardData]);

  // Initialize charts when data changes
  useEffect(() => {
    if (!data) return;

    // Destroy existing charts
    [revenueComparisonChartInstance, revenueChartInstance, trendChartInstance, servicesChartInstance, productsChartInstance].forEach(chartRef => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    });

    // Get chart options from Django template
    const getChartOptions = () => {
      const textColor = '#1E293B';
      const tooltipBg = '#FFFFFF';
      const tooltipBorder = '#E2E8F0';
      const tooltipText = '#1E293B';

      return {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: textColor,
              font: {
                size: 11,
                weight: 500 as const
              }
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            bodyFont: {
              size: 14,
              weight: 600 as const
            },
            titleFont: {
              size: 12,
              weight: 500 as const
            },
            callbacks: {
              title: (context: TooltipItem<keyof ChartTypeRegistry>[]) => {
                return context[0].label || '';
              },
              label: function (context: TooltipItem<keyof ChartTypeRegistry>) {
                if ('parsed' in context && 'y' in context.parsed) {
                  return 'Ksh ' + context.parsed.y.toLocaleString('en-US');
                } else if ('parsed' in context && 'x' in context.parsed) {
                  return 'Ksh ' + context.parsed.x.toLocaleString('en-US');
                } else if ('parsed' in context) {
                  return 'Ksh ' + context.parsed.toLocaleString('en-US');
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            display: false,
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 } },
            border: { display: false }
          },
          y: {
            display: false,
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 } },
            border: { display: false }
          }
        }
      } as any;
    };

    // Initialize Revenue Comparison Chart (Doughnut)
    if (revenueComparisonChartRef.current && data.revenueComparisonData.length > 0) {
      const ctx = revenueComparisonChartRef.current.getContext('2d');
      if (ctx) {
        revenueComparisonChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: data.revenueComparisonLabels,
            datasets: [{
              data: data.revenueComparisonData,
              backgroundColor: data.revenueComparisonColors.length > 0 ? data.revenueComparisonColors : [
                COLOR_PALETTE.blue,
                COLOR_PALETTE.red
              ],
              borderWidth: 0,
              hoverOffset: 4,
            } as ChartDataset<'doughnut', number[]>]
          },
          options: {
            ...getChartOptions(),
            plugins: {
              ...getChartOptions().plugins,
              legend: {
                position: 'bottom',
                labels: {
                  padding: 10,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  boxHeight: 8,
                  font: {
                    size: 11,
                    weight: 500 as const
                  }
                }
              },
              tooltip: {
                ...getChartOptions().plugins.tooltip,
                callbacks: {
                  label: function (context: TooltipItem<'doughnut'>) {
                    return 'Ksh ' + context.parsed.toLocaleString('en-US');
                  }
                }
              }
            },
            cutout: '70%'
          }
        });
      }
    }

    // Initialize Revenue Distribution Chart (Doughnut)
    if (revenueChartRef.current && data.pieChartValues.length > 0) {
      const ctx = revenueChartRef.current.getContext('2d');
      if (ctx) {
        revenueChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: data.pieChartLabels,
            datasets: [{
              data: data.pieChartValues,
              backgroundColor: [
                COLOR_PALETTE.navyBlue,
                COLOR_PALETTE.orangeYellow,
                COLOR_PALETTE.lightOrange,
                COLOR_PALETTE.pink,
                COLOR_PALETTE.lightPink,
                COLOR_PALETTE.success,
                COLOR_PALETTE.info
              ],
              borderWidth: 0,
              hoverOffset: 4,
            } as ChartDataset<'doughnut', number[]>]
          },
          options: {
            ...getChartOptions(),
            plugins: {
              ...getChartOptions().plugins,
              legend: {
                position: 'bottom',
                labels: {
                  padding: 10,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  boxHeight: 8,
                  font: {
                    size: 11,
                    weight: 500 as const
                  }
                }
              }
            },
            cutout: '70%'
          }
        });
      }
    }

    // Initialize Trend Chart
    if (trendChartRef.current && data.lineChartData.length > 0 && !data.selectedMonth) {
      const ctx = trendChartRef.current.getContext('2d');
      if (ctx) {
        const lineColors = [
          COLOR_PALETTE.pink,
          COLOR_PALETTE.orangeYellow,
          COLOR_PALETTE.navyBlue,
          COLOR_PALETTE.success,
          COLOR_PALETTE.info
        ];

        const datasets = data.lineChartData.map((series, index) => ({
          label: series.label || `Series ${index + 1}`,
          data: series.data || [],
          borderColor: lineColors[index % lineColors.length],
          backgroundColor: `${lineColors[index % lineColors.length]}20`,
          borderWidth: 1,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: lineColors[index % lineColors.length],
          fill: true,
        }));

        trendChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.lineChartData[0].months,
            datasets: datasets
          },
          options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  padding: 10,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  boxHeight: 8,
                  font: {
                    size: 11,
                    weight: 'bold' as const
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: function (context: TooltipItem<'line'>) {
                    return `${context.dataset.label}: Ksh ${context.parsed.y.toLocaleString('en-US')}`;
                  }
                }
              }
            },
            scales: {
              x: {
                display: true,
                grid: { display: false },
                ticks: {
                  color: '#1E293B',
                  maxRotation: 0,
                  padding: 10
                }
              },
              y: {
                display: false,
                grid: { display: false }
              }
            },
            interaction: {
              mode: 'index',
              intersect: false
            }
          }
        });
      }
    }

    // Sort data descending for bar charts
    const sortDataDescending = (labels: string[], data: number[]) => {
      const combined = labels.map((label, index) => ({
        label,
        value: data[index] || 0
      }));

      combined.sort((a, b) => b.value - a.value);

      const sortedLabels = combined.map(item => item.label);
      const sortedData = combined.map(item => item.value);

      return { sortedLabels, sortedData };
    };

    // Initialize Services Chart (Horizontal Bar)
    if (servicesChartRef.current && data.servicesLabels.length > 0) {
      const { sortedLabels, sortedData } = sortDataDescending(data.servicesLabels, data.servicesCounts);
      const ctx = servicesChartRef.current.getContext('2d');
      if (ctx) {
        const barColors = [
          COLOR_PALETTE.navyBlue,
          COLOR_PALETTE.orangeYellow,
          COLOR_PALETTE.pink,
          COLOR_PALETTE.lightPink,
          COLOR_PALETTE.success,
          COLOR_PALETTE.info,
          COLOR_PALETTE.warning
        ];

        servicesChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sortedLabels,
            datasets: [{
              data: sortedData,
              backgroundColor: sortedLabels.map((_, index) => barColors[index % barColors.length]),
              borderRadius: 8,
              borderWidth: 0,
              barThickness: 10,
              categoryPercentage: 0.8,
              barPercentage: 0.9
            }]
          },
          options: {
            indexAxis: 'y' as const,
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: false
              }
            },
            scales: {
              y: {
                display: true,
                grid: { display: false },
                ticks: {
                  color: '#1E293B',
                  font: {
                    size: 11,
                    weight: 500 as const
                  },
                  padding: 8
                }
              },
              x: {
                display: true,
                grid: { display: false },
                ticks: {
                  color: '#1E293B',
                  font: { size: 10 }
                }
              }
            }
          }
        });
      }
    }

    // Initialize Products Chart (Horizontal Bar)
    if (productsChartRef.current && data.itemLabels.length > 0) {
      const { sortedLabels, sortedData } = sortDataDescending(data.itemLabels, data.itemCounts);
      const ctx = productsChartRef.current.getContext('2d');
      if (ctx) {
        const barColors = [
          COLOR_PALETTE.navyBlue,
          COLOR_PALETTE.orangeYellow,
          COLOR_PALETTE.pink,
          COLOR_PALETTE.lightPink,
          COLOR_PALETTE.success,
          COLOR_PALETTE.info,
          COLOR_PALETTE.warning
        ];

        productsChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sortedLabels,
            datasets: [{
              data: sortedData,
              backgroundColor: sortedLabels.map((_, index) => barColors[index % barColors.length]),
              borderRadius: 8,
              borderWidth: 0,
              barThickness: 10,
              categoryPercentage: 0.8,
              barPercentage: 0.9
            }]
          },
          options: {
            indexAxis: 'y' as const,
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: false
              }
            },
            scales: {
              y: {
                display: true,
                grid: { display: false },
                ticks: {
                  color: '#1E293B',
                  font: {
                    size: 11,
                    weight: 500 as const
                  },
                  padding: 8
                }
              },
              x: {
                display: true,
                grid: { display: false },
                ticks: {
                  color: '#1E293B',
                  font: { size: 10 }
                }
              }
            }
          }
        });
      }
    }

    // Cleanup function
    return () => {
      [revenueComparisonChartInstance, revenueChartInstance, trendChartInstance, servicesChartInstance, productsChartInstance].forEach(chartRef => {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      });
    };
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboardData();
  };

  const handleReset = () => {
    setFilterYear(new Date().getFullYear());
    setFilterMonth("");
    setFromDate("");
    setToDate("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatCurrencyFull = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4 text-lg">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Business Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Monitor your business performance</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
          <Calendar className="h-5 w-5 text-blue-500" />
          <span className="font-semibold text-gray-700">{data?.currentYear || new Date().getFullYear()}</span>
          {data?.selectedMonth && (
            <span className="font-semibold text-gray-500">- Month {data.selectedMonth}</span>
          )}
        </div>
      </div>

      {/* Date Range Filter Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Data</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Year Input */}
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <input
              type="number"
              id="year"
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              min="2020"
              max="2100"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Month Selector */}
          <div>
            <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <input
              type="month"
              id="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Date Range */}
          <div>
            <label htmlFor="from_date" className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              id="from_date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={today}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div>
            <label htmlFor="to_date" className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              id="to_date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              max={today}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Filter className="h-5 w-5" /> Apply
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-5 w-5" /> Reset
            </button>
          </div>
        </form>
      </div>

      {/* Overall Business Stats */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <h2 className="text-xl font-bold text-gray-900">Business Overview</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-5">
          {/* Total Business Revenue */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">Total</span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Total Revenue</h3>
            <div className="text-xl font-bold text-gray-900 mb-1">Ksh {formatCurrencyFull(data?.totalBusinessRevenue || 0)}</div>
            <div className="flex items-center text-xs text-gray-500">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span>Combined earnings</span>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <ChartLine className="h-5 w-5 text-purple-600" />
              </div>
              <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded-full">Profit</span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Net Profit</h3>
            <div className="text-xl font-bold text-gray-900 mb-1">Ksh {formatCurrencyFull(data?.totalNetProfit || 0)}</div>
            <div className="flex items-center text-xs text-gray-500">
              <DollarSign className="h-3 w-3 text-purple-500 mr-1" />
              <span>After expenses</span>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-red-600" />
              </div>
              <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">Expenses</span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Total Expenses</h3>
            <div className="text-xl font-bold text-gray-900 mb-1">Ksh {formatCurrencyFull(data?.totalBusinessExpenses || 0)}</div>
            <div className="flex items-center text-xs text-gray-500">
              <ChartLine className="h-3 w-3 text-red-500 mr-1" />
              <span>Combined expenses</span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Comparison Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Comparison Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              Revenue Comparison
            </h2>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">{data?.currentYear || new Date().getFullYear()}</span>
          </div>
          <div className="h-64">
            <canvas ref={revenueComparisonChartRef} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-sm font-semibold text-blue-700">Laundry Business</div>
              <div className="text-lg font-bold text-blue-900">Ksh {formatCurrencyFull(data?.laundryRevenue || 0)}</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
              <div className="text-sm font-semibold text-red-700">Hotel Business</div>
              <div className="text-lg font-bold text-red-900">Ksh {formatCurrencyFull(data?.hotelRevenue || 0)}</div>
            </div>
          </div>
        </div>

        {/* Hotel Business Stats */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-gradient-to-b from-red-500 to-orange-600 rounded-full"></div>
              <h2 className="text-lg font-bold text-gray-900">Hotel Business</h2>
            </div>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">Active</span>
          </div>

          <div className="space-y-4">
            {/* Hotel Revenue */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border border-red-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-red-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Revenue</span>
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1">Ksh {formatCurrencyFull(data?.hotelRevenue || 0)}</div>
              <div className="text-xs text-gray-500">{data?.hotelTotalOrders || 0} orders</div>
            </div>

            {/* Hotel Orders */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-4 border border-orange-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-orange-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Orders</span>
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1">{data?.hotelTotalOrders || 0}</div>
            </div>

            {/* Hotel Profit */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <ChartLine className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Profit & Expenses</span>
              </div>
              <div className="flex flex-col gap-2">
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

      {/* Laundry Business Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
          <h2 className="text-xl font-bold text-gray-900">Laundry Business</h2>
        </div>

        {/* Laundry Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* Laundry Revenue & Payment Methods */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Revenue</h3>
                <div className="text-xl font-bold text-gray-900">Ksh {formatCurrencyFull(data?.laundryRevenue || 0)}</div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Methods</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-700">Cash</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">Ksh {formatCurrency(data?.cashPaymentsAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-700">M-Pesa</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">Ksh {formatCurrency(data?.mpesaPaymentsAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-gray-700">Card</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">Ksh {formatCurrency(data?.cardPaymentsAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm text-gray-700">Bank</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">Ksh {formatCurrency(data?.bankTransferPaymentsAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700">Other</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">Ksh {formatCurrency(data?.otherPaymentsAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700">None</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">Ksh {formatCurrency(data?.nonePaymentsAmount || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Payments & Balance</h3>
                <div className="text-xl font-bold text-gray-900">Ksh {formatCurrency(data?.totalBalanceAmount || 0)}</div>
              </div>
            </div>
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium mr-2">
                    {data?.pendingPayments || 0}
                  </span>
                  <span className="text-sm text-gray-700">Pending Payment</span>
                </div>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  {formatCurrency(data?.totalPendingAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium mr-2">
                    {data?.partialPayments || 0}
                  </span>
                  <span className="text-sm text-gray-700">Partial Payment</span>
                </div>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {formatCurrency(data?.totalPartialAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium mr-2">
                    {data?.completePayments || 0}
                  </span>
                  <span className="text-sm text-gray-700">Complete Payment</span>
                </div>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  {formatCurrency(data?.totalCompleteAmount || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Laundry Expenses */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Laundry Expenses</h3>
                  <div className="text-xl font-bold text-gray-900">Ksh {formatCurrencyFull(data?.totalExpenses || 0)}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-500 mt-4">
              <ChartLine className="h-3 w-3 text-red-500 mr-1" />
              <span>Operational costs</span>
            </div>
          </div>
        </div>

        {/* Shop Performance Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Shop A Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-gradient-to-b from-pink-500 to-purple-600 rounded-full"></div>
                <h2 className="text-lg font-bold text-gray-900">Shop A Performance</h2>
              </div>
              <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm font-semibold">Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shop A Revenue */}
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg p-4 border border-pink-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-pink-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Revenue</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">Ksh {formatCurrencyFull(data?.shopARevenue || 0)}</div>
                <div className="text-xs text-gray-500">Shop A earnings</div>
              </div>

              {/* Shop A Orders */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Orders</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">{data?.shopATotalOrders || 0}</div>
              </div>

              {/* Shop A Payments */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Payments</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">{data?.shopATotalOrders || 0}</div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex flex-row justify-between">
                    <span className="text-yellow-600">{data?.shopAPendingPayments || 0} pending</span>
                    <span className="text-yellow-600">Ksh {formatCurrency(data?.shopAPendingAmount || 0)}</span>
                  </div>
                  <div className="flex flex-row justify-between">
                    <span className="text-blue-600">{data?.shopAPartialPayments || 0} partial</span>
                    <span className="text-blue-600">Ksh {formatCurrency(data?.shopAPartialAmount || 0)}</span>
                  </div>
                  <div className="flex flex-row justify-between">
                    <span className="text-green-600">{data?.shopACompletePayments || 0} complete</span>
                    <span className="text-green-600">Ksh {formatCurrency(data?.shopACompleteAmount || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Shop A Profit */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <ChartLine className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Profit & Expenses</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <div className="text-md font-bold text-green-600">Ksh {formatCurrencyFull(data?.shopANetProfit || 0)}</div>
                    <div className="text-xs text-gray-500">Profit</div>
                  </div>
                  <div>
                    <div className="text-md font-bold text-blue-600">Ksh {formatCurrencyFull(data?.shopATotalExpenses || 0)}</div>
                    <div className="text-xs text-gray-500">Expenses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shop B Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-gradient-to-b from-yellow-500 to-orange-600 rounded-full"></div>
                <h2 className="text-lg font-bold text-gray-900">Shop B Performance</h2>
              </div>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shop B Revenue */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-yellow-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Revenue</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">Ksh {formatCurrencyFull(data?.shopBRevenue || 0)}</div>
                <div className="text-xs text-gray-500">Shop B earnings</div>
              </div>

              {/* Shop B Orders */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-orange-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Orders</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">{data?.shopBTotalOrders || 0}</div>
              </div>

              {/* Shop B Payments */}
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-4 border border-red-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Payments</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-1">{data?.shopBTotalOrders || 0}</div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex flex-row justify-between">
                    <span className="text-yellow-600">{data?.shopBPendingPayments || 0} pending</span>
                    <span className="text-yellow-600">Ksh{formatCurrency(data?.shopBPendingAmount || 0)}</span>
                  </div>
                  <div className="flex flex-row justify-between">
                    <span className="text-blue-600">{data?.shopBPartialPayments || 0} partial</span>
                    <span className="text-blue-600">Ksh{formatCurrency(data?.shopBPartialAmount || 0)}</span>
                  </div>
                  <div className="flex flex-row justify-between">
                    <span className="text-green-600">{data?.shopBCompletePayments || 0} complete</span>
                    <span className="text-green-600">Ksh{formatCurrency(data?.shopBCompleteAmount || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Shop B Profit */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ChartLine className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Profit & Expenses</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <div className="text-md font-bold text-green-600">Ksh {formatCurrencyFull(data?.shopBNetProfit || 0)}</div>
                    <div className="text-xs text-gray-500">Profit</div>
                  </div>
                  <div>
                    <div className="text-md font-bold text-blue-600">Ksh {formatCurrencyFull(data?.shopBTotalExpenses || 0)}</div>
                    <div className="text-xs text-gray-500">Expenses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              Revenue Distribution
            </h4>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">Total</span>
          </div>
          <div className="h-64">
            <canvas ref={revenueChartRef} />
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              Revenue Trend
            </h2>
            <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm font-semibold">
              {data?.currentYear || new Date().getFullYear()}
            </span>
          </div>
          <div className="h-64">
            {!data?.selectedMonth ? (
              <canvas ref={trendChartRef} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Switch to yearly view</h3>
                <p className="text-gray-500">Monthly trends are available in the annual overview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Services */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Bath className="h-5 w-5 text-green-500" />
              Top Services
            </h2>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
              {data?.currentYear || new Date().getFullYear()}
            </span>
          </div>
          <div className="h-72">
            {data?.servicesLabels && data.servicesLabels.length > 0 ? (
              <canvas ref={servicesChartRef} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bath className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No service data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Popular Products */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Box className="h-5 w-5 text-yellow-500" />
              Common Items
            </h2>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
              {data?.currentYear || new Date().getFullYear()}
            </span>
          </div>
          <div className="h-72">
            {data?.itemLabels && data.itemLabels.length > 0 ? (
              <canvas ref={productsChartRef} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Box className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No product data available</p>
              </div>
            )}
          </div>
        </div>

        {/* VIP Customers */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Top Customers
            </h2>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
              {data?.currentYear || new Date().getFullYear()}
            </span>
          </div>
          <div className="h-72 overflow-y-auto pr-2">
            {data?.commonCustomers && data.commonCustomers.length > 0 ? (
              data.commonCustomers.map((customer, index) => (
                <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg mb-3 border border-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm mr-4">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{customer.customerName}</div>
                    <div className="text-xs text-gray-500">{customer.orderCount} orders</div>
                  </div>
                  <div className="font-bold text-pink-600 text-lg">
                    ksh{formatCurrency(customer.totalSpent)}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No customer data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 rounded-lg border border-red-300 p-4 shadow-lg">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900 ml-4">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}