import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/services/url";
import {
  Home, Search, Download, ChevronDown,
  PlusCircle, CheckCircle, Truck, X, Edit, Trash2,
  Filter, Clock, Check, Truck as TruckIcon,
  MoreVertical, Inbox, ChevronLeft, ChevronRight,
  Wallet, PlusCircle as PlusCircleIcon, CreditCard, XCircle,
  FileText, FileSpreadsheet, Printer, Loader2, EllipsisVertical
} from 'lucide-react';
import { Order, OrderItem } from "@/services/types";

export const ORDERS_URL = `${API_BASE_URL}/Laundry/orders/`;

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem("accessToken");
};

// Status Colors
const STATUS_COLORS: { [key: string]: { bg: string; text: string; icon: any } } = {
  'Completed': { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  'Delivered_picked': { bg: 'bg-purple-100', text: 'text-purple-800', icon: TruckIcon },
};

const PAYMENT_STATUS_COLORS: { [key: string]: { bg: string; text: string; icon: any } } = {
  'completed': { bg: 'bg-green-100', text: 'text-green-800', icon: Check },
  'partial': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  'pending': { bg: 'bg-red-100', text: 'text-red-800', icon: Clock },
};

// Pagination interface
interface PaginationInfo {
  count: number;
  next: string | null;
  previous: string | null;
  current_page: number;
  total_pages: number;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');

  // Selection State
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Dropdown state for each row
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Payment Modal State
  const [paymentType, setPaymentType] = useState('cash');

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    order_status: '',
    payment_status: '',
    amount_paid: '',
    total_price: '',
    items: [] as OrderItem[],
  });

  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Pagination State
  const [pagination, setPagination] = useState<PaginationInfo>({
    count: 0,
    next: null,
    previous: null,
    current_page: 1,
    total_pages: 1
  });
  const [pageSize, setPageSize] = useState(20); // Default 20 rows per page

  // Stats state - separate from orders to avoid confusion
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    completed_orders: 0, // Only 'Completed', not 'Delivered_picked'
  });

  // Fetch data with filters and pagination
  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const params = new URLSearchParams();
      params.append('page', page.toString());

      // Use page_size from backend config (or default)
      const pageSizeParam = pageSize || 10; // Default to 10 if not set
      params.append('page_size', pageSizeParam.toString());

      if (searchQuery) params.append('search', searchQuery);
      if (paymentFilter) params.append('payment_status', paymentFilter);
      if (shopFilter) params.append('shop', shopFilter);

      console.log('Fetching orders with params:', params.toString());

      const response = await fetch(`${ORDERS_URL}?${params}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Unauthorized access - redirecting to login");
          window.location.href = "/login";
          return;
        }
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response:', data); // Add this for debugging

      // For Django REST Framework PageNumberPagination, it should return:
      // {
      //   "count": 100,
      //   "next": "http://api.example.org/accounts/?page=2",
      //   "previous": null,
      //   "results": [...]
      // }

      if (data.results) {
        setOrders(data.results);

        // Update pagination from response
        setPagination({
          count: data.count || 0,
          next: data.next,
          previous: data.previous,
          current_page: page, // Use the page we requested
          total_pages: Math.ceil((data.count || 0) / pageSizeParam)
        });

        // Calculate stats from the current page only (for display purposes)
        const currentPageStats = {
          total_orders: data.count || 0, // Use total count from backend
          pending_orders: data.results.filter((order: Order) => order.order_status === 'pending').length,
          completed_orders: data.results.filter((order: Order) =>
            order.order_status === 'Completed'
          ).length,
        };
        setStats(currentPageStats);
      } else {
        // If no pagination, assume it's an array
        setOrders(data || []);
        setPagination({
          count: data.length || 0,
          next: null,
          previous: null,
          current_page: 1,
          total_pages: 1
        });

        const currentPageStats = {
          total_orders: data.length || 0,
          pending_orders: data.filter((order: Order) => order.order_status === 'pending').length,
          completed_orders: data.filter((order: Order) =>
            order.order_status === 'Completed'
          ).length,
        };
        setStats(currentPageStats);
      }

    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Could not load orders. Please check the API status.");
      setOrders([]);
      setStats({
        total_orders: 0,
        pending_orders: 0,
        completed_orders: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchQuery, paymentFilter, shopFilter]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close export dropdown
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }

      // Close row dropdowns
      const clickedOutsideAllDropdowns = Object.values(dropdownRefs.current).every(
        ref => ref && !ref.contains(event.target as Node)
      );
      if (clickedOutsideAllDropdowns) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search with debounce
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Reset to page 1 when searching
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchOrders(1);
    }, 500);
  };

  // Handle export
  const handleExport = (format: string) => {
    const token = getAuthToken();
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const params = new URLSearchParams();
    params.append('export', format);
    if (searchQuery) params.append('search', searchQuery);
    if (paymentFilter) params.append('payment_status', paymentFilter);
    if (shopFilter) params.append('shop', shopFilter);

    const url = `${ORDERS_URL}?${params}`;
    const exportWindow = window.open('', '_blank');

    if (exportWindow) {
      exportWindow.location.href = url;
    } else {
      // Fallback: download using fetch
      fetch(url, {
        headers,
      })
        .then(response => response.blob())
        .then(blob => {
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `orders_export.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(a);
        })
        .catch(error => {
          console.error('Export error:', error);
          alert('Failed to export. Please try again.');
        });
    }

    setShowExportDropdown(false);
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.total_pages) {
      fetchOrders(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    fetchOrders(1); // Reset to page 1 when changing page size
  };

  // Selection handlers - use current page orders
  const toggleOrderSelection = (orderId: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = orders.map(order => order.id); // Use current page orders only
      setSelectedOrders(new Set(allIds));
      setShowBulkActions(true);
    } else {
      setSelectedOrders(new Set());
      setShowBulkActions(false);
    }
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
    setShowBulkActions(false);
  };

  // Update order status with auth token
  const updateOrderStatus = async (orderId: number, status: Order['order_status']) => {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const order = orders.find(o => o.id === orderId);
      if (!order) return false;

      const response = await fetch(`${ORDERS_URL}${orderId}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          order_status: status,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Unauthorized - redirecting to login");
          window.location.href = "/login";
          return false;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update order status');
      }

      const data = await response.json();
      if (data) {
        // Update local state immediately
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId ? { ...order, order_status: status } : order
          )
        );
        return true;
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      throw err;
    }
    return false;
  };

  // Bulk actions with auth token
  const handleBulkAction = async (status: 'Completed' | 'Delivered_picked') => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order');
      return;
    }

    if (!confirm(`Are you sure you want to mark ${selectedOrders.size} order(s) as ${status.replace('_', ' ')}?`)) {
      return;
    }

    try {
      const promises = Array.from(selectedOrders).map(orderId =>
        updateOrderStatus(orderId, status)
      );

      await Promise.all(promises);
      alert(`Successfully updated ${selectedOrders.size} order(s)`);
      clearSelection();
      fetchOrders(pagination.current_page); // Refresh current page
    } catch (err) {
      console.error('Error in bulk update:', err);
      alert('Failed to update orders');
    }
  };

  // Update single order status with auth token
  const handleUpdateStatus = async (orderId: number, status: Order['order_status']) => {
    if (!confirm(`Are you sure you want to mark this order as ${status.replace('_', ' ')}?`)) {
      return;
    }

    try {
      await updateOrderStatus(orderId, status);
      alert('Order status updated successfully');
      fetchOrders(pagination.current_page); // Refresh current page
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update order status');
    }
  };

  // Delete order with auth token
  const deleteOrder = async (orderId: number, orderCode: string) => {
    if (!confirm(`Are you sure you want to delete order ${orderCode}? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${ORDERS_URL}${orderId}/`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Unauthorized - redirecting to login");
          window.location.href = "/login";
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete order');
      }

      // Update local state immediately
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      alert(`Order ${orderCode} deleted successfully`);

      // Clear selection if this order was selected
      if (selectedOrders.has(orderId)) {
        const newSelected = new Set(selectedOrders);
        newSelected.delete(orderId);
        setSelectedOrders(newSelected);
      }

      // Refresh data
      fetchOrders(pagination.current_page);
    } catch (err) {
      console.error('Error deleting order:', err);
      alert('Failed to delete order');
    }
  };

  // Edit modal functions with auth token
  const openEditModal = async (order: Order) => {
    setCurrentOrder(order);
    setEditFormData({
      name: order.customer.name,
      phone: order.customer.phone,
      order_status: order.order_status,
      payment_status: order.payment_status,
      amount_paid: order.amount_paid,
      total_price: order.total_price,
      items: order.items.map(item => ({ ...item })),
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (field: string, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...editFormData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditFormData(prev => ({ ...prev, items: newItems }));
  };

  const submitEditForm = async () => {
    if (!currentOrder) return;

    try {
      const token = getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${ORDERS_URL}${currentOrder.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          customer: {
            name: editFormData.name,
            phone: editFormData.phone,
          },
          order_status: editFormData.order_status,
          payment_status: editFormData.payment_status,
          amount_paid: parseFloat(editFormData.amount_paid),
          total_price: parseFloat(editFormData.total_price),
          items: editFormData.items,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Unauthorized - redirecting to login");
          window.location.href = "/login";
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update order');
      }

      const data = await response.json();
      if (data) {
        // Update local state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === currentOrder.id ? { ...order, ...data } : order
          )
        );
        alert('Order updated successfully');
        setShowEditModal(false);
        fetchOrders(pagination.current_page); // Refresh current page
      }
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order');
    }
  };

  // Receipt modal functions
  const openReceiptModal = async (order: Order) => {
    setCurrentOrder(order);
    setShowReceiptModal(true);
  };

  const printReceipt = () => {
    const receiptContent = document.getElementById('receiptContent');
    if (receiptContent) {
      const originalContents = document.body.innerHTML;
      const receiptHtml = receiptContent.innerHTML;

      document.body.innerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${currentOrder?.uniquecode}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .receipt { max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .section { margin-bottom: 15px; }
            .total { font-weight: bold; margin-top: 10px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">${receiptHtml}</div>
        </body>
        </html>
      `;

      window.print();
      document.body.innerHTML = originalContents;
      setShowReceiptModal(false);
    }
  };

  // Payment modal functions with auth token
  const openPaymentModal = async (order: Order) => {
    setCurrentOrder(order);
    setPaymentType(order.payment_type || 'cash');
    setShowPaymentModal(true);
  };

  const completePayment = async () => {
    if (!currentOrder) return;

    if (!paymentType) {
      alert('Please select a payment type');
      return;
    }

    if (!confirm(`Are you sure you want to mark payment as complete for order ${currentOrder.uniquecode}?`)) {
      return;
    }

    try {
      const token = getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${ORDERS_URL}${currentOrder.id}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          payment_status: 'completed',
          payment_type: paymentType,
          amount_paid: currentOrder.total_price,
          balance: '0.00',
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Unauthorized - redirecting to login");
          window.location.href = "/login";
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete payment');
      }

      const data = await response.json();
      if (data) {
        // Update local state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === currentOrder.id
              ? {
                ...order,
                payment_status: 'completed',
                payment_type: paymentType,
                amount_paid: currentOrder.total_price,
                balance: '0.00',
              }
              : order
          )
        );
        alert('Payment marked as complete successfully');
        setShowPaymentModal(false);
        fetchOrders(pagination.current_page); // Refresh current page
      }
    } catch (err) {
      console.error('Error completing payment:', err);
      alert('Failed to complete payment');
    }
  };

  // Format servicetype array to string
  const formatServiceType = (servicetype: string[]) => {
    return servicetype.join(', ');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `KSh ${numAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Toggle dropdown for a specific row
  const toggleDropdown = (orderId: number) => {
    setOpenDropdownId(openDropdownId === orderId ? null : orderId);
  };

  // Render pagination buttons
  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisibleButtons = 5;

    if (pagination.total_pages <= 1) return null;

    // Calculate start and end pages
    let startPage = Math.max(1, pagination.current_page - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(pagination.total_pages, startPage + maxVisibleButtons - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisibleButtons) {
      startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    // Always show first page button if not visible
    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          onClick={() => goToPage(1)}
          className={`px-3 py-1 text-sm font-medium rounded-md ${pagination.current_page === 1 ? 'bg-blue-600 text-white' : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300'}`}
        >
          1
        </button>
      );

      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis-start" className="px-2 py-1 text-gray-500">
            ...
          </span>
        );
      }
    }

    // Add page number buttons
    for (let page = startPage; page <= endPage; page++) {
      buttons.push(
        <button
          key={page}
          onClick={() => goToPage(page)}
          className={`px-3 py-1 text-sm font-medium rounded-md ${pagination.current_page === page ? 'bg-blue-600 text-white' : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300'}`}
        >
          {page}
        </button>
      );
    }

    // Always show last page button if not visible
    if (endPage < pagination.total_pages) {
      if (endPage < pagination.total_pages - 1) {
        buttons.push(
          <span key="ellipsis-end" className="px-2 py-1 text-gray-500">
            ...
          </span>
        );
      }

      buttons.push(
        <button
          key={pagination.total_pages}
          onClick={() => goToPage(pagination.total_pages)}
          className={`px-3 py-1 text-sm font-medium rounded-md ${pagination.current_page === pagination.total_pages ? 'bg-blue-600 text-white' : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300'}`}
        >
          {pagination.total_pages}
        </button>
      );
    }

    return buttons;
  };

  // Display orders count
  const displayOrdersCount = orders.length;
  const isCheckAllChecked = orders.length > 0 && selectedOrders.size === orders.length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex-shrink-0">
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:text-blue-600 hover:shadow-md transition-all duration-200"
            >
              <Home className="w-4 h-4 mr-2 text-blue-500" />
              <span className="text-sm font-medium">Dashboard Home</span>
            </button>
          </div>

          <div className="flex-grow max-w-3xl relative">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-200 placeholder-gray-400 text-sm"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 mt-1 bg-white rounded-lg shadow-lg py-2 z-20 w-48 border border-gray-100">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150 w-full text-left"
                  >
                    <FileText className="w-4 h-4 text-green-600" />
                    CSV Format
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150 w-full text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    Excel Format
                  </button>
                </div>
              )}
            </div>

            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
              onClick={() => window.location.href = '/create-order'}
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Container */}
        {showBulkActions && (
          <div id="bulkActionsContainer" className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <span id="selectedCount" className="text-sm font-medium text-gray-700">
                {selectedOrders.size} order(s) selected
              </span>
              <button
                onClick={() => handleBulkAction('Completed')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-2 inline" />
                Mark Selected as Completed
              </button>
              <button
                onClick={() => handleBulkAction('Delivered_picked')}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
              >
                <Truck className="w-4 h-4 mr-2 inline" />
                Mark Selected as Delivered
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                <XCircle className="w-4 h-4 mr-2 inline" />
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-xl m-2">
                <CheckCircle className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.total_orders}</h3>
                <p className="text-sm text-gray-500 font-medium">Total Orders</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-xl m-2">
                <Clock className="text-amber-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.pending_orders}</h3>
                <p className="text-sm text-gray-500 font-medium">Pending Orders</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-xl m-2">
                <CheckCircle className="text-green-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.completed_orders}</h3>
                <p className="text-sm text-gray-500 font-medium">Completed Orders</p>
                <p className="text-xs text-gray-400 mt-1">(Excluding Delivered/Picked)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row justify-between w-full items-start md:items-center gap-4">
            <div className="flex flex-row gap-3 flex-wrap">
              <button
                onClick={() => {
                  setPaymentFilter('');
                  setShopFilter('');
                  setSearchQuery('');
                  fetchOrders(1);
                }}
                className={`px-4 py-2 bg-blue-100 text-gray-700 rounded-md text-sm font-medium`}
              >
                All Orders
              </button>

              <select
                value={shopFilter}
                onChange={(e) => {
                  setShopFilter(e.target.value);
                  fetchOrders(1);
                }}
                className="border border-gray-300 rounded-md p-2 text-sm"
              >
                <option value="">All Shops</option>
                <option value="Shop A">Shop A</option>
                <option value="Shop B">Shop B</option>
              </select>

              <div className="flex flex-row items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">Payment:</span>
                {['pending', 'completed', 'partial'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setPaymentFilter(paymentFilter === status ? '' : status);
                      fetchOrders(1);
                    }}
                    className={`px-3 py-1.5 ${paymentFilter === status ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} rounded-full text-sm font-medium`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md p-2 text-sm"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg">
          {loading ? (
            <div className="text-center p-8">
              <Loader2 className="animate-spin w-8 h-8 text-blue-500 mx-auto" />
              <p className="text-gray-600 mt-2">Loading orders...</p>
            </div>
          ) : error ? (
            <div className="text-center p-8 text-red-500">{error}</div>
          ) : orders.length === 0 ? (
            <div className="text-center p-8">
              <div className="inline-flex items-center justify-start rounded-full bg-gray-100 p-4 mb-3">
                <Inbox className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No orders found</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {searchQuery || paymentFilter || shopFilter
                  ? 'No orders match your current filters. Try adjusting your search criteria.'
                  : "There are no orders in the system. When you create orders, they'll appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="w-12 py-4 px-4 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={isCheckAllChecked}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Date</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Order Code</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Customer</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Service</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Item Type</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Items</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Served by</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Amount Paid</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Balance</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Total Billed</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Order Status</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Payment Status</th>
                      <th className="py-4 px-4 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => {
                      const firstItem = order.items[0] || { servicetype: [], itemtype: '', itemname: '' };
                      const hasMultipleItems = order.items.length > 1;
                      const orderStatusConfig = STATUS_COLORS[order.order_status] || STATUS_COLORS.pending;
                      const paymentStatusConfig = PAYMENT_STATUS_COLORS[order.payment_status] || PAYMENT_STATUS_COLORS.pending;

                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 text-center py-4">
                            <input
                              type="checkbox"
                              checked={selectedOrders.has(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                              className="order-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="text-left px-4 py-4">
                            <div className="font-medium text-gray-900 text-xs">
                              {formatDate(order.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900 text-xs">{order.uniquecode}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-xs text-gray-800">{order.customer.name}</div>
                            <div className="text-xs text-gray-500">{order.customer.phone}</div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="relative group inline-block">
                              <span className="text-xs text-gray-800">{formatServiceType(firstItem.servicetype)}</span>
                              {hasMultipleItems && (
                                <>
                                  <span className="text-xs text-gray-500 ml-1">+{order.items.length - 1}</span>
                                  <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 w-48 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                                    <div className="font-medium mb-1">All Services:</div>
                                    <ul className="space-y-1">
                                      {order.items.map((item, idx) => (
                                        <li key={idx} className="text-left truncate">{formatServiceType(item.servicetype)}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="relative group inline-block">
                              <span className="text-xs text-gray-800">{firstItem.itemtype || 'N/A'}</span>
                              {hasMultipleItems && (
                                <>
                                  <span className="text-xs text-gray-500 ml-1">+{order.items.length - 1}</span>
                                  <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 w-48 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                                    <div className="font-medium mb-1">All Item Types:</div>
                                    <ul className="space-y-1">
                                      {order.items.map((item, idx) => (
                                        <li key={idx} className="text-left truncate">{item.itemtype || 'N/A'}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="relative group inline-block">
                              {hasMultipleItems ? (
                                <>
                                  <span className="text-xs text-gray-800">
                                    {(firstItem.itemname || 'N/A').substring(0, 30)}
                                    {(firstItem.itemname && firstItem.itemname.length > 30) && '...'}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-1">+{order.items.length - 1}</span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-800">
                                  {(firstItem.itemname || 'N/A').substring(0, 30)}
                                  {(firstItem.itemname && firstItem.itemname.length > 30) && '...'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-blue-900 text-xs">
                              {order.created_by?.first_name || 'Unknown'}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-blue-900 text-xs">
                              {formatCurrency(order.amount_paid)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-blue-900 text-xs">
                              {formatCurrency(order.balance)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-blue-900 text-xs">
                              {formatCurrency(order.total_price)}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${orderStatusConfig.text} ${orderStatusConfig.bg}`}>
                              <orderStatusConfig.icon className="w-3 h-3 mr-1" />
                              {order.order_status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${paymentStatusConfig.text} ${paymentStatusConfig.bg}`}>
                              <paymentStatusConfig.icon className="w-3 h-3 mr-1" />
                              {order.payment_status}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center justify-start space-x-2">
                              {order.payment_status !== 'completed' && (
                                <button
                                  onClick={() => openPaymentModal(order)}
                                  className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-200"
                                  title="Mark Payment Complete"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => openEditModal(order)}
                                className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors duration-200"
                                title="Edit Order"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => openReceiptModal(order)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                                title="Print Receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              <div className="relative" ref={el => dropdownRefs.current[order.id] = el}>
                                <button
                                  onClick={() => toggleDropdown(order.id)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                >
                                  <EllipsisVertical className="w-4 h-4" />
                                </button>

                                {openDropdownId === order.id && (
                                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                    {order.order_status !== 'Completed' && (
                                      <button
                                        onClick={() => {
                                          handleUpdateStatus(order.id, 'Completed');
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Mark as Completed
                                      </button>
                                    )}

                                    {order.order_status !== 'Delivered_picked' && (
                                      <button
                                        onClick={() => {
                                          handleUpdateStatus(order.id, 'Delivered_picked');
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 flex items-center"
                                      >
                                        <Truck className="w-4 h-4 mr-2" />
                                        Mark as Delivered
                                      </button>
                                    )}

                                    <div className="border-t border-gray-100 my-1"></div>

                                    <button
                                      onClick={() => {
                                        deleteOrder(order.id, order.uniquecode);
                                        setOpenDropdownId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete Order
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.total_pages > 1 && (
                <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-700 mb-4 md:mb-0">
                    Showing <span className="font-medium">{((pagination.current_page - 1) * pageSize) + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.current_page * pageSize, pagination.count)}
                    </span> of{' '}
                    <span className="font-medium">{pagination.count}</span> results
                    <span className="ml-2 text-gray-500">
                      (Page {pagination.current_page} of {pagination.total_pages})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => goToPage(pagination.current_page - 1)}
                      disabled={!pagination.previous}
                      className={`inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${pagination.previous ? 'text-gray-700 bg-white hover:bg-gray-50' : 'text-gray-300 bg-gray-50 cursor-not-allowed'}`}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {renderPaginationButtons()}
                    </div>

                    <button
                      onClick={() => goToPage(pagination.current_page + 1)}
                      disabled={!pagination.next}
                      className={`inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${pagination.next ? 'text-gray-700 bg-white hover:bg-gray-50' : 'text-gray-300 bg-gray-50 cursor-not-allowed'}`}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Order Modal */}
      {showEditModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Order {currentOrder.uniquecode}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => handleEditFormChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => handleEditFormChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Status
                  </label>
                  <select
                    value={editFormData.order_status}
                    onChange={(e) => handleEditFormChange('order_status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Delivered_picked">Delivered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={editFormData.payment_status}
                    onChange={(e) => handleEditFormChange('payment_status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    value={editFormData.amount_paid}
                    onChange={(e) => handleEditFormChange('amount_paid', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Price
                  </label>
                  <input
                    type="number"
                    value={editFormData.total_price}
                    onChange={(e) => handleEditFormChange('total_price', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-4">
                  {editFormData.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Item Name
                          </label>
                          <input
                            type="text"
                            value={item.itemname || ''}
                            onChange={(e) => handleEditItemChange(index, 'itemname', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Type
                          </label>
                          <input
                            type="text"
                            value={formatServiceType(item.servicetype)}
                            onChange={(e) => handleEditItemChange(index, 'servicetype', e.target.value.split(',').map(s => s.trim()))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit Price
                          </label>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleEditItemChange(index, 'unit_price', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEditForm}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
            <div className="p-4 border-b border-gray-200 relative">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div id="receiptContent" className="bg-white p-4 border border-gray-300">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold">CLEAN PAGE LAUNDRY</h3>
                  <p className="text-sm text-gray-600 mt-1">Clean clothes, happy hearts — thank you for coming!</p>
                </div>

                <div className="border-t border-b border-gray-300 py-3 mb-3">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Order Code:</span>
                    <span>{currentOrder.uniquecode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Date:</span>
                    <span>{formatDate(currentOrder.created_at)}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium mb-2">Customer Details:</h4>
                  <p className="text-sm">{currentOrder.customer.name}</p>
                  <p className="text-sm text-gray-600">{currentOrder.customer.phone}</p>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium mb-2">Order Summary:</h4>
                  <div className="space-y-2">
                    {currentOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {item.itemname || 'Item'} ({formatServiceType(item.servicetype)})
                        </span>
                        <span>{formatCurrency(item.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-3 space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(currentOrder.total_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(currentOrder.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-gray-300 pt-2">
                    <span>Balance:</span>
                    <span>{formatCurrency(currentOrder.balance)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-gray-300 pt-2">
                    <span>Served By:</span>
                    <span>{currentOrder.created_by?.email || 'Unknown'}</span>
                  </div>
                  <div className="text-sm flex flex-row justify-between m-2">
                    <p>Contact</p>
                    <p>0705588354</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={printReceipt}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Complete Modal */}
      {showPaymentModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Complete Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mr-3">
                    <CreditCard className="text-white w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Complete Payment</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Confirm to mark this payment as complete. The remaining balance will be added to the total amount paid.
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6">
                <h4 className="text-sm font-semibold text-blue-900 mb-4">Payment Summary</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                        <Wallet className="text-blue-600 w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-blue-700">Current Paid</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">
                      {formatCurrency(currentOrder.amount_paid)}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-2">
                        <PlusCircleIcon className="text-orange-600 w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-orange-700">Balance to Add</span>
                    </div>
                    <p className="text-lg font-bold text-orange-900">
                      {formatCurrency(currentOrder.balance)}
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-2">
                        <CheckCircle className="text-green-600 w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-green-700">New Total</span>
                    </div>
                    <p className="text-lg font-bold text-green-900">
                      {formatCurrency(currentOrder.total_price)}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Payment Method
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select Payment Type --</option>
                    <option value="cash">💵 Cash</option>
                    <option value="mpesa">📱 M-Pesa</option>
                    <option value="card">💳 Credit/Debit Card</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="other">🔄 Other</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={completePayment}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 flex items-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}