import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/services/url";
import { getAccessToken, getUserData, isAdmin } from "@/utils/auth";
import { HotelOrderItem, FoodItem, HotelOrder, User } from "@/services/types";
import { exportToCSV, exportToJSON } from "@/lib/exportUtils";
import { ROUTES } from '@/services/Routes'

// Import Lucide React icons
import {
  Package,
  DollarSign,
  Filter,
  RotateCw,
  Download,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  X,
  AlertTriangle,
  FileJson,
  UserCircle,
  FileSpreadsheet,
  CreditCard,
  ListOrdered,
  Receipt,
  Save,
  ShoppingCart
} from "lucide-react";

// Define the URLs
const ORDERS_URL = `${API_BASE_URL}/Hotel/orders/`;
const ORDER_ITEMS_URL = `${API_BASE_URL}/Hotel/order-items/`;
const FOOD_ITEMS_URL = `${API_BASE_URL}/Hotel/food-items/`;

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = getAccessToken();
  if (!token) {
    throw new Error("No access token found");
  }
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
  food_item: number;
  quantity: number;
  price: string; // This is the TOTAL PRICE, not unit price
  name?: string;
  oncredit: boolean;
}

interface OrderFormData {
  items: CreateEditOrderItemData[];
  customer_name?: string;
  oncredit: boolean;
}

// Helper functions for safe property access
const getFoodItemId = (item: HotelOrderItem | FoodItem | number): number => {
  if (typeof item === 'number') return item;
  if ('id' in item) return item.id;
  return 0;
};

const getFoodItemObject = (item: HotelOrderItem): FoodItem | null => {
  if (item.food_item && typeof item.food_item === 'object') {
    return item.food_item as FoodItem;
  }
  return null;
};

// Interface for created_by object from server
interface CreatedByUser {
  email: string;
  first_name: string;
  last_name: string;
}

// Extended HotelOrderItem type with additional properties from server response
interface ExtendedHotelOrderItem extends Omit<HotelOrderItem, 'created_at' | 'total_price'> {
  _order?: HotelOrder;
  _created_by?: CreatedByUser; // Updated to use CreatedByUser interface
  _created_at?: string;
  total_price?: any; // From server response
  created_at?: any; // From server response
}

// API functions with authentication handling
const createOrder = async (): Promise<HotelOrder> => {
  const response = await fetch(ORDERS_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.detail || errorData.message ||
      errorData.error || JSON.stringify(errorData) || 'Failed to create order';
    throw new Error(errorMessage);
  }

  return response.json();
};

const fetchOrders = async (pageNumber: number, dateFilter?: DateRange): Promise<{
  items: HotelOrder[],
  count: number,
  flattenedOrderItems: ExtendedHotelOrderItem[]
}> => {
  let url = `${ORDERS_URL}?page=${pageNumber}`;

  if (dateFilter?.start_date) {
    url += `&start_date=${dateFilter.start_date}`;
  }
  if (dateFilter?.end_date) {
    url += `&end_date=${dateFilter.end_date}`;
  }

  const response = await fetch(url, { headers: getAuthHeaders() });

  if (response.status === 401) {
    window.location.href = ROUTES.login;
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.status}`);
  }

  const apiData = await response.json();

  let orders: HotelOrder[] = [];
  let totalCount = 0;

  // Handle pagination response from Django REST Framework
  if (apiData.results) {
    orders = apiData.results as HotelOrder[];
    totalCount = apiData.count || 0;
  } else if (apiData.data) {
    orders = apiData.data as HotelOrder[];
    totalCount = apiData.totalItems || apiData.data.length;
  } else if (Array.isArray(apiData)) {
    orders = apiData as HotelOrder[];
    totalCount = apiData.length;
  }

  // Flatten order items and add order info to each item
  const flattenedOrderItems: ExtendedHotelOrderItem[] = [];
  orders.forEach(order => {
    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach(item => {
        // Create a new item with order info attached
        const enrichedItem: ExtendedHotelOrderItem = {
          ...item,
          // Add order reference and created_by info
          _order: order,
          _created_by: order.created_by as CreatedByUser, // Cast to CreatedByUser interface
          _created_at: order.created_at
        };
        flattenedOrderItems.push(enrichedItem);
      });
    }
  });

  return {
    items: orders,
    count: totalCount,
    flattenedOrderItems: flattenedOrderItems
  };
};

const fetchFoodItems = async (): Promise<FoodItem[]> => {
  const response = await fetch(FOOD_ITEMS_URL, { headers: getAuthHeaders() });

  if (response.status === 401) {
    window.location.href = ROUTES.login;
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch food items: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data.results || data.data || []);
};

const createOrderItem = async (
  orderId: number,
  data: CreateEditOrderItemData
): Promise<HotelOrderItem> => {
  // Send total price directly (quantity * price entered by user)
  const formattedData = {
    order: orderId,
    food_item: data.food_item,
    quantity: parseInt(data.quantity.toString()) || 1,
    price: parseFloat(data.price) || 0, // This is TOTAL PRICE
    name: data.oncredit ? (data.name || "") : null,
    oncredit: Boolean(data.oncredit)
  };

  console.log('Creating order item with data:', formattedData);

  const response = await fetch(ORDER_ITEMS_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(formattedData),
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    const errorData = await response.json();
    console.error('API Error Response:', errorData);
    const errorMessage = errorData.detail || errorData.message ||
      errorData.error || JSON.stringify(errorData) || 'Failed to create order item';
    throw new Error(errorMessage);
  }

  return response.json();
};

const updateOrderItem = async (
  itemId: number,
  data: CreateEditOrderItemData
): Promise<HotelOrderItem> => {
  // Send total price directly (quantity * price entered by user)
  const formattedData = {
    food_item: data.food_item,
    quantity: parseInt(data.quantity.toString()) || 1,
    price: parseFloat(data.price) || 0, // This is TOTAL PRICE
    name: data.oncredit ? (data.name || "") : null,
    oncredit: Boolean(data.oncredit)
  };

  console.log('Updating order item with data:', formattedData);

  const response = await fetch(`${ORDER_ITEMS_URL}${itemId}/`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(formattedData),
  });

  if (response.status === 401) {
    window.location.href = ROUTES.login;
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    const errorData = await response.json();
    console.error('API Error Response:', errorData);
    const errorMessage = errorData.detail || errorData.message ||
      errorData.error || JSON.stringify(errorData) || 'Failed to update order item';
    throw new Error(errorMessage);
  }

  return response.json();
};

const deleteOrderItem = async (itemId: number): Promise<void> => {
  const response = await fetch(`${ORDER_ITEMS_URL}${itemId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    window.location.href = ROUTES.login;
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error('Failed to delete order item');
  }
};

const deleteOrder = async (orderId: number): Promise<void> => {
  const response = await fetch(`${ORDERS_URL}${orderId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error('Failed to delete order');
  }
};

// Fetch order summary
const fetchOrderSummary = async (dateFilter?: DateRange) => {
  let url = `${ORDERS_URL}summary/`;

  if (dateFilter?.start_date && dateFilter?.end_date) {
    url += `?start_date=${dateFilter.start_date}&end_date=${dateFilter.end_date}`;
  }

  const response = await fetch(url, { headers: getAuthHeaders() });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch order summary: ${response.status}`);
  }

  return response.json();
};

// Helper function to get creator name from order
const getCreatedByName = (item: ExtendedHotelOrderItem): string => {
  // Check if we have the created_by object with first_name and last_name
  if (item._created_by && typeof item._created_by === 'object') {
    const createdBy = item._created_by as CreatedByUser;
    if (createdBy.first_name && createdBy.last_name) {
      return `${createdBy.first_name} ${createdBy.last_name}`;
    } else if (createdBy.first_name) {
      return createdBy.first_name;
    } else if (createdBy.email) {
      // Fallback to email if no name is provided
      const emailParts = createdBy.email.split('@')[0];
      if (emailParts) {
        const nameParts = emailParts.split(/[\._-]/);
        if (nameParts.length > 0) {
          const firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
          return firstName;
        }
        return emailParts.charAt(0).toUpperCase() + emailParts.slice(1);
      }
    }
  }

  return "Unknown";
};

export default function HotelOrderItems() {
  const [orders, setOrders] = useState<HotelOrder[]>([]);
  const [orderItems, setOrderItems] = useState<ExtendedHotelOrderItem[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteOrderModal, setShowDeleteOrderModal] = useState(false);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [currentItem, setCurrentItem] = useState<ExtendedHotelOrderItem | null>(null);
  const [formData, setFormData] = useState<OrderFormData>({
    items: [{
      food_item: 0,
      quantity: 1,
      price: "0.00",
      oncredit: false
    }],
    customer_name: "",
    oncredit: false
  });
  const [dateRange, setDateRange] = useState<DateRange>({
    start_date: "",
    end_date: "",
  });
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState({
    total_orders: 0,
    total_revenue: 0,
    credit_orders_count: 0,
    credit_orders_value: 0
  });

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

  // Fetch data function
  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

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

      // Fetch orders (which includes order items) and food items in parallel
      const [ordersData, foodItemsData, summaryData] = await Promise.all([
        fetchOrders(page, initialDateRange),
        fetchFoodItems(),
        fetchOrderSummary(initialDateRange),
      ]);

      setOrders(ordersData.items);
      setOrderItems(ordersData.flattenedOrderItems);
      setFoodItems(foodItemsData);

      // Update summary with API data and calculate credit orders
      const creditOrders = ordersData.flattenedOrderItems.filter(item => item.oncredit);
      const creditValue = creditOrders.reduce((sum, item) => {
        // Use price directly from API (this is the total price entered by user)
        const price = item.price ? parseFloat(item.price.toString()) : 0;
        return sum + price;
      }, 0);

      setSummary({
        total_orders: summaryData.total_orders || 0,
        total_revenue: summaryData.total_revenue || 0,
        credit_orders_count: creditOrders.length,
        credit_orders_value: creditValue
      });

      // Calculate total pages based on count from API
      const itemsPerPage = 10;
      const totalCount = ordersData.count || ordersData.flattenedOrderItems.length;
      const calculatedTotalPages = Math.ceil(totalCount / itemsPerPage);

      setTotalPages(calculatedTotalPages);
      setTotalItems(totalCount);

    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (err.message.includes("Authentication required")) {
        window.location.href = "/login";
        return;
      }
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, dateRange]);

  // Initialize and fetch data
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add new item to form
  const addItemToForm = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        food_item: 0,
        quantity: 1,
        price: "0.00",
        oncredit: prev.oncredit,
        name: prev.oncredit ? prev.customer_name : ""
      }]
    }));
  };

  // Remove item from form
  const removeItemFromForm = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  // Handle form input changes for individual items
  const handleItemInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedItems = [...formData.items];

    if (name === 'food_item') {
      const foodItemId = parseInt(value);
      updatedItems[index] = {
        ...updatedItems[index],
        food_item: foodItemId,
        price: "0.00" // Reset price since food items don't have price anymore
      };
    } else if (name === 'quantity') {
      updatedItems[index] = {
        ...updatedItems[index],
        [name]: parseInt(value) || 1
      };
    } else if (name === 'oncredit') {
      const isChecked = (e.target as HTMLInputElement).checked;
      updatedItems[index] = {
        ...updatedItems[index],
        [name]: isChecked
      };
    } else {
      updatedItems[index] = {
        ...updatedItems[index],
        [name]: value
      };
    }

    setFormData(prev => ({
      ...prev,
      items: updatedItems
    }));

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  // Handle order-level changes
  const handleOrderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const isChecked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: isChecked,
        items: prev.items.map(item => ({
          ...item,
          oncredit: isChecked,
          name: isChecked ? prev.customer_name : ""
        }))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        items: prev.items.map(item => ({
          ...item,
          name: prev.oncredit ? value : ""
        }))
      }));
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

    // Validate each item
    formData.items.forEach((item, index) => {
      if (!item.food_item || item.food_item === 0) {
        errors[`item_${index}_food_item`] = "Please select a food item";
      }

      if (!item.quantity || item.quantity <= 0) {
        errors[`item_${index}_quantity`] = "Quantity must be greater than 0";
      }

      if (!item.price || parseFloat(item.price) <= 0) {
        errors[`item_${index}_price`] = "Price must be greater than 0";
      }
    });

    // Validate order-level fields
    if (formData.oncredit && (!formData.customer_name || formData.customer_name.trim() === "")) {
      errors.customer_name = "Customer name is required for credit orders";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open create dialog
  const handleCreateOrder = () => {
    // Reset form data without creating order yet
    setFormData({
      items: [{
        food_item: 0,
        quantity: 1,
        price: "0.00",
        oncredit: false
      }],
      customer_name: "",
      oncredit: false
    });
    setCurrentItem(null);
    setIsEditing(false);
    setFormErrors({});
    setShowCreateEditModal(true);
  };

  // Open edit dialog
  const handleEditOrderItem = (item: ExtendedHotelOrderItem) => {
    console.log('Editing item:', item);

    const foodItemId = getFoodItemId(item.food_item);

    setFormData({
      items: [{
        food_item: foodItemId,
        quantity: item.quantity || 1,
        price: item.price?.toString() || "0.00", // This is TOTAL PRICE from the item
        name: item.name || "",
        oncredit: item.oncredit || false
      }],
      customer_name: item.name || "",
      oncredit: item.oncredit || false
    });
    setCurrentItem(item);
    setIsEditing(true);
    setFormErrors({});
    setShowCreateEditModal(true);
  };

  // Handle save (create/update)
  const handleSaveOrder = async () => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    try {
      if (isEditing && currentItem) {
        // Update existing item - send total price directly
        const result = await updateOrderItem(currentItem.id, formData.items[0]);
        console.log('Update successful, result:', result);
        toast.success('Order item updated successfully!');
      } else {
        // Create new order first
        const newOrder = await createOrder();

        // Then add all items to the order
        // Send total price directly (user enters total price)
        const promises = formData.items.map(item =>
          createOrderItem(newOrder.id, {
            ...item,
            price: item.price, // This is TOTAL PRICE (user entered)
            quantity: item.quantity, // This is quantity
            name: formData.oncredit ? formData.customer_name : ""
          })
        );

        await Promise.all(promises);
        console.log('Create successful for all items');
        toast.success(`Order created successfully with ${formData.items.length} item(s)!`);
      }

      fetchData();
      setShowCreateEditModal(false);
      setCurrentItem(null);
    } catch (err: any) {
      console.error('Save error:', err);
      if (err.message.includes("Authentication required")) {
        window.location.href = "/login";
        return;
      }
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} order: ${err.message}`);
    }
  };

  // Handle delete order item
  const handleDeleteOrderItem = async () => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (!itemToDelete) return;

    try {
      await deleteOrderItem(itemToDelete);
      toast.success('Order item deleted successfully!');
      fetchData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err: any) {
      if (err.message.includes("Authentication required")) {
        window.location.href = "/login";
        return;
      }
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  // Handle delete entire order
  const handleDeleteOrder = async () => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (!orderToDelete) return;

    try {
      await deleteOrder(orderToDelete);
      toast.success('Order deleted successfully!');
      fetchData();
      setShowDeleteOrderModal(false);
      setOrderToDelete(null);
    } catch (err: any) {
      if (err.message.includes("Authentication required")) {
        window.location.href = "/login";
        return;
      }
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

  // Get total price for an item - Use price directly from API
  const getTotalPrice = (item: ExtendedHotelOrderItem): string => {
    // Use the price provided by API (this is the total price entered by user)
    if (item.price !== undefined && item.price !== null) {
      return formatPrice(item.price);
    }
    return "0.00";
  };

  // Format date and time
  const formatDateTime = (item: ExtendedHotelOrderItem): string => {
    // Use created_at from the item itself first
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

    // Fall back to order's created_at
    if (item._created_at) {
      try {
        const date = new Date(item._created_at);
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

  // Get food item name - Use food_item_name from API response
  const getFoodItemName = (item: ExtendedHotelOrderItem): string => {
    // Use food_item_name from API response
    if (item.food_item_name) {
      return item.food_item_name;
    }

    // Fallback to the nested food_item object name property
    const foodItem = getFoodItemObject(item);
    if (foodItem?.name) {
      return foodItem.name;
    }

    return "N/A";
  };

  // Get food item category
  const getFoodItemCategory = (item: ExtendedHotelOrderItem): string => {
    // Check if we have a food_item object with category
    const foodItem = getFoodItemObject(item);
    if (foodItem?.category) {
      if (typeof foodItem.category === 'object') {
        return foodItem.category.name || "Uncategorized";
      }
      return String(foodItem.category) || "Uncategorized";
    }

    // If no category information is available, return a default
    return "Uncategorized";
  };

  // Export functions
  const handleExportCSV = () => {
    const exportData = orderItems.map(item => ({
      'Order ID': typeof item.order === 'object' ? (item.order as any)?.id || 'N/A' : item.order || 'N/A',
      'Date/Time': formatDateTime(item),
      'Created By': getCreatedByName(item),
      'Food Item': getFoodItemName(item),
      'Category': getFoodItemCategory(item),
      'Quantity': item.quantity || 0,
      'Total Price': `Ksh ${formatPrice(item.price)}`,
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <div className="mr-3 bg-blue-100 p-2 sm:p-3 rounded-xl">
              <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            </div>
            Order Management
          </h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Manage and track all customer orders</p>
        </div>

        {/* Export and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Date Filter Form */}
          <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                <div className="flex items-center gap-1 sm:gap-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">From:</label>
                  <input
                    type="date"
                    name="start_date"
                    value={dateRange.start_date}
                    onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                    className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                  />
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">To:</label>
                  <input
                    type="date"
                    name="end_date"
                    value={dateRange.end_date}
                    onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                    className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                  />
                </div>
              </div>
              <div className="flex gap-1 sm:gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  onClick={() => {
                    setPage(1);
                    fetchData();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition duration-200 flex items-center justify-center flex-1 sm:flex-none"
                >
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Filter
                </button>
                <button
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
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center flex-1 sm:flex-none"
                >
                  <RotateCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Export and Create Order Buttons */}
          <div className="flex gap-2 sm:gap-3">
            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition duration-200 flex items-center h-9 sm:h-10"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Export
                <ChevronDown className="h-2 w-2 sm:h-3 sm:w-3 ml-1" />
              </button>

              {/* Export Dropdown Menu */}
              {exportDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 sm:mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <div className="p-2">
                    <button
                      onClick={handleExportCSV}
                      className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors"
                    >
                      <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 mr-2" />
                      Export as CSV
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors"
                    >
                      <FileJson className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 mr-2" />
                      Export as JSON
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Order Button */}
            <button
              onClick={handleCreateOrder}
              className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 border border-transparent rounded-lg shadow-sm text-xs sm:text-sm font-medium text-white bg-blue-500 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-9 sm:h-10"
            >
              <ShoppingCart className="-ml-0.5 mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Create Order
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Only for admins */}
      {isUserAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {/* Total Orders Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 sm:mr-4">
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.total_orders}</p>
              </div>
            </div>
          </div>

          {/* Total Revenue Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 sm:mr-4">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  Ksh {summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Credit Orders Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 sm:mr-4">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Credit Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{summary.credit_orders_count}</p>
                <div className="text-xs text-gray-500 mt-0.5 sm:mt-1">
                  Ksh {formatPrice(summary.credit_orders_value)} pending
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading and Error States */}
      {loading ? (
        <div className="text-center p-6 sm:p-12 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-3 sm:mt-4 text-sm sm:text-lg">Loading order items...</p>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">Fetching the latest data...</p>
        </div>
      ) : error ? (
        <div className="text-center p-4 sm:p-8 bg-gradient-to-br from-red-50 to-red-100 rounded-xl sm:rounded-2xl border border-red-200 shadow-lg">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-red-700 mb-1 sm:mb-2">Error Loading Data</h3>
          <p className="text-red-600 text-sm sm:text-base mb-4 sm:mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-medium transition flex items-center mx-auto shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            <RotateCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Retry Loading Data
          </button>
        </div>
      ) : orderItems.length > 0 ? (
        /* Order Items Table */
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-2 sm:p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="pl-4 pr-2 sm:pl-6 sm:pr-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Details
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  {isUserAdmin && <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>}
                  <th className="pr-4 pl-2 sm:pr-6 sm:pl-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {orderItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {/* Order Details */}
                    <td className="pl-4 pr-2 sm:pl-6 sm:pr-4 py-3 sm:py-4 whitespace-nowrap">
                      <div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(item)}
                        </div>
                      </div>
                    </td>

                    {/* Created By - Shows first name and last name from backend */}
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getCreatedByName(item)}
                      </div>
                    </td>

                    {/* Items */}
                    <td className="px-2 sm:px-4 py-3 sm:py-4">
                      <div className="text-sm text-gray-900 font-medium">
                        {getFoodItemName(item)}
                      </div>
                      {/* <div className="text-xs text-gray-500">
                        {getFoodItemCategory(item)}
                      </div> */}
                      {item.oncredit && item.name && (
                        <div className="text-xs text-purple-600 font-medium mt-0.5 sm:mt-1">
                          Credit: {item.name}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-2 sm:px-4 py-3 sm:py-4">
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-2 py-1 sm:px-3 sm:py-1 rounded-lg inline-block">
                        {item.quantity || 0}
                      </div>
                    </td>

                    {/* Total - This is the price entered by user (not calculated) */}
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">
                        Ksh {getTotalPrice(item)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="pr-4 pl-2 sm:pr-6 sm:pl-4 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleEditOrderItem(item)}
                          className="p-1 sm:p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit Order Item"
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>

                        {/* Delete Button - Only for admins */}
                        {isUserAdmin && (
                          <button
                            onClick={() => {
                              setItemToDelete(item.id);
                              setShowDeleteModal(true);
                            }}
                            className="p-1 sm:p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Order Item"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
                <div className="text-xs sm:text-sm text-gray-700">
                  Showing {Math.min((page - 1) * 10 + 1, totalItems)} to {Math.min(page * 10, totalItems)} of {totalItems} items
                </div>
                <div className="flex space-x-1 sm:space-x-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={page === 1}
                    className={`px-2 py-1 sm:px-3 sm:py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-200 ${page === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    First
                  </button>

                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className={`px-2 py-1 sm:px-3 sm:py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-200 ${page === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Prev
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-2 py-1 sm:px-3 sm:py-2 border rounded-lg text-xs sm:text-sm font-medium transition duration-200 ${page === pageNum
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className={`px-2 py-1 sm:px-3 sm:py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-200 ${page === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Next
                  </button>

                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={page === totalPages}
                    className={`px-2 py-1 sm:px-3 sm:py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-200 ${page === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No Orders State */
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl sm:rounded-2xl p-6 sm:p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Receipt className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">No Orders Found</h3>
            <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6">
              {dateRange.start_date && dateRange.end_date
                ? `No orders found between ${dateRange.start_date} and ${dateRange.end_date}.`
                : "You haven't received any orders yet. Orders will appear here once customers start ordering."}
            </p>
            {dateRange.start_date && dateRange.end_date && (
              <button
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
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold transition duration-200 inline-flex items-center text-sm sm:text-base"
              >
                <ListOrdered className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                View All Orders
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Order Modal */}
      {showCreateEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl transform transition-all duration-300 scale-100 my-4 sm:my-8">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                  {isEditing ? 'Edit Order Item' : 'Create New Order'}
                </h3>
                <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">
                  {isEditing
                    ? 'Update the order item details'
                    : 'Add multiple items to create a complete order'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateEditModal(false);
                  setCurrentItem(null);
                  setIsEditing(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition p-1 sm:p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Order Items List */}
            <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
              {formData.items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-5 bg-gray-50">
                  <div className="flex justify-between items-center mb-3 sm:mb-4">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Item {index + 1}</h4>
                    {formData.items.length > 1 && !isEditing && (
                      <button
                        type="button"
                        onClick={() => removeItemFromForm(index)}
                        className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium flex items-center"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* Food Item Selection */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        <span className="flex items-center">
                          <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 text-blue-600" />
                          Food Item *
                        </span>
                      </label>
                      <select
                        name="food_item"
                        value={item.food_item}
                        onChange={(e) => handleItemInputChange(index, e)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${formErrors[`item_${index}_food_item`] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                      >
                        <option value={0}>Select a food item...</option>
                        {foodItems.map((foodItem) => (
                          <option key={foodItem.id} value={foodItem.id}>
                            {foodItem.name}
                            {foodItem.quantity && ` (Stock: ${foodItem.quantity})`}
                          </option>
                        ))}
                      </select>
                      {formErrors[`item_${index}_food_item`] && (
                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                          <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          {formErrors[`item_${index}_food_item`]}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        name="quantity"
                        value={item.quantity}
                        onChange={(e) => handleItemInputChange(index, e)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${formErrors[`item_${index}_quantity`] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        placeholder="Enter quantity"
                        min="1"
                      />
                      {formErrors[`item_${index}_quantity`] && (
                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                          <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          {formErrors[`item_${index}_quantity`]}
                        </p>
                      )}
                    </div>

                    {/* Price - This is TOTAL PRICE, not unit price */}
                    <div className="md:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        <span className="flex items-center">
                          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 text-green-600" />
                          Total Price (Ksh) *
                        </span>
                        <span className="text-gray-500 text-xs">Enter the total price for this item</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={item.price}
                        onChange={(e) => handleItemInputChange(index, e)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${formErrors[`item_${index}_price`] ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        placeholder="Enter total price"
                        min="0"
                        step="0.01"
                      />
                      {formErrors[`item_${index}_price`] && (
                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                          <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          {formErrors[`item_${index}_price`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add More Items Button (only for new orders) */}
              {!isEditing && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition duration-200"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Add Another Item
                  </button>
                </div>
              )}
            </div>

            {/* On Credit Checkbox */}
            <div className="flex items-start p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl border border-gray-200 mb-4 sm:mb-6">
              <input
                type="checkbox"
                id="oncredit"
                name="oncredit"
                checked={formData.oncredit}
                onChange={handleOrderInputChange}
                className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
              />
              <label htmlFor="oncredit" className="ml-2 sm:ml-3 block text-sm font-medium text-gray-900">
                <div className="flex items-center">
                  <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-purple-600" />
                  Sell on Credit
                </div>
                <p className="text-gray-500 text-xs mt-0.5 sm:mt-1">Check if the customer will pay later</p>
              </label>
            </div>

            {/* Customer Name (shown only when on credit is checked) */}
            {formData.oncredit && (
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <span className="flex items-center">
                    <UserCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 text-purple-600" />
                    Customer Name *
                  </span>
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name || ''}
                  onChange={handleOrderInputChange}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${formErrors.customer_name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  placeholder="Enter customer name"
                />
                {formErrors.customer_name && (
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    {formErrors.customer_name}
                  </p>
                )}
              </div>
            )}

            {/* Order Total - Display sum of all item prices */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base font-medium text-blue-900">
                  Order Total:
                </span>
                <span className="text-lg sm:text-xl font-bold text-blue-700">
                  Ksh {formatPrice(formData.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0))}
                </span>
              </div>
            </div>

            <div className="flex justify-center space-x-2 sm:space-x-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateEditModal(false);
                  setCurrentItem(null);
                  setIsEditing(false);
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg sm:rounded-xl transition-all duration-200 flex items-center text-sm sm:text-base"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSaveOrder}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 flex items-center shadow-md hover:shadow-lg text-sm sm:text-base"
              >
                {isEditing ? (
                  <>
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Update Order Item
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Create Order ({formData.items.length} items)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="text-center mb-3 sm:mb-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">Confirm Deletion</h3>
              <p className="text-gray-600 text-sm sm:text-base">Are you sure you want to delete this order item? This action cannot be undone.</p>
            </div>
            <div className="flex justify-center space-x-2 sm:space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
                className="px-4 sm:px-6 py-1.5 sm:py-2.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg sm:rounded-xl transition-all duration-200 text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrderItem}
                className="px-4 sm:px-6 py-1.5 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 text-sm sm:text-base"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {showDeleteOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="text-center mb-3 sm:mb-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">Confirm Order Deletion</h3>
              <p className="text-gray-600 text-sm sm:text-base">Are you sure you want to delete this entire order? All items in this order will also be deleted. This action cannot be undone.</p>
            </div>
            <div className="flex justify-center space-x-2 sm:space-x-4">
              <button
                onClick={() => {
                  setShowDeleteOrderModal(false);
                  setOrderToDelete(null);
                }}
                className="px-4 sm:px-6 py-1.5 sm:py-2.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg sm:rounded-xl transition-all duration-200 text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrder}
                className="px-4 sm:px-6 py-1.5 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 text-sm sm:text-base"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
