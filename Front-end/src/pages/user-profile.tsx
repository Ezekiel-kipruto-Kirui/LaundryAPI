import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from "@/services/url"
import { getAccessToken } from "@/services/api" // Import from your api.ts
import {
    User,
    Order as LaundryOrder,
    HotelOrderItem,
    HotelOrder // Import HotelOrder type
} from "@/services/types"

// Constants for API endpoints
const USER_PROFILE_URL = `${API_BASE_URL}/me/`
const LAUNDRY_ORDERS_URL = `${API_BASE_URL}/Laundry/orders/`
const HOTEL_ORDERS_URL = `${API_BASE_URL}/Hotel/orders/` // Changed to orders endpoint

// Helper function to get authorization header using your getAccessToken method
const getAuthHeader = () => {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Extended interface for hotel order items with enriched data
interface EnrichedHotelOrderItem extends HotelOrderItem {
    _created_by?: User;
    _created_at?: string;
    _total_price?: number;
}

const UserProfile = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hotelOrders, setHotelOrders] = useState<HotelOrder[]>([]); // Changed to HotelOrder[]
    const [laundryOrders, setLaundryOrders] = useState<LaundryOrder[]>([]);
    const [enrichedHotelOrderItems, setEnrichedHotelOrderItems] = useState<EnrichedHotelOrderItem[]>([]);
    const [filteredHotelOrderItems, setFilteredHotelOrderItems] = useState<EnrichedHotelOrderItem[]>([]);
    const [filteredLaundryOrders, setFilteredLaundryOrders] = useState<LaundryOrder[]>([]);

    // Function to fetch all user data
    const fetchUserData = async () => {
        try {
            const token = getAccessToken();
            if (!token) {
                setError('Please login to view your profile');
                setLoading(false);
                setInitialLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            // Fetch user profile
            const userResponse = await axios.get(USER_PROFILE_URL, {
                headers: getAuthHeader()
            });

            setUser(userResponse.data);

            // Fetch hotel orders (now from orders endpoint)
            const hotelResponse = await axios.get(HOTEL_ORDERS_URL, {
                headers: getAuthHeader()
            });

            // Get the results from paginated response
            const hotelOrdersData = hotelResponse.data.results || hotelResponse.data.data || hotelResponse.data || [];
            setHotelOrders(hotelOrdersData);

            // Enrich hotel order items with order data
            const enrichedItems: EnrichedHotelOrderItem[] = [];
            hotelOrdersData.forEach((order: HotelOrder) => {
                if (order.order_items && Array.isArray(order.order_items)) {
                    order.order_items.forEach((item: HotelOrderItem) => {
                        // Create enriched item with order data
                        const enrichedItem: EnrichedHotelOrderItem = {
                            ...item,
                            _created_by: order.created_by,
                            _created_at: order.created_at,
                            _total_price: order.total_order_price || (order as any).total_amount || 0
                        };
                        enrichedItems.push(enrichedItem);
                    });
                }
            });
            setEnrichedHotelOrderItems(enrichedItems);

            // Fetch laundry orders
            const laundryResponse = await axios.get(LAUNDRY_ORDERS_URL, {
                headers: getAuthHeader()
            });

            // Get the results from paginated response
            const laundryOrdersData = laundryResponse.data.results || laundryResponse.data.data || laundryResponse.data || [];
            setLaundryOrders(laundryOrdersData);

            setLoading(false);
            setInitialLoading(false);
        } catch (err: any) {
            console.error('Error fetching user data:', err);

            if (err.response?.status === 401) {
                setError('Your session has expired. Please login again.');
            } else if (err.response?.status === 403) {
                setError('You do not have permission to access this data.');
            } else if (err.response?.status === 404) {
                setError('API endpoint not found. Please check the configuration.');
            } else if (err.message?.includes('Network Error')) {
                setError('Network error. Please check your connection.');
            } else {
                setError(err.message || 'Failed to fetch user data. Please try again.');
            }

            setLoading(false);
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    // Filter hotel order items created by the user
    useEffect(() => {
        if (user && enrichedHotelOrderItems.length > 0) {
            const filtered = enrichedHotelOrderItems.filter((item) => {
                // Check if _created_by exists and matches user ID
                return item._created_by && item._created_by.id === user.id;
            });
            setFilteredHotelOrderItems(filtered);
        }
    }, [user, enrichedHotelOrderItems]);

    // Filter laundry orders created or updated by the user
    useEffect(() => {
        if (user && laundryOrders.length > 0) {
            const filtered = laundryOrders.filter((order) => {
                // Check if created_by or updated_by matches user ID
                const isCreator = order.created_by?.id === user.id;
                const isUpdater = order.updated_by?.id === user.id;
                return isCreator || isUpdater;
            });
            setFilteredLaundryOrders(filtered);
        }
    }, [user, laundryOrders]);

    // Calculate hotel statistics
    const calculateHotelStats = () => {
        if (!filteredHotelOrderItems.length) return { totalHotelOrders: 0, totalHotelRevenue: 0 };

        const totalHotelOrders = filteredHotelOrderItems.length;
        const totalHotelRevenue = filteredHotelOrderItems.reduce((sum, item) => {
            // Use _total_price if available, otherwise calculate from price and quantity
            if (item._total_price !== undefined) {
                return sum + (item._total_price || 0);
            }
            // Fallback: calculate from price and quantity
            const price = parseFloat(item.price?.toString() || '0') || 0;
            const quantity = item.quantity || 0;
            return sum + (price * quantity);
        }, 0);

        return { totalHotelOrders, totalHotelRevenue };
    };

    // Calculate laundry statistics
    const calculateLaundryStats = () => {
        if (!filteredLaundryOrders.length) return {
            totalLaundryOrders: 0,
            totalLaundryRevenue: 0,
            createdOrders: 0,
            updatedOrders: 0
        };

        const totalLaundryOrders = filteredLaundryOrders.length;
        const totalLaundryRevenue = filteredLaundryOrders.reduce((sum, order) => {
            return sum + (parseFloat(order.total_price || '0') || 0);
        }, 0);

        // Calculate orders created vs updated
        const createdOrders = filteredLaundryOrders.filter(order =>
            order.created_by?.id === user?.id
        ).length;

        const updatedOrders = filteredLaundryOrders.filter(order =>
            order.updated_by?.id === user?.id
        ).length;

        return { totalLaundryOrders, totalLaundryRevenue, createdOrders, updatedOrders };
    };

    const { totalHotelOrders, totalHotelRevenue } = calculateHotelStats();
    const { totalLaundryOrders, totalLaundryRevenue, createdOrders, updatedOrders } = calculateLaundryStats();

    // Refresh data function
    const handleRefresh = () => {
        fetchUserData();
    };

    // Get display price for hotel order item
    const getHotelItemDisplayPrice = (item: EnrichedHotelOrderItem): string => {
        if (item._total_price !== undefined) {
            return (item._total_price || 0).toFixed(2);
        }
        // Calculate from price and quantity
        const price = parseFloat(item.price?.toString() || '0') || 0;
        const quantity = item.quantity || 0;
        return (price * quantity).toFixed(2);
    };

    // Get display date for hotel order item
    const getHotelItemDisplayDate = (item: EnrichedHotelOrderItem): string => {
        if (item._created_at) {
            return new Date(item._created_at).toLocaleDateString();
        }
        return 'N/A';
    };

    // If initial loading (first time)
    if (initialLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
                <span className="text-gray-600 text-lg">Loading your profile...</span>
                <p className="text-gray-400 text-sm mt-2">Please wait while we fetch your data</p>
            </div>
        );
    }

    // If still loading after initial load (refresh)
    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <span className="text-gray-600">Refreshing data...</span>
            </div>
        );
    }

    if (error && !user) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <div className="text-red-600 text-xl font-semibold mb-3">Authentication Required</div>
                    <p className="text-red-700 mb-4">{error}</p>
                    <div className="flex justify-center space-x-4">
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-200"
                        >
                            Go to Login
                        </button>
                        <button
                            onClick={handleRefresh}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-md transition duration-200"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-yellow-700">No user data available</p>
                    <div className="mt-3 space-x-2">
                        <button
                            onClick={handleRefresh}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md"
                        >
                            Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
                {/* Header with refresh button */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2 px-4 rounded-md transition duration-200"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                    </button>
                </div>

                {/* User Profile Header */}
                <div className="mb-8">
                    <div className="border-b pb-4">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Personal Information</h2>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 text-sm">Email</p>
                                <p className="font-medium">{user.email}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 text-sm">Full Name</p>
                                <p className="font-medium">
                                    {user.first_name || user.last_name
                                        ? `${user.first_name} ${user.last_name}`.trim()
                                        : 'Not specified'}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 text-sm">User Type</p>
                                <p className="font-medium capitalize">{user.user_type || 'Not specified'}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 text-sm">User ID</p>
                                <p className="font-medium">#{user.id}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 text-sm">Status</p>
                                <p className="font-medium">
                                    {user.is_active ? (
                                        <span className="text-green-600 flex items-center">
                                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-red-600 flex items-center">
                                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                            Inactive
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 text-sm">Role</p>
                                <p className="font-medium">
                                    {user.is_superuser ? 'Admin' : user.is_staff ? 'Staff' : 'Regular User'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orders Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Hotel Orders Section */}
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-semibold text-gray-800">Your Hotel Orders</h2>
                            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                                {filteredHotelOrderItems.length} item{filteredHotelOrderItems.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {filteredHotelOrderItems.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Order ID</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Food Item</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Category</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Qty</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredHotelOrderItems.slice(0, 5).map((item) => (
                                                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-mono text-sm text-gray-700">#{item.id}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-medium text-gray-800">{item.food_item_name || item.food_item?.name || 'N/A'}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {getHotelItemDisplayDate(item)}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                                            {item.food_item?.category?.name || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-700">{item.quantity}</td>
                                                    <td className="py-3 px-4 font-medium text-green-700">
                                                        Ksh {getHotelItemDisplayPrice(item)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredHotelOrderItems.length > 5 && (
                                    <div className="mt-4 text-center">
                                        <p className="text-sm text-gray-500">
                                            Showing 5 of {filteredHotelOrderItems.length} items
                                        </p>
                                        <button className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                                            View All Hotel Orders
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-gray-400 mb-3">
                                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <p className="text-gray-500">No hotel orders created by you yet.</p>
                                <p className="text-gray-400 text-sm mt-1">Your hotel orders will appear here.</p>
                            </div>
                        )}
                    </div>

                    {/* Laundry Orders Section */}
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-semibold text-gray-800">Your Laundry Orders</h2>
                            <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">
                                {filteredLaundryOrders.length} order{filteredLaundryOrders.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {filteredLaundryOrders.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Order Code</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Customer</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Status</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Total</th>
                                                <th className="py-3 px-4 text-left text-gray-600 font-medium">Role</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredLaundryOrders.slice(0, 5).map((order) => {
                                                const isCreator = order.created_by?.id === user.id;
                                                const role = isCreator ? 'Creator' : 'Updater';

                                                return (
                                                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3 px-4 font-mono text-sm text-gray-700">{order.uniquecode}</td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-medium text-gray-800">{order.customer?.name || 'N/A'}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {new Date(order.created_at).toLocaleDateString()}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.order_status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                                order.order_status === 'Delivered_picked' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {order.order_status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-green-700">
                                                            Ksh {order.total_price || '0.00'}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${role === 'Creator' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-purple-100 text-purple-800'
                                                                }`}>
                                                                {role}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredLaundryOrders.length > 5 && (
                                    <div className="mt-4 text-center">
                                        <p className="text-sm text-gray-500">
                                            Showing 5 of {filteredLaundryOrders.length} orders
                                        </p>
                                        <button className="mt-2 text-purple-600 hover:text-purple-800 text-sm font-medium">
                                            View All Laundry Orders
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-gray-400 mb-3">
                                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <p className="text-gray-500">No laundry orders created or updated by you yet.</p>
                                <p className="text-gray-400 text-sm mt-1">Your laundry work will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Section */}
                <div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">Summary of Your Work</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-gray-600 text-sm mb-1">Total Hotel Items (System)</p>
                            <p className="text-lg font-bold text-gray-800">{enrichedHotelOrderItems.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-gray-600 text-sm mb-1">Your Hotel Items</p>
                            <p className="text-lg font-bold text-blue-600">{filteredHotelOrderItems.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-gray-600 text-sm mb-1">Total Laundry Orders (System)</p>
                            <p className="text-lg font-bold text-gray-800">{laundryOrders.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-gray-600 text-sm mb-1">Your Laundry Orders</p>
                            <p className="text-lg font-bold text-purple-600">{filteredLaundryOrders.length}</p>
                        </div>
                    </div>
                    <div className="mt-5 pt-5 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600">Total Combined Revenue from Your Work</p>
                                <p className="text-2xl font-bold text-green-700">
                                    Ksh {(totalHotelRevenue + totalLaundryRevenue).toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-medium">
                                Your Contribution
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error display if any */}
                {error && user && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.198 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <p className="text-yellow-700">{error}</p>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="mt-2 text-yellow-700 hover:text-yellow-800 text-sm font-medium"
                        >
                            Try refreshing the data
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;