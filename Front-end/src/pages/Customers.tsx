import { useState, useEffect, useCallback } from 'react';
import { Customer, Order, OrderItem } from '../services/types';
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
    FileText
} from 'lucide-react';
import { fetchApi } from '@/services/api';

// --- API Endpoints ---
const API_CUSTOMERS_URL = "customers/";
const API_ORDERS_URL = "Laundry/orders/"; // Updated to use correct route

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

// Card Component for Dashboard Metrics
const Card = ({ icon: Icon, title, value, colorClass }: { icon: React.ElementType, title: string, value: string | number, colorClass: string }) => {
    const colors: { [key: string]: string } = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500'
    };
    const bgColor = colors[colorClass] || 'bg-blue-500';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
                <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center mr-4`}>
                    <Icon className="text-white text-xl" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-600">{title}</p>
                </div>
            </div>
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
            ...(customer || { id: 0, phone: '', name: '', orders: [] }),
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
const CustomerDetailModal = ({ customer, orders, onClose, onEdit, onDelete }: {
    customer: Customer,
    orders: Order[],
    onClose: () => void,
    onEdit: () => void,
    onDelete: () => void
}) => {
    const customerOrders = orders.filter(order => order.customer.id === customer.id);

    // Calculate customer statistics - FIXED: Use total_price from order, not total_item_price
    const totalSpent = customerOrders.reduce((sum, order) =>
        sum + parseFloat(order.total_price || '0'), 0
    ).toFixed(2);

    const totalBalance = customerOrders.reduce((sum, order) =>
        sum + parseFloat(order.balance || '0'), 0
    ).toFixed(2);

    const pendingOrders = customerOrders.filter(order =>
        order.order_status === 'pending'
    ).length;

    const completedOrders = customerOrders.filter(order =>
        order.order_status === 'Completed' || order.order_status === 'Delivered_picked'
    ).length;

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Format currency
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
                    {/* Customer Header */}
                    <div className="flex items-center mb-6">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                            <User className="text-white text-2xl" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                            <p className="text-gray-600">ID: {customer.id} • Phone: {customer.phone}</p>
                        </div>
                        <div className="space-x-2">
                            <button
                                onClick={onEdit}
                                className="inline-flex items-center p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors duration-200"
                                title="Edit Customer"
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                            </button>
                            <button
                                onClick={onDelete}
                                className="inline-flex items-center p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200"
                                title="Delete Customer"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </button>
                        </div>
                    </div>

                    {/* Customer Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-blue-800 mb-2">Total Orders</h3>
                            <p className="text-2xl font-bold text-blue-900">{customerOrders.length}</p>
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

                    {/* Orders Table Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Customer Orders ({customerOrders.length})</h3>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">
                                    Completed: <span className="font-semibold">{completedOrders}</span>
                                </span>
                                <span className="text-sm text-gray-600">
                                    • Pending: <span className="font-semibold">{pendingOrders}</span>
                                </span>
                            </div>
                        </div>

                        {customerOrders.length > 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-max">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <FileText className="w-4 h-4 mr-2" />
                                                        Order Code
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <Store className="w-4 h-4 mr-2" />
                                                        Shop
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Payment Status
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <DollarSign className="w-4 h-4 mr-2" />
                                                        Total Billed
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-4 h-4 mr-2" />
                                                        Created Date
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-4 h-4 mr-2" />
                                                        Delivery Date
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-4 h-4 mr-2" />
                                                        Clearence Date
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <div className="flex items-center">
                                                        <UserCircle className="w-4 h-4 mr-2" />
                                                        Cleared By
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {customerOrders.map((order) => (
                                                <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-blue-600">{order.uniquecode}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{order.shop || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <OrderStatusBadge status={order.order_status} />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <PaymentStatusBadge status={order.payment_status} />
                                                        {order.payment_type && order.payment_type !== 'None' && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {order.payment_type}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {formatCurrency(order.total_price)}
                                                        </div>
                                                        {parseFloat(order.balance) > 0 && (
                                                            <div className="text-xs text-red-500">
                                                                Balance: {formatCurrency(order.balance)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {formatDate(order.created_at)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {formatDate(order.delivery_date)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {order.updated_by ? (
                                                                formatDate(order.updated_at || '')
                                                            ) : (
                                                                <span className="text-gray-400">Not cleared</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">
                                                            {order.updated_by ? (
                                                                <div>
                                                                    <div>{order.updated_by.first_name}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {order.updated_by.user_type || 'Staff'}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">N/A</span>
                                                            )}
                                                        </div>
                                                    </td>
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
                                <p className="text-gray-400 text-sm mt-2">When orders are created for this customer, they'll appear here</p>
                            </div>
                        )}
                    </div>

                    {/* Order Summary */}
                    {customerOrders.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-6">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Order Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">Total Billed:</span>
                                    <span className="font-semibold ml-2">{formatCurrency(totalSpent)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Total Paid:</span>
                                    <span className="font-semibold ml-2 text-green-600">
                                        {formatCurrency((parseFloat(totalSpent) - parseFloat(totalBalance)).toFixed(2))}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Outstanding Balance:</span>
                                    <span className="font-semibold ml-2 text-red-600">{formatCurrency(totalBalance)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);

    // Pagination state
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        pageSize: 10,
        next: null as string | null,
        previous: null as string | null
    });

    // Dashboard Calculations
    const totalCustomers = pagination.totalItems;
    const displayedCustomers = customers;

    // Helper function to calculate customer statistics from orders
    const calculateCustomerStats = useCallback((customerId: number) => {
        const customerOrders = orders.filter(order => order.customer.id === customerId);

        // Calculate total billed from order.total_price
        const totalBilled = customerOrders.reduce((sum, order) => {
            return sum + parseFloat(order.total_price || '0');
        }, 0);

        return {
            orderCount: customerOrders.length,
            totalBilled: totalBilled.toFixed(2),
            lastOrderDate: customerOrders[0]?.created_at || null
        };
    }, [orders]);

    // Data Fetching with fetchApi - Updated for backend pagination
    const fetchCustomers = useCallback(async (page = 1, search = '') => {
        setLoading(true);
        setError(null);

        try {
            // Build query parameters
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: pagination.pageSize.toString()
            });

            if (search.trim()) {
                params.append('search', search);
            }

            const response = await fetchApi<PaginatedCustomersResponse>(
                `${API_CUSTOMERS_URL}?${params}`,
                { method: 'GET' },
                'laundry'
            );

            // Transform data with stats calculated from orders
            const transformedData = response.results.map((customer: Customer) => {
                const stats = calculateCustomerStats(customer.id);

                return {
                    ...customer,
                    order_count: stats.orderCount,
                    total_spent: stats.totalBilled, // This will now show actual billed amount
                    last_order_date: stats.lastOrderDate
                };
            });

            setCustomers(transformedData);

            // Handle both response formats (count vs total_items)
            const totalItems = response.count || (response as any).total_items || 0;
            const totalPages = response.total_pages || Math.ceil(totalItems / pagination.pageSize) || 1;
            const currentPage = response.current_page || page;
            const pageSize = response.page_size || pagination.pageSize;

            setPagination({
                currentPage,
                totalPages,
                totalItems,
                pageSize,
                next: response.next,
                previous: response.previous
            });
        } catch (err: any) {
            console.error("Error fetching customers:", err);
            if (err.message === "Unauthorized") {
                setError("Session expired. Please login again.");
            } else {
                setError("Could not load customers data. Please check the API status.");
            }
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [orders, pagination.pageSize, calculateCustomerStats]);

    const fetchAllOrders = useCallback(async () => {
        try {
            // Fetch orders with correct API route
            let allOrders: Order[] = [];
            let nextUrl: string | null = `${API_ORDERS_URL}?page_size=100`;

            // Handle pagination for orders
            while (nextUrl) {
                const response = await fetchApi<PaginatedOrdersResponse>(
                    nextUrl,
                    { method: 'GET' },
                    'laundry'
                );

                allOrders = [...allOrders, ...response.results];
                nextUrl = response.next;

                // Break if we have a lot of orders to prevent infinite loops
                if (allOrders.length > 500) break;
            }

            setOrders(allOrders);
        } catch (err: any) {
            console.error("Error fetching all orders:", err);
            if (err.message === "Unauthorized") {
                setError("Session expired. Please login again.");
            } else {
                console.error("Error fetching orders:", err);
            }
        }
    }, []);

    useEffect(() => {
        fetchAllOrders();
    }, [fetchAllOrders]);

    useEffect(() => {
        fetchCustomers(pagination.currentPage, searchQuery);
    }, [pagination.currentPage, searchQuery, fetchCustomers]);

    // CRUD Handlers using fetchApi
    const saveCustomer = async (customerData: Customer) => {
        setLoading(true);
        const isNew = customerData.id === 0;
        const url = isNew ? API_CUSTOMERS_URL : `${API_CUSTOMERS_URL}${customerData.id}/`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            await fetchApi<Customer>(
                url,
                {
                    method,
                    body: JSON.stringify({
                        name: customerData.name,
                        phone: customerData.phone,
                        created_by: 1 // This should come from your auth system
                    })
                },
                'laundry'
            );

            await fetchCustomers(pagination.currentPage, searchQuery);
            setIsModalOpen(false);
            alert(`Customer ${isNew ? 'created' : 'updated'} successfully!`);
        } catch (err: any) {
            console.error("Error saving customer:", err);
            if (err.message === "Unauthorized") {
                setError("Session expired. Please login again.");
            } else {
                setError(`Failed to save customer: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const deleteCustomer = async (id: number, name: string) => {
        if (!window.confirm(`Are you sure you want to delete customer: ${name}? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        try {
            await fetchApi<void>(
                `${API_CUSTOMERS_URL}${id}/`,
                { method: 'DELETE' },
                'laundry'
            );

            await fetchCustomers(pagination.currentPage, searchQuery);
            setIsDetailModalOpen(false);
            alert(`Customer ${name} deleted successfully.`);
        } catch (err: any) {
            console.error("Error deleting customer:", err);
            if (err.message === "Unauthorized") {
                setError("Session expired. Please login again.");
            } else {
                setError(`Failed to delete customer: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // View Customer Details
    const viewCustomerDetails = (customer: Customer) => {
        setCurrentCustomer(customer);
        setIsDetailModalOpen(true);
    };

    // Edit Customer
    const editCustomer = (customer: Customer) => {
        setCurrentCustomer(customer);
        setIsModalOpen(true);
    };

    // Search Handler - triggers backend search
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to first page on new search
    };

    // Pagination handlers
    const handlePageChange = (page: number) => {
        setPagination(prev => ({ ...prev, currentPage: page }));
    };

    const handleNextPage = () => {
        if (pagination.next) {
            setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
        }
    };

    const handlePrevPage = () => {
        if (pagination.previous) {
            setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
        }
    };

    if (loading && customers.length === 0) return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center p-8 text-gray-500">
                    <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" />
                    <p>Loading customer data...</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Search Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => { setCurrentCustomer(null); setIsModalOpen(true); }}
                            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-sm"
                        >
                            <PlusCircle className="w-5 h-5 mr-2" />
                            Add New Customer
                        </button>
                        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Search by name or phone number..."
                                />
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                            <button
                                type="submit"
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center"
                            >
                                <Search className="w-4 h-4 mr-2" />
                                Search
                            </button>
                        </form>
                    </div>
                </div>

                {/* Quick Stats with Server-served Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card
                        icon={Users}
                        title="Total Customers"
                        value={totalCustomers}
                        colorClass="blue"
                    />
                    <Card
                        icon={ShoppingBag}
                        title="Current Page Results"
                        value={displayedCustomers.length}
                        colorClass="green"
                    />
                    <Card
                        icon={ChartLine}
                        title={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
                        value={`Served by Server`}
                        colorClass="purple"
                    />
                </div>

                {/* Customers Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Card Header with Server Info */}
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Customers List</h2>
                                <div className="text-sm text-gray-600 mt-1">
                                    Page {pagination.currentPage} of {pagination.totalPages} •
                                    Total: {pagination.totalItems} customers •
                                    Served by: <span className="font-semibold">Backend Pagination</span>
                                </div>
                            </div>
                            <span className="text-sm text-gray-600 mt-2 sm:mt-0">
                                Showing {displayedCustomers.length} per page
                            </span>
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Customer
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Orders
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Billed
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Last Order
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayedCustomers.length > 0 ? (
                                    displayedCustomers.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors duration-150">
                                            {/* Name */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                                                        <User className="text-white w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {customer.name}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            ID: {customer.id}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Phone */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{customer.phone}</div>
                                                <div className="text-sm text-gray-500">Primary contact</div>
                                            </td>

                                            {/* Orders */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                    <ShoppingBag className="w-3 h-3 mr-1" />
                                                    {customer.order_count || 0}
                                                </span>
                                            </td>

                                            {/* Total Billed */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-green-600">
                                                    KSh {customer.total_spent || '0.00'}
                                                </div>
                                                <div className="text-xs text-gray-500">Lifetime value</div>
                                            </td>

                                            {/* Last Order */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {customer.last_order_date ? (
                                                        new Date(customer.last_order_date).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })
                                                    ) : (
                                                        <span className="text-gray-400">Never</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">Last activity</div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-2">
                                                    {/* View Details */}
                                                    <button
                                                        onClick={() => viewCustomerDetails(customer)}
                                                        className="inline-flex items-center p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors duration-200"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => editCustomer(customer)}
                                                        className="inline-flex items-center p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors duration-200"
                                                        title="Edit Customer"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => deleteCustomer(customer.id, customer.name)}
                                                        className="inline-flex items-center p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors duration-200"
                                                        title="Delete Customer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="text-gray-400 mb-4">
                                                <Users className="w-12 h-12 mx-auto" />
                                            </div>
                                            <p className="text-gray-500 text-lg">No customers found</p>
                                            <p className="text-gray-400 text-sm mt-2">
                                                Try adjusting your search criteria or add a new customer
                                            </p>
                                            <button
                                                onClick={() => { setCurrentCustomer(null); setIsModalOpen(true); }}
                                                className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                                            >
                                                Add First Customer
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination - Now based on server response */}
                    {pagination.totalPages > 1 && (
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                <div className="text-sm text-gray-700">
                                    Page {pagination.currentPage} of {pagination.totalPages} •
                                    Total: {pagination.totalItems} customers •
                                    Served by: <span className="font-semibold">Backend API</span>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={!pagination.previous}
                                        className={`px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium ${!pagination.previous ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
                                            } transition-colors duration-200 flex items-center`}
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-1" />
                                        Previous
                                    </button>

                                    {/* Page Numbers */}
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (pagination.totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (pagination.currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (pagination.currentPage >= pagination.totalPages - 2) {
                                            pageNum = pagination.totalPages - 4 + i;
                                        } else {
                                            pageNum = pagination.currentPage - 2 + i;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`px-4 py-2 border rounded-md text-sm font-medium ${pagination.currentPage === pageNum
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                    } transition-colors duration-200`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}

                                    <button
                                        onClick={handleNextPage}
                                        disabled={!pagination.next}
                                        className={`px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium ${!pagination.next ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
                                            } transition-colors duration-200 flex items-center`}
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {isModalOpen && (
                <CustomerFormModal
                    customer={currentCustomer}
                    onSave={saveCustomer}
                    onClose={() => {
                        setIsModalOpen(false);
                        setCurrentCustomer(null);
                    }}
                />
            )}

            {isDetailModalOpen && currentCustomer && (
                <CustomerDetailModal
                    customer={currentCustomer}
                    orders={orders}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        setCurrentCustomer(null);
                    }}
                    onEdit={() => {
                        setIsDetailModalOpen(false);
                        setIsModalOpen(true);
                    }}
                    onDelete={() => deleteCustomer(currentCustomer.id, currentCustomer.name)}
                />
            )}
        </div>
    );
}