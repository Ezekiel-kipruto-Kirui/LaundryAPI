import { useState, useEffect, useCallback } from "react";
import {
    LayoutDashboard,
    ShoppingCart,
    ClipboardList,
    Users,
    Receipt,
    Building,
    Utensils,
    BarChart3,
    DollarSign,
    TrendingUp,
    Bath,
    User,
    Settings
} from "lucide-react";
import { fetchApi } from "@/services/api";
import { Link } from "react-router-dom";
import { ROUTES } from "@/services/Routes";
import {
    HotelOrderItem,
    HotelExpenseRecord,
    Order,
    ExpenseRecord
} from "@/services/types";

// Interfaces
interface LaundryOrder extends Order {
    // Extending Order interface for laundry
}

interface LaundryExpense extends ExpenseRecord {
    // Extending ExpenseRecord interface for laundry
}

interface ProcessedData {
    // Summary Stats
    totalBusinessRevenue: number;
    totalNetProfit: number;
    totalBusinessExpenses: number;

    // Hotel Stats
    hotelRevenue: number;
    hotelExpenses: number;
    hotelProfit: number;

    // Laundry Stats
    laundryRevenue: number;
    laundryExpenses: number;
    laundryProfit: number;

    currentMonthName: string;
}

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ProcessedData | null>(null);
    

    const getCurrentMonthName = () => {
        return new Date().toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    };

    const getCurrentMonthRange = useCallback(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        return {
            fromDate: firstDay.toISOString().split('T')[0],
            toDate: lastDay.toISOString().split('T')[0]
        };
    }, []);

    const processData = useCallback((
        hotelOrderItems: HotelOrderItem[],
        hotelExpenses: HotelExpenseRecord[],
        laundryOrders: LaundryOrder[],
        laundryExpenses: LaundryExpense[]
    ): ProcessedData => {
        const { fromDate, toDate } = getCurrentMonthRange();

        console.log("Processing data for date range:", { fromDate, toDate });
        console.log("Hotel orders count:", hotelOrderItems.length);
        console.log("Hotel expenses count:", hotelExpenses.length);
        console.log("Laundry orders count:", laundryOrders.length);
        console.log("Laundry expenses count:", laundryExpenses.length);

        // Filter data for current month only
        const filteredHotelOrders = hotelOrderItems.filter(item => {
            const itemDate = new Date(item.created_at);
            const filterFrom = new Date(fromDate);
            const filterTo = new Date(toDate);
            return itemDate >= filterFrom && itemDate <= filterTo;
        });

        const filteredLaundryOrders = laundryOrders.filter(order => {
            const orderDate = new Date(order.created_at);
            const filterFrom = new Date(fromDate);
            const filterTo = new Date(toDate);
            return orderDate >= filterFrom && orderDate <= filterTo;
        });

        // Calculate hotel revenue
        const hotelRevenue = filteredHotelOrders.reduce((sum, item) =>
            sum + (item.total_price ? parseFloat(item.total_price.toString()) : 0), 0
        );

        // Calculate laundry revenue
        const laundryRevenue = filteredLaundryOrders.reduce((sum, order) =>
            sum + parseFloat(order.total_price), 0
        );

        // Calculate hotel expenses for current month
        const hotelExpensesTotal = hotelExpenses
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                const filterFrom = new Date(fromDate);
                const filterTo = new Date(toDate);
                return expenseDate >= filterFrom && expenseDate <= filterTo;
            })
            .reduce((sum, expense) => sum + expense.amount, 0);

        // Calculate laundry expenses for current month
        const laundryExpensesTotal = laundryExpenses
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                const filterFrom = new Date(fromDate);
                const filterTo = new Date(toDate);
                return expenseDate >= filterFrom && expenseDate <= filterTo;
            })
            .reduce((sum, expense) => sum + expense.amount, 0);

        // Calculate totals
        const totalBusinessExpenses = hotelExpensesTotal + laundryExpensesTotal;
        const hotelProfit = hotelRevenue - hotelExpensesTotal;
        const laundryProfit = laundryRevenue - laundryExpensesTotal;
        const totalNetProfit = hotelProfit + laundryProfit;
        const totalBusinessRevenue = hotelRevenue + laundryRevenue;

        const result = {
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

        console.log("Processed result:", result);
        return result;
    }, [getCurrentMonthRange]);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        

        try {
            // Fetch all data in parallel with better error handling
            const hotelOrderItemsPromise: Promise<HotelOrderItem[]> =
                fetchApi<HotelOrderItem[]>('order-items/', { method: 'GET' }, 'hotel').catch(err => {
                    console.warn("Failed to fetch hotel order items:", err.message);
                    return [] as HotelOrderItem[];
                });

            const hotelExpensesPromise: Promise<HotelExpenseRecord[]> =
                fetchApi<HotelExpenseRecord[]>('expense-records/', { method: 'GET' }, 'hotel').catch(err => {
                    console.warn("Failed to fetch hotel expenses:", err.message);
                    return [] as HotelExpenseRecord[];
                });

            const laundryOrdersPromise: Promise<Order[]> =
                fetchApi<Order[]>('orders/', { method: 'GET' }, 'laundry').catch(err => {
                    console.warn("Failed to fetch laundry orders:", err.message);
                    return [] as Order[];
                });

            const laundryExpensesPromise: Promise<ExpenseRecord[]> =
                fetchApi<ExpenseRecord[]>('expense-records/', { method: 'GET' }, 'laundry').catch(err => {
                    console.warn("Failed to fetch laundry expenses:", err.message);
                    return [] as ExpenseRecord[];
                });

            // Use Promise.allSettled to handle individual failures
            const [hotelOrderItemsResult, hotelExpensesResult, laundryOrdersResult, laundryExpensesResult] =
                await Promise.allSettled([
                    hotelOrderItemsPromise,
                    hotelExpensesPromise,
                    laundryOrdersPromise,
                    laundryExpensesPromise
                ]);

            // Extract data from results
            const hotelOrderItems = hotelOrderItemsResult.status === 'fulfilled' ? hotelOrderItemsResult.value : [];
            const hotelExpenses = hotelExpensesResult.status === 'fulfilled' ? hotelExpensesResult.value : [];
            const laundryOrders = laundryOrdersResult.status === 'fulfilled' ? laundryOrdersResult.value : [];
            const laundryExpenses = laundryExpensesResult.status === 'fulfilled' ? laundryExpensesResult.value : [];

            // Log debug info
            const debugData = {
                hotelOrderItems: {
                    count: hotelOrderItems.length,
                    firstItem: hotelOrderItems[0]
                },
                hotelExpenses: {
                    count: hotelExpenses.length,
                    firstItem: hotelExpenses[0]
                },
                laundryOrders: {
                    count: laundryOrders.length,
                    firstItem: laundryOrders[0]
                },
                laundryExpenses: {
                    count: laundryExpenses.length,
                    firstItem: laundryExpenses[0]
                },
                fetchResults: {
                    hotelOrderItems: hotelOrderItemsResult.status,
                    hotelExpenses: hotelExpensesResult.status,
                    laundryOrders: laundryOrdersResult.status,
                    laundryExpenses: laundryExpensesResult.status
                }
            };

           
            console.log("Debug data:", debugData);

            // Process the data even if some requests failed
            const processedData = processData(
                hotelOrderItems,
                hotelExpenses,
                laundryOrders as LaundryOrder[],
                laundryExpenses as LaundryExpense[]
            );
            setData(processedData);

            // Check if all requests failed
            const allFailed = [
                hotelOrderItemsResult,
                hotelExpensesResult,
                laundryOrdersResult,
                laundryExpensesResult
            ].every(r => r.status === 'rejected');

            if (allFailed) {
                throw new Error("All API requests failed. Please check your internet connection and API server.");
            }

        } catch (err: any) {
            console.error("Dashboard fetch error:", err);
            setError(`Failed to fetch dashboard data: ${err.message || 'Unknown error'}`);

            // Set default data structure to prevent blank page
            setData({
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
            color: "blue"
        },
        {
            href: ROUTES.hotelOrders,
            icon: ShoppingCart,
            title: "Create Hotel Order",
            description: "Add new food order",
            color: "green"
        },
        {
            href: ROUTES.laundryOrders,
            icon: ClipboardList,
            title: "View Orders",
            description: "Manage all orders",
            color: "amber"
        },
        {
            href: ROUTES.hotelOrders,
            icon: ClipboardList,
            title: "Hotel Orders",
            description: "View hotel orders",
            color: "emerald"
        },
        {
            href: ROUTES.laundryCustomers,
            icon: Users,
            title: "Customers",
            description: "Manage customers",
            color: "purple"
        },
        {
            href: ROUTES.siteManagement,
            icon: User,
            title: "Users",
            description: "Manage user accounts",
            color: "red"
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
                        <p className="text-slate-400 text-sm mt-2">Fetching business statistics...</p>
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
                                    {data?.currentMonthName || getCurrentMonthName()} Performance Overview
                                </h2>
                                <p className="text-blue-100 text-sm">
                                    Combined business performance dashboard
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Total Revenue Card */}
                    <div className="group relative">
                        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center shadow-lg">
                                        <DollarSign className="w-7 h-7 text-blue-600" />
                                    </div>
                                </div>
                                <div className="ml-5 flex-1">
                                    <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Total Revenue</p>
                                    <p className="text-2xl font-bold text-slate-900 mt-1">
                                        {formatCurrency(data?.totalBusinessRevenue || 0)}
                                    </p>
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2 shadow-sm">
                                        📈 Combined Business Revenue
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Profit Card */}
                    <div className="group relative">
                        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center shadow-lg">
                                        <TrendingUp className="w-7 h-7 text-green-600" />
                                    </div>
                                </div>
                                <div className="ml-5 flex-1">
                                    <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Total Profit</p>
                                    <p className={`text-2xl font-bold ${(data?.totalNetProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} mt-1`}>
                                        {formatCurrency(data?.totalNetProfit || 0)}
                                    </p>
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(data?.totalNetProfit || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} mt-2 shadow-sm`}>
                                        {(data?.totalNetProfit || 0) >= 0 ? '💰 Profitable' : '📉 Loss'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Business Breakdown Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Laundry Business Card */}
                    <div className="group relative">
                        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg flex items-center justify-center shadow-lg mr-3">
                                    <Bath className="w-5 h-5 text-amber-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900">Laundry Business</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-slate-700">Revenue</span>
                                    <span className="text-sm font-semibold text-slate-900">
                                        {formatCurrency(data?.laundryRevenue || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-slate-700">Expenses</span>
                                    <span className="text-sm font-semibold text-slate-900">
                                        {formatCurrency(data?.laundryExpenses || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-md">
                                    <span className="text-sm font-medium text-slate-700">Net Profit</span>
                                    <span className={`text-sm font-bold ${(data?.laundryProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(data?.laundryProfit || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hotel Business Card */}
                    <div className="group relative">
                        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg flex items-center justify-center shadow-lg mr-3">
                                    <Building className="w-5 h-5 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900">Hotel Business</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-slate-700">Revenue</span>
                                    <span className="text-sm font-semibold text-slate-900">
                                        {formatCurrency(data?.hotelRevenue || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-slate-50/80 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-slate-700">Expenses</span>
                                    <span className="text-sm font-semibold text-slate-900">
                                        {formatCurrency(data?.hotelExpenses || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg shadow-md">
                                    <span className="text-sm font-medium text-slate-700">Net Profit</span>
                                    <span className={`text-sm font-bold ${(data?.hotelProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(data?.hotelProfit || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Section */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/80 shadow-sm">
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
                                className="group relative flex items-center p-4 bg-slate-50/50 rounded-xl shadow-md hover:shadow-xl hover:bg-white transition-all duration-200"
                            >
                                <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[action.color].iconBg} rounded-lg flex items-center justify-center shadow-lg mr-4 group-hover:scale-110 transition-transform duration-200`}>
                                    <action.icon className={`w-6 h-6 ${colorClasses[action.color].iconColor}`} />
                                </div>
                                <div>
                                    <p className={`font-semibold text-slate-900 ${colorClasses[action.color].hoverText} transition-colors duration-200`}>
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
                    <div className="mt-8 bg-red-50 text-red-700 rounded-xl border border-red-200 p-6 shadow-lg">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="font-semibold text-red-700 mb-2">Error loading data</p>
                                <p className="text-red-600 mb-4">{error}</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setError(null);
                                            fetchDashboardData();
                                        }}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                                    >
                                        Retry Loading
                                    </button>
                                    <button
                                        onClick={() => setError(null)}
                                        className="px-4 py-2 bg-transparent text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium text-sm"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                
            </div>
        </div>
    );
}