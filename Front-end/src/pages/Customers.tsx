import { useState, useEffect, useCallback, useRef } from 'react';
import { Customer, Order } from '../services/types';
import { millify} from "millify";
import {
    Users,
    Edit,
    Trash2,
    RefreshCw,
    PlusCircle,
    ShoppingCart,
    Eye,
    Search,
    User,
    ShoppingBag,
    ChevronLeft,
    ChevronRight,
    Store,
    Calendar,
    DollarSign,
    UserCircle,
    FileText,
    MessageSquare,
    Send,
    AlertCircle,
    Clock,
    CheckCircle,
    Truck
} from 'lucide-react';
import { API_BASE_URL } from '@/services/url';

// --- API Endpoints ---
const API_CUSTOMERS_URL = `${API_BASE_URL}/Laundry/customers/`;
const API_ORDERS_URL = `${API_BASE_URL}/Laundry/orders/`;
const API_ORDERS_SUMMARY_URL = `${API_BASE_URL}/Laundry/orders/summary/`;
const API_SMS_URL = `${API_BASE_URL}/Laundry/send-sms/`;

// --- Types for Pagination ---
interface PaginatedResponse<T> {
    count?: number;
    total_items?: number;
    next: string | null;
    previous: string | null;
    results: T[];
    current_page?: number;
    total_pages?: number;
    page_size?: number;
}

interface PaginatedCustomersResponse extends PaginatedResponse<Customer> {
    results: Customer[];
}

interface PaginatedOrdersResponse extends PaginatedResponse<Order> {
    results: Order[];
}

interface OrdersSummaryResponse {
    total_orders?: number;
    pending_orders?: number;
    completed_orders?: number;
    delivered_orders?: number;
    total_balance?: number;
}

// Type assertion helper for customer objects
const assertCustomer = (customer: any): Customer => {
    return {
        id: customer?.id || 0,
        name: customer?.name || 'Unknown',
        phone: customer?.phone || '',
        order_count: customer?.order_count || 0,
        pending_orders: customer?.pending_orders || 0,
        completed_orders: customer?.completed_orders || 0,
        delivered_orders: customer?.delivered_orders || 0,
        total_spent: customer?.total_spent || '0',
        total_balance: customer?.total_balance || '0',
        last_order_date: customer?.last_order_date || null
    };
};

// --- Components ---

// SMS Send Modal Component
const SMSModal = ({
    isOpen,
    onClose,
    onSend,
    customerCount,
    isSending
}: {
    isOpen: boolean;
    onClose: () => void;
    onSend: (message: string) => void;
    customerCount: number;
    isSending: boolean;
}) => {
    const [message, setMessage] = useState('');
    const [charCount, setCharCount] = useState(0);

    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setMessage(value);
        setCharCount(value.length);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && customerCount > 0) {
            onSend(message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
                    <div className="flex items-center">
                        <MessageSquare className="w-5 h-5 text-blue-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Send SMS to All Customers</h2>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Message to send (All customers in database)
                        </label>
                        <textarea
                            value={message}
                            onChange={handleMessageChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-40"
                            placeholder="Type your message here..."
                            required
                            maxLength={160}
                        />
                        <div className="flex justify-between mt-2">
                            <span className="text-xs text-gray-500">
                                Characters: {charCount}/160
                            </span>
                            <span className="text-xs text-gray-500">
                                SMS parts: {Math.ceil(charCount / 160)}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                            disabled={isSending}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !message.trim()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {isSending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Send SMS to All Customers
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Updated Card Component for Dashboard Metrics
interface SubMetric {
    label: string;
    value: string | number;
    icon?: React.ElementType;
    color?: string;
}

const Card = ({ 
    icon: Icon, 
    title, 
    value, 
    colorClass, 
    subMetrics 
}: { 
    icon: React.ElementType; 
    title: string; 
    value: string | number; 
    colorClass: string;
    subMetrics?: SubMetric[];
}) => {
    const colors: { [key: string]: string } = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        amber: 'bg-amber-500'
    };
    const bgColor = colors[colorClass] || 'bg-blue-500';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="text-white w-6 h-6" />
                </div>
            </div>
            
            {subMetrics && subMetrics.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2">
                        {subMetrics.map((metric, idx) => (
                            <div key={idx} className="text-center">
                                <p className={`text-xs font-semibold ${metric.color || 'text-gray-500'}`}>
                                    {metric.value}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate flex items-center justify-center">
                                    {metric.icon && <metric.icon className="w-3 h-3 mr-1" />}
                                    {metric.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Customer Form Modal
const CustomerFormModal = ({ customer, onSave, onClose }: { customer: Customer | null, onSave: (c: Customer) => void, onClose: () => void }) => {
    const [name, setName] = useState(customer?.name || '');
    const [phone, setPhone] = useState(customer?.phone || '');
    const isNew = !customer || customer.id === 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...(customer || { id: 0, phone: '', name: '', order_count: 0, total_spent: '0', last_order_date: null }),
            name,
            phone,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {isNew ? 'Add New Customer' : 'Edit Customer'}
                    </h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm"
                        >
                            {isNew ? 'Add Customer' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Order Status Badge Component
const OrderStatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
                return { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' };
            case 'pending':
                return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' };
            case 'processing':
                return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' };
            case 'delivered_picked':
                return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Delivered' };
            case 'cancelled':
                return { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
        }
    };

    const config = getStatusConfig(status);
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
};

// Payment Status Badge Component
const PaymentStatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
                return { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' };
            case 'partial':
                return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial' };
            case 'pending':
                return { bg: 'bg-red-100', text: 'text-red-800', label: 'Pending' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
        }
    };

    const config = getStatusConfig(status);
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
};

// Customer Detail View Modal with Orders Table
const CustomerDetailModal = ({
    customer,
    orders,
    isLoadingOrders,
    ordersError,
    onRetryLoadOrders,
    onClose,
    onEdit,
    onDelete
}: {
    customer: Customer,
    orders: Order[],
    isLoadingOrders: boolean,
    ordersError: string | null,
    onRetryLoadOrders: () => void,
    onClose: () => void,
    onEdit: () => void,
    onDelete: () => void
}) => {
    const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0).toFixed(2);
    const totalBalance = orders.reduce((sum, order) => sum + parseFloat(order.balance || '0'), 0).toFixed(2);
    const pendingOrders = orders.filter(order => order.order_status === 'pending').length;

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatCurrency = (amount: string) => {
        const num = parseFloat(amount);
        return `KSh ${isNaN(num) ? '0.00' : num.toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="flex items-center mb-6">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                            <User className="text-white text-2xl" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                            <p className="text-gray-600">ID: {customer.id} • Phone: {customer.phone}</p>
                        </div>
                        <div className="space-x-2">
                            <button onClick={onEdit} className="inline-flex items-center px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors duration-200"><Edit className="w-4 h-4 mr-2" /> Edit</button>
                            <button onClick={onDelete} className="inline-flex items-center px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200"><Trash2 className="w-4 h-4 mr-2" /> Delete</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-blue-800 mb-2">Total Orders</h3>
                            <p className="text-2xl font-bold text-blue-900">{orders.length}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-green-800 mb-2">Total Billed</h3>
                            <p className="text-2xl font-bold text-green-900">{formatCurrency(totalSpent)}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-yellow-800 mb-2">Pending Balance</h3>
                            <p className="text-2xl font-bold text-yellow-900">{formatCurrency(totalBalance)}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-purple-800 mb-2">Active Orders</h3>
                            <p className="text-2xl font-bold text-purple-900">{pendingOrders}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Orders ({orders.length})</h3>
                        {isLoadingOrders ? (
                            <div className="text-center p-8 bg-gray-50 rounded-xl">
                                <RefreshCw className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
                                <p className="text-gray-600">Loading customer orders...</p>
                            </div>
                        ) : ordersError ? (
                            <div className="text-center p-8 bg-red-50 rounded-xl border border-red-200">
                                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                                <p className="text-red-700 mb-4">{ordersError}</p>
                                <button onClick={onRetryLoadOrders} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">Retry</button>
                            </div>
                        ) : orders.length > 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-max">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Code</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {orders.map((order) => (
                                                <tr key={order.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{order.uniquecode}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.shop || 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap"><OrderStatusBadge status={order.order_status} /></td>
                                                    <td className="px-6 py-4 whitespace-nowrap"><PaymentStatusBadge status={order.payment_status} /></td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.total_price)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(order.created_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-8 bg-gray-50 rounded-xl">
                                <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg">No orders found for this customer</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper function for API calls
const apiFetch = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
    const token = localStorage.getItem('access_token');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
    };
    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = options.signal ? null : setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await fetch(url, {
            ...options,
            signal: options.signal || controller.signal,
            headers: { ...defaultHeaders, ...options.headers },
        });
    } catch (error: any) {
        if (error?.name === 'AbortError') throw new Error('Request timeout. Please check API status and try again.');
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        const errorText = await response.text();
        console.error(`API Error ${response.status}:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) return null as T;
    return response.json();
};

// --- Types ---
interface PaginationState {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    next: string | null;
    previous: string | null;
}

interface CustomerStats {
    orderCount: number;
    totalBilled: number;
    totalBalance: number;
    pending: number;
    completed: number;
    delivered: number;
    lastOrderDate: string | null;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface CachedCustomersPage {
    customers: Customer[];
    pagination: PaginationState;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const isCacheFresh = (timestamp: number) => Date.now() - timestamp < CACHE_TTL_MS;

const getAuthToken = (): string | null =>
    localStorage.getItem("access_token") || localStorage.getItem("accessToken");

const parseNumericValue = (value: unknown): number => {
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [overallCustomerCount, setOverallCustomerCount] = useState(0);
    const [currentCustomerOrders, setCurrentCustomerOrders] = useState<Order[]>([]);
    const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
    const [customerOrdersError, setCustomerOrdersError] = useState<string | null>(null);
    const [dashboardTotals, setDashboardTotals] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        deliveredOrders: 0,
        totalBalance: 0,
    });
    
    // Stats by ID for immediate UI updates (Table Breakdowns)
    const [customerStatsById, setCustomerStatsById] = useState<Record<number, CustomerStats>>({});
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
    const [isSendingSMS, setIsSendingSMS] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);

    const [pagination, setPagination] = useState<PaginationState>({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        pageSize: 10,
        next: null,
        previous: null
    });

    const customersPageCacheRef = useRef<Map<string, CacheEntry<CachedCustomersPage>>>(new Map());
    const allCustomersCacheRef = useRef<CacheEntry<Customer[]> | null>(null);
    const customerOrdersCacheRef = useRef<Map<number, CacheEntry<Order[]>>>(new Map());
    const hasLoadedInitialDataRef = useRef(false);

    const clearCustomerListCaches = useCallback(() => {
        customersPageCacheRef.current.clear();
        allCustomersCacheRef.current = null;
    }, []);

    // --- Stats Logic ---

    const deriveCustomerStats = (orders: Order[]): CustomerStats => {
        const totalBilled = orders.reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0);
        const totalBalance = orders.reduce((sum, order) => sum + (parseFloat(order.balance) || 0), 0);
        
        const pending = orders.filter(o => o.order_status.toLowerCase() === 'pending').length;
        const completed = orders.filter(o => o.order_status.toLowerCase() === 'completed').length;
        const delivered = orders.filter(o => o.order_status.toLowerCase() === 'delivered_picked').length;

        const lastOrderDate = orders.reduce<string | null>((latest, order) => {
            if (!order.created_at) return latest;
            if (!latest) return order.created_at;
            return new Date(order.created_at) > new Date(latest) ? order.created_at : latest;
        }, null);

        return {
            orderCount: orders.length,
            totalBilled,
            totalBalance,
            pending,
            completed,
            delivered,
            lastOrderDate
        };
    };

    // Helper: Fetch orders and calculate stats
    const fetchOrdersForCustomer = useCallback(async (customer: Customer, forceRefresh = false): Promise<Order[]> => {
        const cached = customerOrdersCacheRef.current.get(customer.id);
        if (!forceRefresh && cached && isCacheFresh(cached.timestamp)) {
            const stats = deriveCustomerStats(cached.data);
            setCustomerStatsById(prev => {
                if (prev[customer.id]?.orderCount !== stats.orderCount) {
                    return { ...prev, [customer.id]: stats };
                }
                return prev;
            });
            return cached.data;
        }

        const params = new URLSearchParams({
            page_size: '100',
            customer: customer.id.toString(),
        });

        let nextUrl: string | null = `${API_ORDERS_URL}?${params.toString()}`;
        let pageCount = 0;
        const MAX_PAGES = 20;
        let matchedOrders: Order[] = [];

        try {
            while (nextUrl && pageCount < MAX_PAGES) {
                const response = await apiFetch<PaginatedOrdersResponse>(nextUrl);
                if (!response.results || !Array.isArray(response.results)) break;

                const normalizedOrders = response.results.map(order => ({
                    ...order,
                    customer: assertCustomer(order.customer)
                }));

                matchedOrders = [...matchedOrders, ...normalizedOrders];
                nextUrl = response.next;
                pageCount++;
            }

            customerOrdersCacheRef.current.set(customer.id, {
                data: matchedOrders,
                timestamp: Date.now()
            });

            const stats = deriveCustomerStats(matchedOrders);
            setCustomerStatsById(prev => ({ ...prev, [customer.id]: stats }));

            return matchedOrders;
        } catch (err) {
            console.error(`Failed to fetch orders for ${customer.id}`, err);
            return [];
        }
    }, []);

    // --- Data Fetching ---

    const fetchAllCustomers = useCallback(async (forceRefresh = false): Promise<Customer[]> => {
        const cached = allCustomersCacheRef.current;
        if (!forceRefresh && cached && isCacheFresh(cached.timestamp)) {
            return cached.data;
        }

        try {
            let loadedCustomers: Customer[] = [];
            let nextUrl: string | null = `${API_CUSTOMERS_URL}?page_size=100`;

            while (nextUrl) {
                const response = await apiFetch<PaginatedCustomersResponse>(nextUrl);
                if (response.results && Array.isArray(response.results)) {
                    loadedCustomers = [...loadedCustomers, ...response.results.map(assertCustomer)];
                    nextUrl = response.next;
                } else break;
            }

            allCustomersCacheRef.current = { data: loadedCustomers, timestamp: Date.now() };
            return loadedCustomers;
        } catch (err: any) {
            console.error("Error fetching all customers:", err);
            throw err;
        }
    }, []);

    const fetchOrdersSummary = useCallback(async () => {
        try {
            const response = await apiFetch<OrdersSummaryResponse>(API_ORDERS_SUMMARY_URL);
            setDashboardTotals({
                totalOrders: parseNumericValue(response.total_orders),
                pendingOrders: parseNumericValue(response.pending_orders),
                completedOrders: parseNumericValue(response.completed_orders),
                deliveredOrders: parseNumericValue(response.delivered_orders),
                totalBalance: parseNumericValue(response.total_balance),
            });
        } catch (err) {
            console.error("Error fetching orders summary:", err);
        }
    }, []);

    const fetchCustomers = useCallback(async (page = 1, search = '') => {
        const trimmedSearch = search.trim();
        const cacheKey = `${page}|${pagination.pageSize}|${trimmedSearch.toLowerCase()}`;
        const cachedPage = customersPageCacheRef.current.get(cacheKey);

        if (cachedPage && isCacheFresh(cachedPage.timestamp)) {
            setCustomers(cachedPage.data.customers);
            setPagination(cachedPage.data.pagination);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: pagination.pageSize.toString(),
            });
            if (trimmedSearch) params.append('search', trimmedSearch);

            const url = `${API_CUSTOMERS_URL}?${params}`;
            const response = await apiFetch<PaginatedCustomersResponse>(url);

            if (!response.results || !Array.isArray(response.results)) throw new Error('Invalid response format');

            const pageCustomers = response.results.map(assertCustomer);
            const totalItems = parseNumericValue(response.total_items ?? response.count ?? 0);
            const pageSize = response.page_size || pagination.pageSize;
            const totalPages = response.total_pages || Math.max(1, Math.ceil(totalItems / pageSize));

            const remotePagination: PaginationState = {
                currentPage: response.current_page || page,
                totalPages,
                totalItems,
                pageSize,
                next: response.next,
                previous: response.previous
            };

            if (!trimmedSearch) {
                setOverallCustomerCount(totalItems);
            }

            setCustomers(pageCustomers);
            setPagination(remotePagination);
            customersPageCacheRef.current.set(cacheKey, {
                data: { customers: pageCustomers, pagination: remotePagination },
                timestamp: Date.now()
            });
        } catch (err: any) {
            console.error("Error fetching customers:", err);
            setError(err.message === "Unauthorized" ? "Session expired." : "Could not load customers.");
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [pagination.pageSize]);

    // --- Effects ---

    // 1. Initial Load
    useEffect(() => {
        let isMounted = true;
        const loadInitialData = async () => {
            try {
                await Promise.all([
                    fetchCustomers(1, ''),
                    fetchOrdersSummary(),
                ]);
            } catch (err) {
                setError("Failed to load initial data.");
            } finally {
                hasLoadedInitialDataRef.current = true;
                if (isMounted) setLoading(false);
            }
        };
        void loadInitialData();
        return () => { isMounted = false; };
    }, [fetchCustomers, fetchOrdersSummary]);

    // 2. Handle Search/Pagination changes
    useEffect(() => {
        if (!hasLoadedInitialDataRef.current) return;
        void fetchCustomers(pagination.currentPage, searchQuery);
    }, [fetchCustomers, pagination.currentPage, searchQuery]);

    // --- Handlers ---

    const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

    const viewCustomerDetails = async (customer: Customer) => {
        setCurrentCustomer(customer);
        setCurrentCustomerOrders([]);
        setCustomerOrdersError(null);
        setIsDetailModalOpen(true);
        const orders = await fetchOrdersForCustomer(customer, true);
        setCurrentCustomerOrders(orders);
    };

    const saveCustomer = async (customerData: Customer) => {
        setLoading(true);
        const isNew = customerData.id === 0;
        const url = isNew ? API_CUSTOMERS_URL : `${API_CUSTOMERS_URL}${customerData.id}/`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            const response = await apiFetch<Customer>(url, {
                method,
                body: JSON.stringify({ name: customerData.name, phone: customerData.phone, created_by: 1 })
            });

            const savedCustomer: Customer = assertCustomer(response || customerData);
            clearCustomerListCaches();

            if (isNew) {
                setAllCustomers(prev => [savedCustomer, ...prev]);
                setOverallCustomerCount(prev => prev + 1);
            }
            else {
                setAllCustomers(prev => prev.map(c => c.id === savedCustomer.id ? savedCustomer : c));
                customerOrdersCacheRef.current.delete(savedCustomer.id);
                setCustomerStatsById(prev => {
                    const next = { ...prev };
                    delete next[savedCustomer.id];
                    return next;
                });
            }

            await fetchCustomers(pagination.currentPage, searchQuery);
            setIsModalOpen(false);
            alert(`Customer ${isNew ? 'created' : 'updated'} successfully!`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteCustomer = async (id: number, name: string) => {
        if (!window.confirm(`Delete ${name}?`)) return;
        setLoading(true);
        try {
            await apiFetch<void>(`${API_CUSTOMERS_URL}${id}/`, { method: 'DELETE' });
            clearCustomerListCaches();
            customerOrdersCacheRef.current.delete(id);
            setCustomerStatsById(prev => { const n = { ...prev }; delete n[id]; return n; });
            setAllCustomers(prev => prev.filter(c => c.id !== id));
            setOverallCustomerCount(prev => Math.max(prev - 1, 0));
            await fetchCustomers(pagination.currentPage, searchQuery);
            setIsDetailModalOpen(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const sendBulkSMS = async (message: string) => {
        setIsSendingSMS(true);
        try {
            let smsCustomers = allCustomers.length ? allCustomers : await fetchAllCustomers();
            setAllCustomers(smsCustomers);
            const phoneNumbers = [...new Set(smsCustomers.map(c => c.phone).filter(p => p))];
            if (!phoneNumbers.length) return alert("No valid phone numbers.");
            const token = getAuthToken();
            await fetch(API_SMS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ to_number: phoneNumbers, message })
            });
            alert("SMS sent!");
            setIsSMSModalOpen(false);
        } catch (err) {
            alert("Failed to send SMS.");
        } finally {
            setIsSendingSMS(false);
        }
    };

    // --- Render Helpers ---

    const resolveStats = (customer: Customer) => {
        return customerStatsById[customer.id] || {
            orderCount: customer.order_count || 0,
            totalBilled: parseNumericValue(customer.total_spent),
            totalBalance: parseNumericValue(customer.total_balance),
            pending: customer.pending_orders || 0,
            completed: customer.completed_orders || 0,
            delivered: customer.delivered_orders || 0,
            lastOrderDate: customer.last_order_date
        };
    };

    const displayTotalCustomers = overallCustomerCount || pagination.totalItems || 0;

    if (loading && customers.length === 0) return (
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
            <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Search & Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => { setCurrentCustomer(null); setIsModalOpen(true); }} className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm">
                            <PlusCircle className="w-5 h-5 mr-2" /> Add New Customer
                        </button>
                        <button onClick={() => setIsSMSModalOpen(true)} className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm" disabled={loading}>
                            <MessageSquare className="w-5 h-5 mr-2" /> Send SMS ({displayTotalCustomers})
                        </button>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                setPagination(p => ({ ...p, currentPage: 1 }));
                                setSearchQuery(searchInput.trim());
                            }}
                            className="flex-1 flex gap-2"
                        >
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Search by name or phone..."
                                />
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                            <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center">
                                <Search className="w-4 h-4 mr-2" /> Search
                            </button>
                        </form>
                    </div>
                </div>

                {error && <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">{error}</div>}

                {/* Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card icon={Users} title="Total Customers" value={displayTotalCustomers} colorClass="blue" />
                    
                    <Card 
                        icon={ShoppingBag} 
                        title="Total Orders" 
                        value={dashboardTotals.totalOrders}
                        colorClass="green"
                        subMetrics={[
                            { label: 'Pending', value: dashboardTotals.pendingOrders, icon: Clock, color: 'text-yellow-600' },
                            { label: 'Completed', value: dashboardTotals.completedOrders, icon: CheckCircle, color: 'text-green-600' },
                            { label: 'Delivered', value: dashboardTotals.deliveredOrders, icon: Truck, color: 'text-purple-600' }
                        ]}
                    />
                    
                    <Card icon={DollarSign} title="Total Balance" value={`Ksh ${millify(dashboardTotals.totalBalance)}`} colorClass="purple" />
                </div>

                {/* Customers Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-900">Customers List</h2>
                        <span className="text-sm text-gray-500">Page {pagination.currentPage} of {pagination.totalPages}</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Breakdown</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Billed</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Order</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customers.map((customer) => {
                                    const stats = resolveStats(customer);
                                    
                                    return (
                                        <tr key={customer.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3 text-white font-bold">
                                                        {customer.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                                                        <div className="text-xs text-gray-500">{customer.phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{stats.orderCount}</div>
                                                <div className="text-xs text-gray-500">Orders</div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex gap-2 text-xs">
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" /> {stats.pending}
                                                    </span>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full flex items-center">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> {stats.completed}
                                                    </span>
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full flex items-center">
                                                        <Truck className="w-3 h-3 mr-1" /> {stats.delivered}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-green-600">{formatCurrency(stats.totalBilled)}</div>
                                                {stats.totalBalance > 0 && (
                                                    <div className="text-xs text-red-500">Bal: {formatCurrency(stats.totalBalance)}</div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {stats.lastOrderDate 
                                                    ? new Date(stats.lastOrderDate).toLocaleDateString() 
                                                    : 'Never'}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-2">
                                                    <button onClick={() => viewCustomerDetails(customer)} className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg" title="View Details"><Eye className="w-4 h-4" /></button>
                                                    <button onClick={() => { setCurrentCustomer(customer); setIsModalOpen(true); }} className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                                                    <button onClick={() => deleteCustomer(customer.id, customer.name)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                            <button onClick={() => setPagination(p => ({...p, currentPage: p.currentPage - 1}))} disabled={!pagination.previous} className="px-4 py-2 bg-white border rounded disabled:opacity-50">Previous</button>
                            <span className="text-sm text-gray-700">Page {pagination.currentPage} of {pagination.totalPages}</span>
                            <button onClick={() => setPagination(p => ({...p, currentPage: p.currentPage + 1}))} disabled={!pagination.next} className="px-4 py-2 bg-white border rounded disabled:opacity-50">Next</button>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <CustomerFormModal
                    customer={currentCustomer}
                    onSave={saveCustomer}
                    onClose={() => { setIsModalOpen(false); setCurrentCustomer(null); }}
                />
            )}

            {isDetailModalOpen && currentCustomer && (
                <CustomerDetailModal
                    customer={currentCustomer}
                    orders={currentCustomerOrders}
                    isLoadingOrders={customerOrdersLoading}
                    ordersError={customerOrdersError}
                    onRetryLoadOrders={() => viewCustomerDetails(currentCustomer)}
                    onClose={() => setIsDetailModalOpen(false)}
                    onEdit={() => { setIsDetailModalOpen(false); setIsModalOpen(true); }}
                    onDelete={() => deleteCustomer(currentCustomer.id, currentCustomer.name)}
                />
            )}

            <SMSModal
                isOpen={isSMSModalOpen}
                onClose={() => setIsSMSModalOpen(false)}
                onSend={sendBulkSMS}
                customerCount={displayTotalCustomers}
                isSending={isSendingSMS}
            />
        </div>
    );
}
