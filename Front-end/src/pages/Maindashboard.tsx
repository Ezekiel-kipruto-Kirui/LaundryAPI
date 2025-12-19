import { useState, useEffect, useCallback } from "react";
import {
    LayoutDashboard,
    ShoppingCart,
    ClipboardList,
    Users,
    Building,
    BarChart3,
    DollarSign,
    TrendingUp,
    Bath,
    User
} from "lucide-react";
import { fetchApi } from "@/services/api";
import { Link } from "react-router-dom";
import { ROUTES } from "@/services/Routes";

// Interfaces
interface ProcessedData {
    totalBusinessRevenue: number;
    totalNetProfit: number;
    totalBusinessExpenses: number;
    hotelRevenue: number;
    hotelExpenses: number;
    hotelProfit: number;
    laundryRevenue: number;
    laundryExpenses: number;
    laundryProfit: number;
    currentMonthName: string;
}

// Helper functions
const toNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
};

const getCurrentMonthName = () => {
    return new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
};

const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
        fromDate: firstDay.toISOString().split('T')[0],
        toDate: lastDay.toISOString().split('T')[0],
        startTimestamp: firstDay.getTime(),
        endTimestamp: lastDay.getTime() + 86399999 // End of day
    };
};

const ensureArray = <T,>(data: any): T[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
        if (Array.isArray(data.results)) return data.results;
        if (Array.isArray(data.data)) return data.data;
        if (Array.isArray(data.items)) return data.items;
    }
    console.warn("Data is not an array:", data);
    return [];
};

// Check if date is within current month
const isInCurrentMonth = (dateString: string | undefined, monthRange: ReturnType<typeof getCurrentMonthRange>): boolean => {
    if (!dateString) return false;

    try {
        const date = new Date(dateString);
        const timestamp = date.getTime();
        return timestamp >= monthRange.startTimestamp && timestamp <= monthRange.endTimestamp;
    } catch (error) {
        console.warn('Error parsing date:', dateString, error);
        return false;
    }
};

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ProcessedData>({
        totalBusinessRevenue: 0,
        totalNetProfit: 0,
        totalBusinessExpenses: 0,
        hotelRevenue: 0,
        hotelExpenses: 0,
        hotelProfit: 0,
        laundryRevenue: 0,
        laundryExpenses: 0,
        laundryProfit: 0,
        currentMonthName: getCurrentMonthName()
    });

    const processData = useCallback((
        hotelOrders: any[],
        hotelExpenses: any[],
        laundryOrders: any[],
        laundryExpenses: any[]
    ): ProcessedData => {
        const monthRange = getCurrentMonthRange();

        // Ensure all inputs are arrays
        const safeHotelOrders = ensureArray<any>(hotelOrders);
        const safeHotelExpenses = ensureArray<any>(hotelExpenses);
        const safeLaundryOrders = ensureArray<any>(laundryOrders);
        const safeLaundryExpenses = ensureArray<any>(laundryExpenses);

        // Filter hotel orders for current month
        const filteredHotelOrders = safeHotelOrders.filter(order =>
            isInCurrentMonth(order?.created_at, monthRange)
        );

        // Calculate hotel revenue from filtered orders
        const hotelRevenue = filteredHotelOrders.reduce((sum, order) => {
            return sum + toNumber(order.total_amount || order.total_order_price || 0);
        }, 0);

        // Filter laundry orders for current month
        const filteredLaundryOrders = safeLaundryOrders.filter(order =>
            isInCurrentMonth(order?.created_at, monthRange)
        );

        // Calculate laundry revenue
        const laundryRevenue = filteredLaundryOrders.reduce((sum, order) => {
            return sum + toNumber(order.total_price || 0);
        }, 0);

        // Filter and calculate hotel expenses for current month
        const hotelExpensesTotal = safeHotelExpenses
            .filter(expense => isInCurrentMonth(expense?.date, monthRange))
            .reduce((sum, expense) => sum + toNumber(expense.amount || 0), 0);

        // Filter and calculate laundry expenses for current month
        const laundryExpensesTotal = safeLaundryExpenses
            .filter(expense => isInCurrentMonth(expense?.date, monthRange))
            .reduce((sum, expense) => sum + toNumber(expense.amount || 0), 0);

        // Calculate totals
        const totalBusinessExpenses = hotelExpensesTotal + laundryExpensesTotal;
        const hotelProfit = hotelRevenue - hotelExpensesTotal;
        const laundryProfit = laundryRevenue - laundryExpensesTotal;
        const totalNetProfit = hotelProfit + laundryProfit;
        const totalBusinessRevenue = hotelRevenue + laundryRevenue;

        return {
            totalBusinessRevenue,
            totalNetProfit,
            totalBusinessExpenses,
            hotelRevenue,
            hotelExpenses: hotelExpensesTotal,
            hotelProfit,
            laundryRevenue,
            laundryExpenses: laundryExpensesTotal,
            laundryProfit,
            currentMonthName: getCurrentMonthName()
        };
    }, []);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all data in parallel
            const [
                hotelOrdersResponse,
                hotelExpensesResponse,
                laundryOrdersResponse,
                laundryExpensesResponse
            ] = await Promise.allSettled([
                fetchApi<any>('orders/', { method: 'GET' }, 'hotel'),
                fetchApi<any>('Hotelexpense-records/', { method: 'GET' }, 'hotel'),
                fetchApi<any>('orders/', { method: 'GET' }, 'laundry'),
                fetchApi<any>('expense-records/', { method: 'GET' }, 'laundry')
            ]);

            // Extract data from responses
            const hotelOrders = hotelOrdersResponse.status === 'fulfilled'
                ? ensureArray<any>(hotelOrdersResponse.value)
                : [];

            const hotelExpenses = hotelExpensesResponse.status === 'fulfilled'
                ? ensureArray<any>(hotelExpensesResponse.value)
                : [];

            const laundryOrders = laundryOrdersResponse.status === 'fulfilled'
                ? ensureArray<any>(laundryOrdersResponse.value)
                : [];

            const laundryExpenses = laundryExpensesResponse.status === 'fulfilled'
                ? ensureArray<any>(laundryExpensesResponse.value)
                : [];

            // Process the data
            const processedData = processData(
                hotelOrders,
                hotelExpenses,
                laundryOrders,
                laundryExpenses
            );

            setData(processedData);

        } catch (err: any) {
            console.error("Dashboard fetch error:", err);
            setError(`Failed to fetch dashboard data: ${err.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    }, [processData]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount).replace('KES', 'Ksh ');
    };

    const quickActions = [
        {
            href: ROUTES.laundryCreateOrder,
            icon: ShoppingCart,
            title: "Create Laundry Order",
            description: "Add new laundry service",
            color: "blue" as const
        },
        {
            href: ROUTES.hotelOrders,
            icon: ShoppingCart,
            title: "Create Hotel Order",
            description: "Add new food order",
            color: "green" as const
        },
        {
            href: ROUTES.laundryOrders,
            icon: ClipboardList,
            title: "View Orders",
            description: "Manage all orders",
            color: "amber" as const
        },
        {
            href: ROUTES.hotelOrders,
            icon: ClipboardList,
            title: "Hotel Orders",
            description: "View hotel orders",
            color: "emerald" as const
        },
        {
            href: ROUTES.laundryCustomers,
            icon: Users,
            title: "Customers",
            description: "Manage customers",
            color: "purple" as const
        },
        {
            href: ROUTES.siteManagement,
            icon: User,
            title: "Users",
            description: "Manage user accounts",
            color: "red" as const
        }
    ];

    const colorClasses = {
        blue: {
            iconBg: "from-blue-100 to-blue-50",
            iconColor: "text-blue-600",
            hoverText: "group-hover:text-blue-600"
        },
        green: {
            iconBg: "from-green-100 to-green-50",
            iconColor: "text-green-600",
            hoverText: "group-hover:text-green-600"
        },
        amber: {
            iconBg: "from-amber-100 to-amber-50",
            iconColor: "text-amber-600",
            hoverText: "group-hover:text-amber-600"
        },
        emerald: {
            iconBg: "from-emerald-100 to-emerald-50",
            iconColor: "text-emerald-600",
            hoverText: "group-hover:text-emerald-600"
        },
        purple: {
            iconBg: "from-purple-100 to-purple-50",
            iconColor: "text-purple-600",
            hoverText: "group-hover:text-purple-600"
        },
        red: {
            iconBg: "from-red-100 to-red-50",
            iconColor: "text-red-600",
            hoverText: "group-hover:text-red-600"
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/80 p-4 md:p-6">
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-slate-600 mt-4 text-lg">Loading dashboard data...</p>
                        <p className="text-slate-400 text-sm">Fetching current month data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Performance Banner */}
                <div className="relative mb-8">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-2xl p-6 text-center">
                        <div className="flex items-center justify-center space-x-4">
                            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 shadow-lg">
                                <BarChart3 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">
                                    {data.currentMonthName} Performance Overview
                                </h2>
                                <p className="text-blue-100 text-sm">
                                    Current month business performance dashboard
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Total Revenue Card */}
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center shadow-lg">
                                    <DollarSign className="w-7 h-7 text-blue-600" />
                                </div>
                            </div>
                            <div className="ml-5 flex-1">
                                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                                    Total Revenue ({data.currentMonthName})
                                </p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">
                                    {formatCurrency(data.totalBusinessRevenue)}
                                </p>
                                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2 shadow-sm">
                                    📈 Current Month Combined Revenue
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Profit Card */}
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center shadow-lg">
                                    <TrendingUp className="w-7 h-7 text-green-600" />
                                </div>
                            </div>
                            <div className="ml-5 flex-1">
                                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                                    Total Profit ({data.currentMonthName})
                                </p>
                                <p className={`text-2xl font-bold ${data.totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'} mt-1`}>
                                    {formatCurrency(data.totalNetProfit)}
                                </p>
                                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${data.totalNetProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} mt-2 shadow-sm`}>
                                    {data.totalNetProfit >= 0 ? '💰 Profitable' : '📉 Loss'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Business Breakdown Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Laundry Business Card */}
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
                        <div className="flex items-center mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg flex items-center justify-center shadow-lg mr-3">
                                <Bath className="w-5 h-5 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900">Laundry Business</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg">
                                <span className="text-sm font-medium text-slate-700">Revenue</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(data.laundryRevenue)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg">
                                <span className="text-sm font-medium text-slate-700">Expenses</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(data.laundryExpenses)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                                <span className="text-sm font-medium text-slate-700">Net Profit</span>
                                <span className={`text-sm font-bold ${data.laundryProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(data.laundryProfit)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Hotel Business Card */}
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
                        <div className="flex items-center mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg flex items-center justify-center shadow-lg mr-3">
                                <Building className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900">Hotel Business</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg">
                                <span className="text-sm font-medium text-slate-700">Revenue</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(data.hotelRevenue)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg">
                                <span className="text-sm font-medium text-slate-700">Expenses</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(data.hotelExpenses)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                                <span className="text-sm font-medium text-slate-700">Net Profit</span>
                                <span className={`text-sm font-bold ${data.hotelProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(data.hotelProfit)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Section */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/80">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg mr-3">
                                <LayoutDashboard className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                        {quickActions.map((action, index) => (
                            <Link
                                key={index}
                                to={action.href}
                                className="flex items-center p-4 bg-slate-50/50 rounded-xl hover:bg-white transition-all duration-200 hover:shadow-md"
                            >
                                <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[action.color].iconBg} rounded-lg flex items-center justify-center shadow-lg mr-4`}>
                                    <action.icon className={`w-6 h-6 ${colorClasses[action.color].iconColor}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        {action.title}
                                    </p>
                                    <p className="text-sm text-slate-600 mt-1">{action.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mt-8 bg-red-50 text-red-700 rounded-xl border border-red-200 p-6">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="font-semibold text-red-700 mb-2">Error loading data</p>
                                <p className="text-red-600 mb-4">{error}</p>
                                <button
                                    onClick={fetchDashboardData}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                                >
                                    Retry Loading
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}