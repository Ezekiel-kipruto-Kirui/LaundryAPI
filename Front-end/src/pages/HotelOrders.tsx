import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/services/url";
import { getAccessToken, getUserData, isAdmin } from "@/utils/auth";
import { HotelOrderItem, FoodItem } from "@/services/types";
import { exportToCSV, exportToJSON } from "@/lib/exportUtils";

// Import Lucide React icons
import {
  Utensils,
  FileText,
  Package,
  DollarSign,
  Tag,
  Filter,
  RotateCw,
  Download,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  X,
  AlertTriangle,
  Check,
  FileJson,
  Calendar,
  UserCircle,
  FileSpreadsheet,
  CreditCard,
  Users,
  Eye,
  ShoppingBag
} from "lucide-react";

// Define the URLs
const ORDERS_URL = `${API_BASE_URL}/Hotel/orders/`;
const ORDER_ITEMS_URL = `${API_BASE_URL}/Hotel/order-items/`;
const FOOD_ITEMS_URL = `${API_BASE_URL}/Hotel/food-items/`;

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = getAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
};

interface DateRange {
  start_date: string;
  end_date: string;
}

interface CreateEditOrderItemData {
  food_item_id: number;
  quantity: number;
  price: string;
  name?: string;
  oncredit: boolean;
}

// API functions
const fetchOrders = async (pageNumber: number, dateFilter?: DateRange): Promise<{ items: any[], count: number }> => {
  let url = `${ORDERS_URL}?page=${pageNumber}`;

  if (dateFilter?.start_date) {
    url += `&start_date=${dateFilter.start_date}`;
  }
  if (dateFilter?.end_date) {
    url += `&end_date=${dateFilter.end_date}`;
  }

  const response = await fetch(url, { headers: getAuthHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.status}`);
  }

  const apiData = await response.json();

  // Handle pagination response from Django REST Framework
  if (apiData.results) {
    return {
      items: apiData.results,
      count: apiData.count || 0
    };
  } else if (apiData.data) {
    return {
      items: apiData.data,
      count: apiData.totalItems || apiData.data.length
    };
  } else if (Array.isArray(apiData)) {
    return { items: apiData, count: apiData.length };
  }

  return { items: [], count: 0 };
};

const fetchOrderItems = async (pageNumber: number, dateFilter?: DateRange): Promise<{ items: HotelOrderItem[], count: number }> => {
  let url = `${ORDER_ITEMS_URL}?page=${pageNumber}`;

  if (dateFilter?.start_date) {
    url += `&start_date=${dateFilter.start_date}`;
  }
  if (dateFilter?.end_date) {
    url += `&end_date=${dateFilter.end_date}`;
  }

  const response = await fetch(url, { headers: getAuthHeaders() });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      // If can't parse JSON, use default message
    }
    throw new Error(`Failed to fetch order items: ${errorMessage}`);
  }

  const apiData = await response.json();
  console.log('Order Items API Response:', apiData); // Debug log

  // Handle pagination response from Django REST Framework
  if (apiData.results) {
    return {
      items: apiData.results as HotelOrderItem[],
      count: apiData.count || 0
    };
  } else if (apiData.data) {
    return {
      items: apiData.data as HotelOrderItem[],
      count: apiData.totalItems || apiData.data.length
    };
  } else if (Array.isArray(apiData)) {
    return { items: apiData as HotelOrderItem[], count: apiData.length };
  }

  return { items: [], count: 0 };
};

const fetchFoodItems = async (): Promise<FoodItem[]> => {
  const response = await fetch(FOOD_ITEMS_URL, { headers: getAuthHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to fetch food items: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data.results || data.data || []);
};

const createOrUpdateOrderItem = async (
  data: CreateEditOrderItemData,
  itemId?: number
): Promise<HotelOrderItem> => {
  const url = itemId
    ? `${ORDER_ITEMS_URL}${itemId}/`
    : ORDER_ITEMS_URL;

  const method = itemId ? 'PUT' : 'POST';

  // Format the data properly for the API - IMPORTANT FIX
  const formattedData = {
    food_item_id: data.food_item_id,
    quantity: parseInt(data.quantity.toString()) || 1,
    price: parseFloat(data.price) || 0,
    name: data.oncredit ? (data.name || "") : null, // Send null instead of empty string
    oncredit: Boolean(data.oncredit)
  };

  console.log('Sending data to API:', formattedData);

  const response = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: JSON.stringify(formattedData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('API Error Response:', errorData); // Debug log
    const errorMessage = errorData.detail || errorData.message ||
      errorData.error || JSON.stringify(errorData) || `Failed to ${itemId ? 'update' : 'create'} order item`;
    throw new Error(errorMessage);
  }

  return response.json();
};

const deleteOrderItem = async (itemId: number): Promise<void> => {
  const response = await fetch(`${ORDER_ITEMS_URL}${itemId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete order item');
  }
};

export default function HotelOrderItems() {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<HotelOrderItem[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [currentItem, setCurrentItem] = useState<HotelOrderItem | null>(null);
  const [formData, setFormData] = useState<CreateEditOrderItemData>({
    food_item_id: 0,
    quantity: 1,
    price: "0.00",
    name: "",
    oncredit: false
  });
  const [dateRange, setDateRange] = useState<DateRange>({
    start_date: "",
    end_date: "",
  });
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Get user data for permissions
  const currentUser = getUserData();
  const isUserAdmin = isAdmin();

  // Check authentication on mount
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
    }
  }, []);

  // Fetch data function - FIXED
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const initialDateRange = {
        start_date: dateRange.start_date || firstDayOfMonth,
        end_date: dateRange.end_date || today
      };

      console.log('Fetching data with date range:', initialDateRange);

      // Fetch all data in parallel
      const [orderItemsData, foodItemsData] = await Promise.all([
        fetchOrderItems(page, initialDateRange),
        fetchFoodItems(),
      ]);

      setOrderItems(orderItemsData.items);
      setFoodItems(foodItemsData);

      // Calculate total pages based on count from API
      const itemsPerPage = 10; // This should match your PAGE_SIZE setting
      const totalCount = orderItemsData.count || orderItemsData.items.length;
      const calculatedTotalPages = Math.ceil(totalCount / itemsPerPage);

      console.log('Pagination data:', {
        totalCount,
        itemsPerPage,
        currentPage: page,
        calculatedTotalPages,
        items: orderItemsData.items.length
      });

      setTotalPages(calculatedTotalPages);
      setTotalItems(totalCount);

      // Also fetch orders if needed
      const ordersData = await fetchOrders(page, initialDateRange);
      setOrders(ordersData.items);

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, dateRange]);

  // Initialize and fetch data
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'food_item_id') {
      const foodItemId = parseInt(value);
      const selectedFoodItem = foodItems.find(item => item.id === foodItemId);

      setFormData({
        ...formData,
        [name]: foodItemId,
        price: selectedFoodItem?.price?.toString() || "0.00"
      });
    } else if (name === 'quantity') {
      setFormData({
        ...formData,
        [name]: parseInt(value) || 1
      });
    } else if (name === 'oncredit') {
      const isChecked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: isChecked
      });
      // If credit is disabled, clear the name field
      if (!isChecked) {
        setFormData(prev => ({
          ...prev,
          name: ""
        }));
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.food_item_id || formData.food_item_id === 0) {
      errors.food_item_id = "Please select a food item";
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.quantity = "Quantity must be greater than 0";
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = "Price must be greater than 0";
    }

    if (formData.oncredit && (!formData.name || formData.name.trim() === "")) {
      errors.name = "Customer name is required for credit orders";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open create dialog
  const handleCreateOrderItem = () => {
    setFormData({
      food_item_id: 0,
      quantity: 1,
      price: "0.00",
      name: "",
      oncredit: false
    });
    setCurrentItem(null);
    setIsEditing(false);
    setFormErrors({});
    setShowCreateEditModal(true);
  };

  // Open edit dialog
  const handleEditOrderItem = (item: HotelOrderItem) => {
    console.log('Editing item:', item); // Debug log

    setFormData({
      food_item_id: item.food_item?.id || 0,
      quantity: item.quantity || 1,
      price: item.price?.toString() || "0.00",
      name: item.name || "",
      oncredit: item.oncredit || false
    });
    setCurrentItem(item);
    setIsEditing(true);
    setFormErrors({});
    setShowCreateEditModal(true);
  };

  // Handle save (create/update)
  const handleSaveOrderItem = async () => {
    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    try {
      const result = await createOrUpdateOrderItem(
        formData,
        isEditing && currentItem ? currentItem.id : undefined
      );

      console.log('Save successful, result:', result); // Debug log
      toast.success(`Order item ${isEditing ? 'updated' : 'created'} successfully!`);
      fetchData();
      setShowCreateEditModal(false);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} order item: ${err.message}`);
    }
  };

  // Handle delete
  const handleDeleteOrderItem = async () => {
    if (!itemToDelete) return;

    try {
      await deleteOrderItem(itemToDelete);
      toast.success('Order item deleted successfully!');
      fetchData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  // Format price
  const formatPrice = (price: any): string => {
    if (price === null || price === undefined) return "0.00";

    const numPrice = typeof price === 'string' ? parseFloat(price) : Number(price);
    if (isNaN(numPrice)) return "0.00";

    return numPrice.toFixed(2);
  };

  // Get total price for an item
  const getTotalPrice = (item: HotelOrderItem): string => {
    if (item.total_price) {
      return formatPrice(item.total_price);
    }
    // Calculate from quantity and unit price
    const unitPrice = typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price) || 0;
    const total = (item.quantity || 0) * unitPrice;
    return total.toFixed(2);
  };

  // Format date and time
  const formatDateTime = (item: HotelOrderItem): string => {
    if (item.created_at) {
      try {
        const date = new Date(item.created_at);
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } catch (e) {
        console.error('Date parsing error:', e);
      }
    }

    return "N/A";
  };

  // Get served by user info - FIXED
  const getServedBy = (item: HotelOrderItem): string => {
    console.log('Getting served by for item:', item); // Debug log

    if (item.created_by) {
      if (typeof item.created_by === 'object' && item.created_by !== null) {
        const user = item.created_by as any;
        // Use email instead of username since User type doesn't have username
        return user.first_name || user.email || "Staff";
      } else if (typeof item.created_by === 'string') {
        return item.created_by;
      }
    }

    // Fallback: check if user info is nested in food_item
    if (item.food_item?.created_by) {
      const foodItemUser = item.food_item.created_by;
      if (typeof foodItemUser === 'object' && foodItemUser !== null) {
        return foodItemUser.first_name || foodItemUser.email || "Staff";
      }
    }

    return "Staff";
  };

  // Get food item name - FIXED
  const getFoodItemName = (item: HotelOrderItem): string => {
    console.log('Getting food item name for item:', item); // Debug log

    if (item.food_item) {
      if (typeof item.food_item === 'object' && item.food_item !== null) {
        // The food_item should directly have a name property
        return item.food_item.name || "N/A";
      }
    }

    // Alternative: check food_item_id if it's an object (fallback)
    if (item.food_item_id && typeof item.food_item_id === 'object') {
      const foodItemObj = item.food_item_id as any;
      return foodItemObj.name || "N/A";
    }

    return "N/A";
  };

  // Get food item category - FIXED
  const getFoodItemCategory = (item: HotelOrderItem): string => {
    if (item.food_item) {
      if (typeof item.food_item === 'object' && item.food_item !== null) {
        if (item.food_item.category && typeof item.food_item.category === 'object') {
          return item.food_item.category.name || "Uncategorized";
        }
      }
    }
    return "Uncategorized";
  };

  // Calculate summary statistics
  const calculateStatistics = () => {
    const totalValue = orderItems.reduce((sum, item) => sum + parseFloat(getTotalPrice(item)), 0);

    // Get credit orders
    const creditOrders = orderItems.filter(item => item.oncredit === true);
    const creditValue = creditOrders.reduce((sum, item) => sum + parseFloat(getTotalPrice(item)), 0);

    const totalOrders = orders.length;

    return {
      totalOrders,
      totalValue,
      creditOrdersCount: creditOrders.length,
      creditValue,
    };
  };

  const stats = calculateStatistics();

  // Get all credit orders grouped by customer
  const getCreditOrdersByCustomer = () => {
    const creditOrders = orderItems.filter(item => item.oncredit === true);

    // Group by customer name
    const grouped: Record<string, HotelOrderItem[]> = {};

    creditOrders.forEach(item => {
      const customerName = item.name || 'Unknown Customer';
      if (!grouped[customerName]) {
        grouped[customerName] = [];
      }
      grouped[customerName].push(item);
    });

    return grouped;
  };

  // Export functions
  const handleExportCSV = () => {
    const exportData = orderItems.map(item => ({
      'Order ID': item.order || 'N/A',
      'Date/Time': formatDateTime(item),
      'Served By': getServedBy(item),
      'Food Item': getFoodItemName(item),
      'Category': getFoodItemCategory(item),
      'Quantity': item.quantity || 0,
      'Unit Price': `Ksh ${formatPrice(item.price)}`,
      'Total': `Ksh ${getTotalPrice(item)}`,
      'On Credit': item.oncredit ? 'Yes' : 'No',
      'Customer Name': item.name || 'N/A',
    }));

    exportToCSV(exportData, 'hotel_order_items');
    setExportDropdownOpen(false);
  };

  const handleExportJSON = () => {
    exportToJSON(orderItems, 'hotel_order_items');
    setExportDropdownOpen(false);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      // fetchData will be called via useEffect dependency
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, page - 2);
      let endPage = Math.min(totalPages, page + 2);

      if (page <= 3) {
        endPage = maxVisiblePages;
      } else if (page >= totalPages - 2) {
        startPage = totalPages - maxVisiblePages + 1;
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
    }

    return pageNumbers;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 sm:p-6 lg:p-8">
      {/* Export and Filter Controls */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 mb-8 p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="w-full lg:w-auto">
            <div className="flex items-center mb-4">
              <Utensils className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">Hotel Order Items</h1>
            </div>

            {/* Date Filter Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1); // Reset to first page when filtering
                fetchData();
              }}
              className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
            >
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From:</label>
                  <input
                    type="date"
                    value={dateRange.start_date}
                    onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                    className="px-3 py-2 bg-transparent border-none focus:ring-0 focus:outline-none text-sm min-w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To:</label>
                  <input
                    type="date"
                    value={dateRange.end_date}
                    onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                    className="px-3 py-2 bg-transparent border-none focus:ring-0 focus:outline-none text-sm min-w-[140px]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-md hover:shadow-lg"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Apply Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        .toISOString()
                        .split('T')[0];
                      setDateRange({
                        start_date: firstDayOfMonth,
                        end_date: today
                      });
                      setPage(1);
                      fetchData();
                    }}
                    className="bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-800 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center shadow-md hover:shadow-lg"
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Reset
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-md hover:shadow-lg w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>

              {/* Export Dropdown Menu */}
              {exportDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <button
                      onClick={handleExportCSV}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-green-600 mr-2" />
                      Export as CSV
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors"
                    >
                      <FileJson className="h-4 w-4 text-green-600 mr-2" />
                      Export as JSON
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* View Credit Orders Button */}
            <button
              onClick={() => setShowCreditModal(true)}
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-md hover:shadow-lg w-full sm:w-auto"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Credit Orders
            </button>

            <button
              onClick={handleCreateOrderItem}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-md hover:shadow-lg w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Order Item
            </button>
          </div>
        </div>
      </div>

      {/* Summary Statistics - Role-based display */}
      <div className={`grid grid-cols-1 md:grid-cols-${isUserAdmin ? '3' : '2'} gap-6 mb-8`}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center mr-4 shadow-sm">
              <ShoppingBag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                All time orders
              </div>
            </div>
          </div>
        </div>

        {/* Only show total value for admins */}
        {isUserAdmin && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center mr-4 shadow-sm">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  Ksh {stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 mt-2">
                  Revenue Summary
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl flex items-center justify-center mr-4 shadow-sm">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Credit Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.creditOrdersCount}</p>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-2">
                Ksh {stats.creditValue.toFixed(2)} pending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading and Error States */}
      {loading ? (
        <div className="text-center p-12 bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-lg">Loading order items...</p>
          <p className="text-gray-400 text-sm mt-2">Fetching the latest data...</p>
        </div>
      ) : error ? (
        <div className="text-center p-8 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-red-700 mb-2">Error Loading Data</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium transition flex items-center mx-auto shadow-md hover:shadow-lg"
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Retry Loading Data
          </button>
        </div>
      ) : orderItems.length > 0 ? (
        /* Order Items Table */
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">All Order Items</h3>
                <p className="text-gray-600 mt-1">
                  Showing {Math.min((page - 1) * 10 + 1, totalItems)} to {Math.min(page * 10, totalItems)} of {totalItems} order items
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="pl-6 pr-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Date/Time
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <UserCircle className="h-4 w-4 mr-2" />
                      Served by
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 mr-2" />
                      Items
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Price
                    </div>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Credit
                    </div>
                  </th>
                  <th className="pr-6 pl-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {orderItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors duration-150">
                    {/* Date/Time Column */}
                    <td className="pl-6 pr-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          Order #{item.order || "N/A"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(item)}
                        </div>
                      </div>
                    </td>

                    {/* Served by Column */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mr-3 shadow-sm">
                          <span className="text-blue-600 font-medium text-xs">
                            {getServedBy(item).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900">
                          {getServedBy(item)}
                        </div>
                      </div>
                    </td>

                    {/* Items Column */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getFoodItemName(item)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getFoodItemCategory(item)}
                          </div>
                          {item.oncredit && item.name && (
                            <div className="text-xs text-purple-600 font-medium mt-1 flex items-center">
                              <CreditCard className="h-3 w-3 mr-1" />
                              Customer: {item.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Quantity Column */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium bg-gray-50 px-3 py-1.5 rounded-lg inline-block">
                        {item.quantity || 0}
                      </div>
                    </td>

                    {/* Price Column */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100/50 px-3 py-1.5 rounded-lg">
                        Ksh {getTotalPrice(item)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Unit: Ksh {formatPrice(item.price)}
                      </div>
                    </td>

                    {/* Credit Column */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.oncredit ? (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 text-xs font-semibold rounded-lg flex items-center border border-purple-200">
                            <CreditCard className="h-3 w-3 mr-1.5" />
                            On Credit
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-green-100 text-green-800 text-xs font-semibold rounded-lg border border-green-200">
                            Paid
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="pr-6 pl-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEditOrderItem(item)}
                          className="inline-flex items-center justify-center w-11 h-11 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all duration-200 border border-emerald-200 shadow-sm hover:shadow"
                          title="Edit Item"
                        >
                          <Edit className="h-5 w-5" />
                        </button>

                        <button
                          onClick={() => {
                            setItemToDelete(item.id);
                            setShowDeleteModal(true);
                          }}
                          className="inline-flex items-center justify-center w-11 h-11 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all duration-200 border border-red-200 shadow-sm hover:shadow"
                          title="Delete Item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Showing {Math.min((page - 1) * 10 + 1, totalItems)} to {Math.min(page * 10, totalItems)} of {totalItems} order items
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={page === 1}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-sm ${page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow'
                      }`}
                  >
                    First
                  </button>

                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-sm ${page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow'
                      }`}
                  >
                    <ChevronDown className="h-4 w-4 mr-2 rotate-90" />
                    Previous
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-sm ${page === pageNum
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-600 shadow-md'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow'
                        }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-sm ${page === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow'
                      }`}
                  >
                    Next
                    <ChevronDown className="h-4 w-4 ml-2 -rotate-90" />
                  </button>

                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={page === totalPages}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-sm ${page === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow'
                      }`}
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No Order Items State */
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Utensils className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Order Items Found</h3>
            <p className="text-gray-600 mb-6">
              You haven't created any order items yet. Start by adding your first order item.
            </p>
            <button
              onClick={handleCreateOrderItem}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3.5 rounded-xl font-semibold transition-all duration-200 inline-flex items-center shadow-lg hover:shadow-xl"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First Order Item
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Order Item' : 'Create New Order Item'}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {isEditing ? 'Update the order item details' : 'Fill in the order item details'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateEditModal(false);
                  setCurrentItem(null);
                  setIsEditing(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Food Item Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center">
                    <Package className="h-4 w-4 mr-1 text-blue-600" />
                    Food Item *
                  </span>
                </label>
                <select
                  name="food_item_id"
                  value={formData.food_item_id}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${formErrors.food_item_id ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                >
                  <option value={0}>Select a food item...</option>
                  {foodItems.map((foodItem) => (
                    <option key={foodItem.id} value={foodItem.id}>
                      {foodItem.name} ({foodItem.category?.name || 'Uncategorized'}) - Ksh {foodItem.price}
                    </option>
                  ))}
                </select>
                {formErrors.food_item_id && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {formErrors.food_item_id}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${formErrors.quantity ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  placeholder="Enter quantity"
                  min="1"
                />
                {formErrors.quantity && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {formErrors.quantity}
                  </p>
                )}
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (Ksh) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${formErrors.price ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                />
                {formErrors.price && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {formErrors.price}
                  </p>
                )}
              </div>

              {/* On Credit Checkbox */}
              <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  id="oncredit"
                  name="oncredit"
                  checked={formData.oncredit}
                  onChange={handleInputChange}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="oncredit" className="ml-3 block text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 text-purple-600" />
                    Sell on Credit
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Check if the customer will pay later</p>
                </label>
              </div>

              {/* Customer Name (shown only when on credit is checked) */}
              {formData.oncredit && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center">
                      <UserCircle className="h-4 w-4 mr-1 text-purple-600" />
                      Customer Name *
                    </span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    placeholder="Enter customer name"
                  />
                  {formErrors.name && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {formErrors.name}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateEditModal(false);
                  setCurrentItem(null);
                  setIsEditing(false);
                }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition-all duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSaveOrderItem}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl transition-all duration-200 flex items-center shadow-md hover:shadow-lg"
              >
                <Check className="h-4 w-4 mr-2" />
                {isEditing ? 'Update Order Item' : 'Create Order Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Orders Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <div className="mr-3 bg-gradient-to-br from-purple-100 to-purple-50 p-3 rounded-xl">
                    <CreditCard className="h-6 w-6 text-purple-600" />
                  </div>
                  Credit Orders Summary
                </h3>
                <p className="text-gray-600 mt-2">All items sold on credit to customers</p>
              </div>
              <button
                onClick={() => setShowCreditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4 shadow-sm border border-purple-200">
                    <CreditCard className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Credit Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.creditOrdersCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4 shadow-sm border border-purple-200">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Credit Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      Ksh {stats.creditValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {stats.creditOrdersCount > 0 ? (
              <div className="space-y-6">
                {Object.entries(getCreditOrdersByCustomer()).map(([customerName, items]) => {
                  const customerTotal = items.reduce((sum, item) => sum + parseFloat(getTotalPrice(item)), 0);
                  const itemCount = items.length;

                  return (
                    <div key={customerName} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-5 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center mr-3 border border-purple-200">
                                <Users className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 text-lg">{customerName}</h4>
                                <p className="text-gray-600 text-sm">
                                  {itemCount} item{itemCount !== 1 ? 's' : ''} • Total: Ksh {customerTotal.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 text-xs font-semibold rounded-lg border border-purple-200">
                              Credit Customer
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map((item) => (
                          <div key={item.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {getFoodItemName(item)} × {item.quantity || 0}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                  {formatDateTime(item)} • Served by: {getServedBy(item)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-purple-600">
                                  Ksh {getTotalPrice(item)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Unit: Ksh {item.price ? formatPrice(item.price) : '0.00'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-200">
                  <CreditCard className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">No Credit Orders</h4>
                <p className="text-gray-600">No items have been sold on credit yet.</p>
              </div>
            )}

            <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowCreditModal(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition-all duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Deletion</h3>
              <p className="text-gray-600">Are you sure you want to delete this order item? This action cannot be undone.</p>
            </div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition-all duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleDeleteOrderItem}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-xl transition-all duration-200 flex items-center shadow-md hover:shadow-lg"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}