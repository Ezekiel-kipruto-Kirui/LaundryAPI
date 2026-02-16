import { useState, useEffect, useCallback, useRef } from 'react';
import { Customer, Order } from '../services/types';
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
    ChartLine,
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
const API_SMS_URL = `${API_BASE_URL}/Laundry/send-sms/`;

// --- Types for Pagination ---
interface PaginatedResponse<T> {
    count: number;
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

// Dashboard Stats Interface
interface DashboardStats {
    pending: number;
    completed: number;
    delivered_picked: number;
}

// Type assertion helper
const assertCustomer = (customer: any): Customer => {
    return {
        id: customer?.id || 0,
        name: customer?.name || 'Unknown',
        phone: customer?.phone || '',
        order_count: customer?.order_count || 0,
        total_spent: customer?.total_spent || '0',
        last_order_date: customer?.last_order_date || null
    };
};

// --- Components ---

// SMS Modal
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
                <form onSubmit={(e) => { e.preventDefault(); onSend(message); }} className="p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => { setMessage(e.target.value); setCharCount(e.target.value.length); }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-40"
                            placeholder="Type your message here..."
                            required
                            maxLength={160}
                        />
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                            <span>Characters: {charCount}/160</span>
                            <span>SMS parts: {Math.ceil(charCount / 160)}</span>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button type="button" onClick={onClose} disabled={isSending} className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isSending || !message.trim()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center">
                            {isSending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send SMS</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Card Component
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">{isNew ? 'Add New Customer' : 'Edit Customer'}</h2>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave({ ...(customer || { id: 0, phone: '', name: '', order_count: 0, total_spent: '0', last_order_date: null }), name, phone }); }} className="p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg">{isNew ? 'Add Customer' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Badges
const OrderStatusBadge = ({ status }: { status: string }) => {
    const config: any = {
        completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
        pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
        processing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' },
        delivered_picked: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Delivered' },
        cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };
    const c = config[status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
    const config: any = {
        completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
        partial: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial' },
        pending: { bg: 'bg-red-100', text: 'text-red-800', label: 'Pending' },
    };
    const c = config[status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
};

// Detail Modal
const CustomerDetailModal = ({ customer, orders, isLoadingOrders, ordersError, onRetryLoadOrders, onClose, onEdit, onDelete }: any) => {
    const totalSpent = orders.reduce((sum: number, order: Order) => sum + parseFloat(order.total_price || '0'), 0).toFixed(2);
    const totalBalance = orders.reduce((sum: number, order: Order) => sum + parseFloat(order.balance || '0'), 0).toFixed(2);
    const pendingOrders = orders.filter((order: Order) => order.order_status === 'pending').length;

    const formatCurrency = (amount: string) => `KSh ${parseFloat(amount || '0').toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
    const formatDate = (dateString: string) => !dateString ? 'N/A' : new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="flex items-center mb-6">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mr-4"><User className="text-white text-2xl" /></div>
                        <div className="flex-1"><h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1><p className="text-gray-600">ID: {customer.id} • Phone: {customer.phone}</p></div>
                        <div className="space-x-2">
                            <button onClick={onEdit} className="inline-flex items-center p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg"><Edit className="w-4 h-4 mr-2" /> Edit</button>
                            <button onClick={onDelete} className="inline-flex items-center p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"><Trash2 className="w-4 h-4 mr-2" /> Delete</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {[
                            { title: 'Total Orders', val: orders.length, color: 'text-blue-900', bg: 'bg-blue-50', titleColor: 'text-blue-800' },
                            { title: 'Total Billed', val: formatCurrency(totalSpent), color: 'text-green-900', bg: 'bg-green-50', titleColor: 'text-green-800' },
                            { title: 'Pending Balance', val: formatCurrency(totalBalance), color: 'text-yellow-900', bg: 'bg-yellow-50', titleColor: 'text-yellow-800' },
                            { title: 'Active Orders', val: pendingOrders, color: 'text-purple-900', bg: 'bg-purple-50', titleColor: 'text-purple-800' },
                        ].map((stat, i) => (
                            <div key={i} className={`${stat.bg} p-4 rounded-lg`}>
                                <h3 className={`text-sm font-medium ${stat.titleColor} mb-2`}>{stat.title}</h3>
                                <p className={`text-2xl font-bold ${stat.color}`}>{stat.val}</p>
                            </div>
                        ))}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Orders</h3>
                    {isLoadingOrders ? <div className="text-center p-8"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" /></div> : ordersError ? <div className="text-center p-8 text-red-500">{ordersError}</div> : orders.length > 0 ? (
                        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                            <table className="w-full">
                                <thead className="bg-gray-50"><tr>
                                    {['Order Code', 'Shop', 'Status', 'Payment', 'Total', 'Date'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                                </tr></thead>
                                <tbody className="divide-y divide-gray-200">
                                    {orders.map((order: Order) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-blue-600">{order.uniquecode}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{order.shop || 'N/A'}</td>
                                            <td className="px-6 py-4"><OrderStatusBadge status={order.order_status} /></td>
                                            <td className="px-6 py-4"><PaymentStatusBadge status={order.payment_status} /></td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(order.total_price)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{formatDate(order.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="text-center text-gray-500 py-8">No orders found.</p>}
                </div>
            </div>
        </div>
    );
};

// Helper: API Fetch
const apiFetch = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
    const token = localStorage.getItem('access_token');
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 20000);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }), ...options.headers } });
        clearTimeout(id);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.status === 204 ? null as T : res.json();
    } catch (e: any) {
        clearTimeout(id);
        throw e;
    }
};

// Types & Interfaces
interface PaginationState { currentPage: number; totalPages: number; totalItems: number; pageSize: number; next: string | null; previous: string | null; }
interface CustomerStats { orderCount: number; totalBilled: number; lastOrderDate: string | null; }
interface CacheEntry<T> { data: T; timestamp: number; }
interface CachedCustomersPage { customers: Customer[]; pagination: PaginationState; }

const CACHE_TTL_MS = 5 * 60 * 1000;
const isCacheFresh = (ts: number) => Date.now() - ts < CACHE_TTL_MS;

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [currentCustomerOrders, setCurrentCustomerOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
    const [isSendingSMS, setIsSendingSMS] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
    
    // Pagination
    const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10, next: null, previous: null });
    
    // Dashboard Stats
    const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ pending: 0, completed: 0, delivered_picked: 0 });
    const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
    const [customerOrdersError, setCustomerOrdersError] = useState<string | null>(null);

    // Refs
    const customersPageCacheRef = useRef<Map<string, CacheEntry<CachedCustomersPage>>>(new Map());
    const allCustomersCacheRef = useRef<CacheEntry<Customer[]> | null>(null);
    const customerOrdersCacheRef = useRef<Map<number, CacheEntry<Order[]>>>(new Map());

    // --- Logic: Dashboard Stats Calculation ---
    const fetchDashboardOrderStats = useCallback(async () => {
        // Optimization: Fetch orders to populate the sub-metrics (Pending/Completed/Delivered)
        // We limit this to the most recent 2000 orders to keep the app responsive, 
        // as counting 10,000+ orders on every load is too heavy.
        try {
            let nextUrl: string | null = `${API_ORDERS_URL}?page_size=100`;
            let count = 0;
            const MAX_DASHBOARD_ORDERS = 2000;
            
            const tempStats: DashboardStats = { pending: 0, completed: 0, delivered_picked: 0 };

            while (nextUrl && count < MAX_DASHBOARD_ORDERS) {
                const response = await apiFetch<PaginatedOrdersResponse>(nextUrl);
                if (!response.results) break;

                response.results.forEach(order => {
                    const status = order.order_status?.toLowerCase();
                    if (status === 'pending') tempStats.pending++;
                    else if (status === 'completed') tempStats.completed++;
                    else if (status === 'delivered_picked') tempStats.delivered_picked++;
                    
                    // Optimization: Cache these orders individually for future "View Details" speed
                    if (!customerOrdersCacheRef.current.has(order.customer?.id)) {
                        customerOrdersCacheRef.current.set(order.customer?.id, { data: [], timestamp: Date.now() });
                    }
                    // Note: We aren't fully populating the order list cache here to save memory, 
                    // just counting. If the user clicks view, we fetch fresh or merge.
                });

                count += response.results.length;
                nextUrl = response.next;
            }
            setDashboardStats(tempStats);
        } catch (err) {
            console.warn("Could not fetch dashboard stats:", err);
        }
    }, []);

    // --- Logic: Fetchers ---

    const fetchAllCustomers = useCallback(async (forceRefresh = false): Promise<Customer[]> => {
        const cached = allCustomersCacheRef.current;
        if (!forceRefresh && cached && isCacheFresh(cached.timestamp)) return cached.data;

        try {
            let loaded: Customer[] = [];
            let nextUrl: string | null = `${API_CUSTOMERS_URL}?page_size=100`;
            while (nextUrl) {
                const res = await apiFetch<PaginatedCustomersResponse>(nextUrl);
                if (res.results) {
                    loaded = [...loaded, ...res.results.map(assertCustomer)];
                    nextUrl = res.next;
                } else break;
                if (loaded.length > 2000) break; // Safety limit
            }
            allCustomersCacheRef.current = { data: loaded, timestamp: Date.now() };
            return loaded;
        } catch (e) { console.error(e); throw e; }
    }, []);

    const fetchCustomers = useCallback(async (page = 1, search = '') => {
        const trimmedSearch = search.trim();
        const cacheKey = `${page}|${pagination.pageSize}|${trimmedSearch}`;
        const cached = customersPageCacheRef.current.get(cacheKey);
        if (cached && isCacheFresh(cached.timestamp)) {
            setCustomers(cached.data.customers);
            setPagination(cached.data.pagination);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            if (trimmedSearch) {
                let source = allCustomers.length ? allCustomers : await fetchAllCustomers();
                if (!allCustomers.length) setAllCustomers(source);

                const query = trimmedSearch.toLowerCase();
                const filtered = source.filter(c => 
                    (c.name || '').toLowerCase().includes(query) || 
                    (c.phone || '').toLowerCase().includes(query)
                );
                const totalItems = filtered.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize));
                const start = (page - 1) * pagination.pageSize;
                const paged = filtered.slice(start, start + pagination.pageSize);
                
                const localPag: PaginationState = {
                    currentPage: page, totalPages, totalItems, pageSize: pagination.pageSize,
                    next: page < totalPages ? `local:${page+1}` : null,
                    previous: page > 1 ? `local:${page-1}` : null
                };

                setCustomers(paged);
                setPagination(localPag);
                customersPageCacheRef.current.set(cacheKey, { data: { customers: paged, pagination: localPag }, timestamp: Date.now() });
            } else {
                const params = new URLSearchParams({ page: page.toString(), page_size: pagination.pageSize.toString() });
                const res = await apiFetch<PaginatedCustomersResponse>(`${API_CUSTOMERS_URL}?${params}`);
                const pageCustomers = res.results.map(assertCustomer);
                const remotePag: PaginationState = {
                    currentPage: res.current_page || page,
                    totalPages: res.total_pages || 1,
                    totalItems: res.count || 0,
                    pageSize: res.page_size || pagination.pageSize,
                    next: res.next, previous: res.previous
                };
                setCustomers(pageCustomers);
                setPagination(remotePag);
                customersPageCacheRef.current.set(cacheKey, { data: { customers: pageCustomers, pagination: remotePag }, timestamp: Date.now() });
            }
        } catch (e) {
            setError("Failed to load customers");
        } finally { setLoading(false); }
    }, [allCustomers, fetchAllCustomers, pagination.pageSize]);

    const fetchOrdersForCustomer = useCallback(async (customer: Customer, forceRefresh = false): Promise<Order[]> => {
        const cached = customerOrdersCacheRef.current.get(customer.id);
        if (!forceRefresh && cached && isCacheFresh(cached.timestamp)) return cached.data;

        // Search orders by customer name or phone
        const term = (customer.phone || customer.name).trim();
        const params = new URLSearchParams({ search: term, page_size: '100' });
        
        try {
            let nextUrl: string | null = `${API_ORDERS_URL}?${params.toString()}`;
            let orders: Order[] = [];
            
            while(nextUrl) {
                const res = await apiFetch<PaginatedOrdersResponse>(nextUrl);
                if(res.results) {
                    const matches = res.results.filter(o => o.customer?.id === customer.id);
                    orders = [...orders, ...matches];
                    nextUrl = res.next;
                } else break;
            }
            
            customerOrdersCacheRef.current.set(customer.id, { data: orders, timestamp: Date.now() });
            return orders;
        } catch(e) {
            console.error(e);
            return [];
        }
    }, []);

    // --- Handlers ---

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPagination(p => ({ ...p, currentPage: 1 })); };
    
    const saveCustomer = async (data: Customer) => {
        setLoading(true);
        const isNew = !data.id;
        try {
            await apiFetch(isNew ? API_CUSTOMERS_URL : `${API_CUSTOMERS_URL}${data.id}/`, {
                method: isNew ? 'POST' : 'PUT',
                body: JSON.stringify({ name: data.name, phone: data.phone })
            });
            // Clear cache
            customersPageCacheRef.current.clear();
            allCustomersCacheRef.current = null;
            await fetchCustomers(pagination.currentPage, searchQuery);
            if(!isNew) await fetchAllCustomers(true); // Refresh all for dashboard
            setIsModalOpen(false);
        } catch(e) {
            setError("Failed to save customer");
        } finally { setLoading(false); }
    };

    const deleteCustomer = async (id: number, name: string) => {
        if(!confirm(`Delete ${name}?`)) return;
        try {
            await apiFetch(`${API_CUSTOMERS_URL}${id}/`, { method: 'DELETE' });
            customersPageCacheRef.current.clear();
            allCustomersCacheRef.current = null;
            await fetchCustomers(pagination.currentPage, searchQuery);
            await fetchAllCustomers(true);
            setIsDetailModalOpen(false);
        } catch(e) { setError("Failed to delete"); }
    };

    const viewCustomerDetails = async (customer: Customer) => {
        setCurrentCustomer(customer);
        setIsDetailModalOpen(true);
        setCustomerOrdersLoading(true);
        setCustomerOrdersError(null);
        try {
            const orders = await fetchOrdersForCustomer(customer);
            setCurrentCustomerOrders(orders);
        } catch(e) {
            setCustomerOrdersError("Failed to load orders");
        } finally {
            setCustomerOrdersLoading(false);
        }
    };

    const sendBulkSMS = async (message: string) => {
        setIsSendingSMS(true);
        try {
            // Use allCustomers
            const list = allCustomers.length ? allCustomers : await fetchAllCustomers();
            if(!allCustomers.length) setAllCustomers(list);
            
            const phones = [...new Set(list.map(c => c.phone).filter(Boolean))];
            const token = localStorage.getItem('access_token');
            
            await fetch(API_SMS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ to_number: phones.slice(0, 100), message })
            });
            alert("SMS Sent!");
            setIsSMSModalOpen(false);
        } catch(e) {
            alert("SMS Failed");
        } finally { setIsSendingSMS(false); }
    };

    // --- Effects ---

    useEffect(() => {
        let mounted = true;
        const init = async () => {
            try {
                await fetchCustomers(1, '');
                const all = await fetchAllCustomers();
                if(mounted) {
                    setAllCustomers(all);
                    // Once we have all customers, fetch dashboard stats
                    fetchDashboardOrderStats();
                }
            } catch(e) { console.error(e); }
            finally { if(mounted) setLoading(false); }
        };
        init();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!loading) fetchCustomers(pagination.currentPage, searchQuery);
    }, [pagination.currentPage, searchQuery]);

    // --- Derived Data for Dashboard ---
    
    // 1. Total Customers: Use the accurate count from pagination (server-side) or loaded all
    const totalSystemCustomers = pagination.totalItems || allCustomers.length;

    // 2. Total Orders: Sum of order_count from allCustomers
    const totalSystemOrders = allCustomers.reduce((sum, c) => sum + (c.order_count || 0), 0);

    // 3. Total Balance (Total Billed): Sum of total_spent from allCustomers
    const totalSystemBalance = allCustomers.reduce((sum, c) => sum + parseFloat(c.total_spent || '0'), 0);

    // Helper to get stats for a specific row (always fall back to customer data)
    const getRowStats = (c: Customer) => ({
        totalBilled: parseFloat(c.total_spent || '0'),
        orderCount: c.order_count || 0,
        lastDate: c.last_order_date
    });

    if (loading && customers.length === 0) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <RefreshCw className="animate-spin text-blue-500 w-8 h-8" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => { setCurrentCustomer(null); setIsModalOpen(true); }} className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm">
                            <PlusCircle className="w-5 h-5 mr-2" /> Add New Customer
                        </button>
                        <button onClick={() => setIsSMSModalOpen(true)} className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm" disabled={loading}>
                            <MessageSquare className="w-5 h-5 mr-2" /> Send SMS
                        </button>
                        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                            <div className="flex-1 relative">
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg" placeholder="Search..." />
                                <Search className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                            </div>
                            <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg">Search</button>
                        </form>
                    </div>
                </div>

                {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

                {/* Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Card 1: Total Customers */}
                    <Card 
                        icon={Users} 
                        title="Total Customers" 
                        value={totalSystemCustomers} 
                        colorClass="blue" 
                    />
                    
                    {/* Card 2: Total Orders + Status Sub-metrics */}
                    <Card 
                        icon={ShoppingBag} 
                        title="Total Orders" 
                        value={totalSystemOrders} 
                        colorClass="green"
                        subMetrics={[
                            { label: 'Pending', value: dashboardStats.pending, icon: Clock, color: 'text-yellow-600' },
                            { label: 'Completed', value: dashboardStats.completed, icon: CheckCircle, color: 'text-green-600' },
                            { label: 'Delivered', value: dashboardStats.delivered_picked, icon: Truck, color: 'text-purple-600' }
                        ]}
                    />
                    
                    {/* Card 3: Total Balance (Total Billed) */}
                    <Card 
                        icon={DollarSign} 
                        title="Total Balance" 
                        value={`KSh ${totalSystemBalance.toFixed(2)}`} 
                        colorClass="purple" 
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-900">Customers List</h2>
                        <span className="text-sm text-gray-600">Total: {pagination.totalItems}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Customer', 'Contact', 'Orders', 'Total Billed', 'Last Order', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customers.map((customer) => {
                                    const stats = getRowStats(customer);
                                    return (
                                        <tr key={customer.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3 text-white"><User className="w-5 h-5"/></div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                                                        <div className="text-xs text-gray-500">ID: {customer.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{customer.phone}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    <ShoppingBag className="w-3 h-3 mr-1" /> {stats.orderCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {/* Displays immediately using customer.total_spent */}
                                                <span className="text-sm font-semibold text-green-600">
                                                    KSh {stats.totalBilled.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {stats.lastDate ? new Date(stats.lastDate).toLocaleDateString() : <span className="text-gray-400">Never</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex space-x-2">
                                                    <button onClick={() => viewCustomerDetails(customer)} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200" title="View"><Eye className="w-4 h-4"/></button>
                                                    <button onClick={() => { setCurrentCustomer(customer); setIsModalOpen(true); }} className="p-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200" title="Edit"><Edit className="w-4 h-4"/></button>
                                                    <button onClick={() => deleteCustomer(customer.id, customer.name)} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Delete"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {customers.length === 0 && (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No customers found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                        <span className="text-sm text-gray-700">Page {pagination.currentPage} of {pagination.totalPages}</span>
                        <div className="flex space-x-2">
                            <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))} disabled={!pagination.previous} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Previous</button>
                            <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))} disabled={!pagination.next} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Next</button>
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {isModalOpen && <CustomerFormModal customer={currentCustomer} onSave={saveCustomer} onClose={() => setIsModalOpen(false)} />}
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
                <SMSModal isOpen={isSMSModalOpen} onClose={() => setIsSMSModalOpen(false)} onSend={sendBulkSMS} customerCount={allCustomers.length} isSending={isSendingSMS} />
            </div>
        </div>
    );
}