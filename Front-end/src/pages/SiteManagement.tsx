import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  User as UserIcon,
  Users,
  Clock,
  Activity,
  Search,
  Shield,
  CheckCircle,
  XCircle,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Trash2,
  Edit,
  UserPlus,
  Loader2,
  Store,
  Filter,
  Calendar,
  DollarSign,
  Package,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/url";
import { getAccessToken } from "@/services/api";
import {
  User,
  Order as LaundryOrder,
  Customer,
} from "@/services/types";

// Extended interfaces
interface ExtendedCustomer extends Customer {
  created_by?: {
    id: number;
    email: string;
    user_type: 'admin' | 'staff';
    is_superuser: boolean;
    is_staff: boolean;
    is_active: boolean;
    first_name: string;
    last_name: string;
  } | null;
}

interface ApiHotelOrderItem {
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

interface ApiHotelOrder {
  id: number;
  order_items: ApiHotelOrderItem[];
  total_amount: number;
  created_by: {
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  created_at: string;
}

interface UserPerformanceData {
  laundryOrders: LaundryOrder[];
  hotelOrders: ApiHotelOrder[];
  customers: ExtendedCustomer[];
  totalRevenue: number;
  totalOrders: number;
  laundryRevenue: number;
  hotelRevenue: number;
}

// Utility functions
const ensureArray = <T,>(data: unknown): T[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'object' && data !== null) {
    const anyData = data as any;
    if (Array.isArray(anyData.results)) return anyData.results as T[];
    if (Array.isArray(anyData.data)) return anyData.data as T[];
  }
  return [];
};

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const getAuthHeaders = () => {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// API functions with pagination handling
const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/Laundry/users/`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized. Please login again.');
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    return ensureArray<User>(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

const createUser = async (userData: any): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/Laundry/users/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail ||
      errorData.message ||
      errorData.email?.[0] ||
      errorData.password?.[0] ||
      `Failed to create user: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

const updateUser = async (userId: number, userData: any): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/Laundry/users/${userId}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.detail ||
      errorData.message ||
      errorData.email?.[0] ||
      errorData.password?.[0] ||
      `Failed to update user: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
};

const deleteUser = async (userId: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/Laundry/users/${userId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete user: ${response.status}`);
  }
};

// Helper function to fetch all pages
const fetchAllPages = async <T,>(baseUrl: string): Promise<T[]> => {
  try {
    let allResults: T[] = [];
    let nextUrl: string | null = baseUrl;
    
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        console.error(`Failed to fetch from ${nextUrl}:`, response.status);
        break;
      }

      const data = await response.json();
      
      // Add results from this page
      if (data.results && Array.isArray(data.results)) {
        allResults = [...allResults, ...data.results];
      }
      
      // Check if there's a next page
      nextUrl = data.next;
    }
    
    return allResults;
  } catch (error) {
    console.error('Error fetching all pages:', error);
    return [];
  }
};

const fetchAllLaundryOrders = async (): Promise<LaundryOrder[]> => {
  try {
    return fetchAllPages<LaundryOrder>(`${API_BASE_URL}/Laundry/orders/`);
  } catch (error) {
    console.error('Error fetching laundry orders:', error);
    return [];
  }
};

const fetchAllHotelOrders = async (): Promise<ApiHotelOrder[]> => {
  try {
    return fetchAllPages<ApiHotelOrder>(`${API_BASE_URL}/Hotel/orders/`);
  } catch (error) {
    console.error('Error fetching hotel orders:', error);
    return [];
  }
};

const fetchAllCustomers = async (): Promise<ExtendedCustomer[]> => {
  try {
    return fetchAllPages<ExtendedCustomer>(`${API_BASE_URL}/Laundry/customers/`);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

// Helper functions
const getCurrentUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('current_user') ||
      sessionStorage.getItem('current_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }
  return null;
};

const isDateInRange = (dateString: string, startDate?: Date, endDate?: Date): boolean => {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  } catch (error) {
    console.error('Error parsing date:', error);
    return false;
  }
};

// Updated extractUserId to handle both Laundry and Hotel API structures
const extractUserId = (createdBy: any, users: User[] = []): number | null => {
  if (!createdBy) return null;
  
  if (typeof createdBy === 'object' && createdBy !== null) {
    // Handle Laundry API User object
    if ('id' in createdBy) {
      return createdBy.id;
    }
    
    // Handle Hotel API created_by structure
    if ('email' in createdBy && createdBy.email) {
      // Find user by email
      const user = users.find(u => u.email === createdBy.email);
      return user ? user.id : null;
    }
    
    return null;
  }
  
  if (typeof createdBy === 'number') {
    return createdBy;
  }
  
  if (typeof createdBy === 'string') {
    // Handle DRF URLs like "/api/users/5/" or "http://domain.com/users/5/"
    const urlMatch = createdBy.match(/\/(\d+)\/?$/);
    if (urlMatch) {
      const parsed = parseInt(urlMatch[1], 10);
      return isNaN(parsed) ? null : parsed;
    }
    
    // Handle plain string numbers
    const parsed = parseInt(createdBy, 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
};

const getOrderTotal = (order: LaundryOrder | ApiHotelOrder): number => {
  if ('total_price' in order) {
    return safeParseFloat(order.total_price);
  } else {
    return order.total_amount || 0;
  }
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    return 'Invalid date';
  }
};

const formatDateTime = (dateString: string | null | undefined) => {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    return 'Invalid date';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('KES', 'KSh');
};

// Orders Dialog Component
interface OrdersDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  orders: any[];
  type: 'laundry' | 'hotel';
}

const OrdersDialog = ({ isOpen, onOpenChange, title, orders, type }: OrdersDialogProps) => {
  const getOrderStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Completed': 'bg-green-100 text-green-800 border-green-200',
      'Delivered_picked': 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-red-100 text-red-800 border-red-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'partial': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'laundry' ? (
              <ShoppingBag className="h-5 w-5 text-blue-600" />
            ) : (
              <Store className="h-5 w-5 text-orange-600" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {orders.length} {type === 'laundry' ? 'laundry' : 'hotel'} orders found
          </DialogDescription>
        </DialogHeader>

        {orders.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  {type === 'laundry' ? (
                    <>
                      <TableHead className="font-medium">Date</TableHead>
                      <TableHead className="font-medium">Order Code</TableHead>
                      <TableHead className="font-medium">Customer</TableHead>
                      <TableHead className="font-medium text-right">Total Amount</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="font-medium">Date</TableHead>
                      <TableHead className="font-medium">Order ID</TableHead>
                      <TableHead className="font-medium">Items</TableHead>
                      <TableHead className="font-medium text-right">Total Amount</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-900">
                      {formatDate(order.created_at)}
                    </TableCell>
                    
                    {type === 'laundry' ? (
                      <>
                        <TableCell>
                          <div className="font-medium text-blue-600">{order.uniquecode}</div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{order.customer?.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{order.customer?.phone || 'No phone'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-gray-900">
                            {formatCurrency(safeParseFloat(order.total_price))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={cn("font-medium", getOrderStatusColor(order.order_status))}>
                              {order.order_status}
                            </Badge>
                            <Badge variant="outline" className={cn("text-xs", getPaymentStatusColor(order.payment_status))}>
                              {order.payment_status}
                            </Badge>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <div className="font-medium text-orange-600">#{order.id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-md">
                            {order.order_items.map((item: any) => (
                              <div key={item.id} className="text-sm">
                                <div className="flex justify-between">
                                  <span className="font-medium text-gray-900">{item.food_item_name}</span>
                                  <span className="text-gray-600">x{item.quantity}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Unit: {formatCurrency(safeParseFloat(item.price))} | Total: {formatCurrency(item.total_price)}
                                </div>
                              </div>
                            ))}
                            {order.order_items.length === 0 && (
                              <span className="text-sm text-gray-500 italic">No items</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-gray-900">
                            {formatCurrency(order.total_amount || 0)}
                          </span>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {type === 'laundry' ? (
                <ShoppingBag className="h-8 w-8 text-gray-400" />
              ) : (
                <Store className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No {type === 'laundry' ? 'Laundry' : 'Hotel'} Orders</h3>
            <p className="text-gray-500">This user hasn't created any {type === 'laundry' ? 'laundry' : 'hotel'} orders yet.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function SiteManagement() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const isSuperUser = currentUser?.is_superuser || false;

  // State
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});
  
  // Orders dialogs state
  const [laundryOrdersDialog, setLaundryOrdersDialog] = useState<{
    isOpen: boolean;
    userId: number | null;
    userName: string;
  }>({ isOpen: false, userId: null, userName: '' });
  
  const [hotelOrdersDialog, setHotelOrdersDialog] = useState<{
    isOpen: boolean;
    userId: number | null;
    userName: string;
  }>({ isOpen: false, userId: null, userName: '' });

  // Form states
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    confirm_password: "",
    user_type: "staff",
    is_staff: true,
    is_active: true,
    first_name: "",
    last_name: "",
  });

  const [editUser, setEditUser] = useState({
    email: "",
    user_type: "staff",
    is_staff: false,
    is_active: true,
    first_name: "",
    last_name: "",
    password: "",
  });

  const [formErrors, setFormErrors] = useState<{
    create?: Record<string, string>;
    edit?: Record<string, string>;
  }>({});

  // React Query
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    retry: 1,
  });

  const { data: allLaundryOrders = [], isLoading: laundryOrdersLoading } = useQuery({
    queryKey: ['laundry-orders'],
    queryFn: fetchAllLaundryOrders,
    retry: 1,
  });

  const { data: allHotelOrders = [], isLoading: hotelOrdersLoading } = useQuery({
    queryKey: ['hotel-orders'],
    queryFn: fetchAllHotelOrders,
    retry: 1,
  });

  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
    retry: 1,
  });

  // Memoized user performance data
  const userPerformanceData = useMemo(() => {
    const data: Record<number, UserPerformanceData> = {};
    
    const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : undefined;
    const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : undefined;
    
    // Initialize all users
    users.forEach(user => {
      data[user.id] = {
        laundryOrders: [],
        hotelOrders: [],
        customers: [],
        totalRevenue: 0,
        totalOrders: 0,
        laundryRevenue: 0,
        hotelRevenue: 0
      };
    });

    // Process laundry orders
    allLaundryOrders.forEach(order => {
      const userId = extractUserId(order.created_by, users);
      if (userId && data[userId] && isDateInRange(order.created_at, startDate, endDate)) {
        data[userId].laundryOrders.push(order);
      }
    });

    // Process hotel orders
    allHotelOrders.forEach(order => {
      const userId = extractUserId(order.created_by, users);
      if (userId && data[userId] && isDateInRange(order.created_at, startDate, endDate)) {
        data[userId].hotelOrders.push(order);
      }
    });

    // Process customers
    allCustomers.forEach(customer => {
      const userId = extractUserId(customer.created_by, users);
      if (userId && data[userId]) {
        data[userId].customers.push(customer);
      }
    });

    // Calculate totals
    Object.keys(data).forEach(userId => {
      const userData = data[parseInt(userId)];
      
      // Calculate laundry revenue
      userData.laundryRevenue = userData.laundryOrders.reduce((sum, order) => 
        sum + getOrderTotal(order), 0);
      
      // Calculate hotel revenue
      userData.hotelRevenue = userData.hotelOrders.reduce((sum, order) => 
        sum + getOrderTotal(order), 0);
      
      // Calculate totals
      userData.totalRevenue = userData.laundryRevenue + userData.hotelRevenue;
      userData.totalOrders = userData.laundryOrders.length + userData.hotelOrders.length;
    });

    return data;
  }, [users, allLaundryOrders, allHotelOrders, allCustomers, dateFilter]);

  // Utility functions
  const getUserInitials = (user: User) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName || lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Validation functions
  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newUser.email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(newUser.email)) {
      errors.email = "Email is invalid";
    }

    if (!newUser.password) {
      errors.password = "Password is required";
    } else if (newUser.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newUser.password)) {
      errors.password = "Password must contain uppercase, lowercase, and numbers";
    }

    if (newUser.password !== newUser.confirm_password) {
      errors.confirm_password = "Passwords do not match";
    }

    setFormErrors(prev => ({ ...prev, create: errors }));
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!editUser.email?.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(editUser.email)) {
      errors.email = "Email is invalid";
    }

    if (editUser.password && editUser.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (editUser.password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(editUser.password)) {
      errors.password = "Password must contain uppercase, lowercase, and numbers";
    }

    setFormErrors(prev => ({ ...prev, edit: errors }));
    return Object.keys(errors).length === 0;
  };

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully!');
      setIsCreateUserOpen(false);
      setNewUser({
        email: "",
        password: "",
        confirm_password: "",
        user_type: "staff",
        is_staff: true,
        is_active: true,
        first_name: "",
        last_name: "",
      });
      setFormErrors(prev => ({ ...prev, create: {} }));
    },
    onError: (error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) =>
      updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      setIsEditUserOpen(false);
      setEditUser({
        email: "",
        user_type: "staff",
        is_staff: false,
        is_active: true,
        first_name: "",
        last_name: "",
        password: "",
      });
      setFormErrors(prev => ({ ...prev, edit: {} }));
      setSelectedUserId(null);
    },
    onError: (error) => {
      toast.error(`Failed to update user: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
      setIsDeleteConfirmOpen(false);
      setSelectedUserId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });

  // Filter users
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      user.email.toLowerCase().includes(searchLower) ||
      (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchLower));

    const matchesUserType =
      userTypeFilter === "all" || user.user_type === userTypeFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.is_active) ||
      (statusFilter === "inactive" && !user.is_active);

    return matchesSearch && matchesUserType && matchesStatus;
  });

  // Handlers
  const toggleUserExpansion = (userId: number) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleCreateUser = () => {
    if (!validateCreateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    const userData = {
      email: newUser.email.trim(),
      password: newUser.password,
      user_type: newUser.user_type,
      is_staff: newUser.is_staff,
      is_active: newUser.is_active,
      first_name: newUser.first_name.trim() || undefined,
      last_name: newUser.last_name.trim() || undefined,
    };

    createUserMutation.mutate(userData);
  };

  const handleEditUser = () => {
    if (!selectedUserId) return;

    if (!validateEditForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    const updateData: any = {
      email: editUser.email?.trim(),
      user_type: editUser.user_type,
      is_staff: editUser.is_staff,
      is_active: editUser.is_active,
      first_name: editUser.first_name.trim() || undefined,
      last_name: editUser.last_name.trim() || undefined,
    };

    if (editUser.password && editUser.password.trim()) {
      updateData.password = editUser.password.trim();
    }

    updateUserMutation.mutate({
      userId: selectedUserId,
      data: updateData
    });
  };

  const handleDeleteUser = () => {
    if (!selectedUserId) return;

    if (currentUser?.id === selectedUserId) {
      toast.error("You cannot delete your own account");
      return;
    }

    deleteUserMutation.mutate(selectedUserId);
  };

  const openEditDialog = (user: User) => {
    setSelectedUserId(user.id);
    setEditUser({
      email: user.email,
      user_type: user.user_type,
      is_staff: user.is_staff,
      is_active: user.is_active,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      password: "",
    });
    setIsEditUserOpen(true);
  };

  const openDeleteConfirm = (userId: number) => {
    const userToDelete = users.find(u => u.id === userId);

    if (userToDelete?.is_superuser) {
      toast.error("Cannot delete superuser accounts");
      return;
    }

    if (currentUser?.id === userId) {
      toast.error("You cannot delete your own account");
      return;
    }

    setSelectedUserId(userId);
    setIsDeleteConfirmOpen(true);
  };

  const openLaundryOrdersDialog = (userId: number, userName: string) => {
    setLaundryOrdersDialog({
      isOpen: true,
      userId,
      userName
    });
  };

  const openHotelOrdersDialog = (userId: number, userName: string) => {
    setHotelOrdersDialog({
      isOpen: true,
      userId,
      userName
    });
  };

  const clearDateFilters = () => {
    setDateFilter({});
  };

  // Helper functions for UI
  const getUserTypeColor = (userType: string) => {
    const colors: Record<string, string> = {
      'admin': 'bg-purple-100 text-purple-800 border-purple-200',
      'staff': 'bg-blue-100 text-blue-800 border-blue-200',
      'customer': 'bg-green-100 text-green-800 border-green-200',
      'manager': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[userType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (usersError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Users</h2>
          <p className="text-gray-600">{usersError.message}</p>
          <Button
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Site Management</h1>
          <p className="text-gray-600">Manage users and track their performance</p>
        </div>

        {isSuperUser && (
          <Button
            onClick={() => setIsCreateUserOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create New User
          </Button>
        )}
      </div>

      {/* Date Filters */}
      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <CardTitle className="text-lg font-semibold">Date Filters</CardTitle>
            </div>
            {(dateFilter.startDate || dateFilter.endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <CardDescription>Filter orders by date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={dateFilter.startDate || ''}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={dateFilter.endDate || ''}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="border-gray-300"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearDateFilters}
                className="w-full border-gray-300"
              >
                Clear Dates
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {usersLoading ? "..." : users.length}
            </div>
            <p className="text-sm text-gray-500 mt-1">Registered users</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
              <div className="p-2 bg-green-50 rounded-lg">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {usersLoading ? "..." : users.filter(u => u.is_active).length}
            </div>
            <p className="text-sm text-gray-500 mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              <div className="p-2 bg-orange-50 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {laundryOrdersLoading || hotelOrdersLoading ? "..." : allLaundryOrders.length + allHotelOrders.length}
            </div>
            <p className="text-sm text-gray-500 mt-1">All orders</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {laundryOrdersLoading || hotelOrdersLoading ? "..." : formatCurrency(
                allLaundryOrders.reduce((sum, order) => sum + getOrderTotal(order), 0) +
                allHotelOrders.reduce((sum, order) => sum + getOrderTotal(order), 0)
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">All revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                {filteredUsers.length} users found
              </CardDescription>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300"
                />
              </div>

              <div className="flex gap-2">
                <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                  <SelectTrigger className="w-[140px] border-gray-300">
                    <SelectValue placeholder="User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] border-gray-300">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {usersLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                {searchQuery ? 'Try a different search term' : 'No users match the selected filters'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const isExpanded = expandedUsers.has(user.id);
                const performanceData = userPerformanceData[user.id] || {
                  laundryOrders: [],
                  hotelOrders: [],
                  customers: [],
                  totalRevenue: 0,
                  totalOrders: 0,
                  laundryRevenue: 0,
                  hotelRevenue: 0
                };

                return (
                  <div key={user.id} className="hover:bg-gray-50 transition-colors">
                    {/* User Header */}
                    <div className="p-6 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                          <AvatarFallback className={cn(
                            "font-semibold text-base",
                            user.is_active ? "bg-gradient-to-br from-green-100 to-green-50 text-green-700" : "bg-gradient-to-br from-gray-100 to-gray-50 text-gray-700"
                          )}>
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div >
                          <div className="flex items-center gap-2 mb-1">
                           
                            <h3 className="font-semibold text-gray-900">
                              {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.email}
                            </h3>
                            <Badge variant="outline" className={cn("text-xs font-medium", getUserTypeColor(user.user_type))}>
                              {user.user_type}
                            </Badge>
                            {user.is_staff && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium">
                                <Shield className="h-3 w-3 mr-1" />
                                Staff
                              </Badge>
                            )}
                          </div>
                         
                          <div className="flex items-center gap-4 mt-2">
                             <p className="text-sm text-gray-600">{user.email}</p>
                            <div className="flex items-center gap-1">
                              <ShoppingBag className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">{performanceData.totalOrders} orders</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700">{formatCurrency(performanceData.totalRevenue)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-xs text-gray-500">Last login: {user.last_login ? formatDateTime(user.last_login) : 'Never'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="mb-1">
                            {user.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle className="h-3 w-3" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="h-3 w-3" />
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Joined {formatDate(user.date_joined)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleUserExpansion(user.id)}
                            className="border-gray-300 hover:bg-gray-100"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>

                          {isSuperUser && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  updateUserMutation.mutate({
                                    userId: user.id,
                                    data: { is_active: !user.is_active }
                                  });
                                }}>
                                  {user.is_active ? (
                                    <>
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                {!user.is_superuser && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openDeleteConfirm(user.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details - Compact Cards */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50/50 p-6">
                        {/* Compact Performance Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <Card className="border-blue-200">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-blue-700">Laundry Performance</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
                                    {performanceData.laundryOrders.length} orders
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openLaundryOrdersDialog(user.id, user.first_name || user.email)}
                                    className="h-8 w-8 p-0"
                                    disabled={performanceData.laundryOrders.length === 0}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Revenue:</span>
                                <span className="text-sm font-bold text-blue-700">
                                  {formatCurrency(performanceData.laundryRevenue)}
                                </span>
                              </div>
                              {performanceData.laundryOrders.length === 0 && (
                                <p className="text-sm text-gray-500 mt-2 italic">No laundry orders</p>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="border-orange-200">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-orange-700">Hotel Performance</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-white text-orange-700 border-orange-300">
                                    {performanceData.hotelOrders.length} orders
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openHotelOrdersDialog(user.id, user.first_name || user.email)}
                                    className="h-8 w-8 p-0"
                                    disabled={performanceData.hotelOrders.length === 0}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Revenue:</span>
                                <span className="text-sm font-bold text-orange-700">
                                  {formatCurrency(performanceData.hotelRevenue)}
                                </span>
                              </div>
                              {performanceData.hotelOrders.length === 0 && (
                                <p className="text-sm text-gray-500 mt-2 italic">No hotel orders</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex flex-wrap gap-3 mb-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openLaundryOrdersDialog(user.id, user.first_name || user.email)}
                            disabled={performanceData.laundryOrders.length === 0}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                          >
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            View Laundry Orders ({performanceData.laundryOrders.length})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openHotelOrdersDialog(user.id, user.first_name || user.email)}
                            disabled={performanceData.hotelOrders.length === 0}
                            className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                          >
                            <Store className="h-4 w-4 mr-2" />
                            View Hotel Orders ({performanceData.hotelOrders.length})
                          </Button>
                        </div>

                        {/* Customer Stats */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <h4 className="text-sm font-medium text-gray-700">Customers Created</h4>
                            <Badge variant="outline" className="ml-2 bg-white text-gray-700 border-gray-300">
                              {performanceData.customers.length} customers
                            </Badge>
                          </div>
                          {performanceData.customers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border">
                              {performanceData.customers.slice(0, 10).map(customer => (
                                <div key={customer.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                                    <p className="text-xs text-gray-500">{customer.phone}</p>
                                  </div>
                                  
                                </div>
                              ))}
                              {performanceData.customers.length > 10 && (
                                <div className="col-span-2 text-center text-xs text-gray-500 py-2">
                                  +{performanceData.customers.length - 10} more customers
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No customers created</p>
                          )}
                        </div>

                        {/* Recent Activity */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Orders</h4>
                          <div className="space-y-2">
                            {[...performanceData.laundryOrders, ...performanceData.hotelOrders]
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .slice(0, 3)
                              .map((order, index) => (
                                <div key={`${'uniquecode' in order ? order.uniquecode : order.id}-${index}`} 
                                     className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      {'uniquecode' in order ? (
                                        <ShoppingBag className="h-3 w-3 text-blue-500" />
                                      ) : (
                                        <Store className="h-3 w-3 text-orange-500" />
                                      )}
                                      <span className="text-sm font-medium text-gray-900">
                                        {'uniquecode' in order ? order.uniquecode : `Hotel #${order.id}`}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {formatDate(order.created_at)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm font-bold text-gray-900">
                                      {formatCurrency(getOrderTotal(order))}
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {'total_price' in order ? 'Laundry' : 'Hotel'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            
                            {performanceData.totalOrders === 0 && (
                              <p className="text-sm text-gray-500 italic p-3 bg-white rounded-lg border border-gray-200">
                                No recent orders
                              </p>
                            )}
                          </div>
                        </div>
                        
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Dialogs */}
      {laundryOrdersDialog.userId && (
        <OrdersDialog
          isOpen={laundryOrdersDialog.isOpen}
          onOpenChange={(open) => setLaundryOrdersDialog(prev => ({ ...prev, isOpen: open }))}
          title={`Laundry Orders - ${laundryOrdersDialog.userName}`}
          orders={userPerformanceData[laundryOrdersDialog.userId]?.laundryOrders || []}
          type="laundry"
        />
      )}

      {hotelOrdersDialog.userId && (
        <OrdersDialog
          isOpen={hotelOrdersDialog.isOpen}
          onOpenChange={(open) => setHotelOrdersDialog(prev => ({ ...prev, isOpen: open }))}
          title={`Hotel Orders - ${hotelOrdersDialog.userName}`}
          orders={userPerformanceData[hotelOrdersDialog.userId]?.hotelOrders || []}
          type="hotel"
        />
      )}

      {/* CREATE User Dialog */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the required permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name (Optional)</Label>
                <Input
                  id="first_name"
                  value={newUser.first_name}
                  onChange={(e) => {
                    setNewUser({ ...newUser, first_name: e.target.value });
                  }}
                  placeholder="John"
                  className="border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name (Optional)</Label>
                <Input
                  id="last_name"
                  value={newUser.last_name}
                  onChange={(e) => {
                    setNewUser({ ...newUser, last_name: e.target.value });
                  }}
                  placeholder="Doe"
                  className="border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => {
                  setNewUser({ ...newUser, email: e.target.value });
                  if (formErrors.create?.email) {
                    setFormErrors(prev => ({
                      ...prev,
                      create: { ...prev.create, email: '' }
                    }));
                  }
                }}
                placeholder="john.doe@example.com"
                className={cn("border-gray-300", formErrors.create?.email && "border-red-500")}
              />
              {formErrors.create?.email && (
                <p className="text-sm text-red-500">{formErrors.create.email}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => {
                    setNewUser({ ...newUser, password: e.target.value });
                    if (formErrors.create?.password) {
                      setFormErrors(prev => ({
                        ...prev,
                        create: { ...prev.create, password: '' }
                      }));
                    }
                  }}
                  placeholder="••••••••"
                  className={cn("border-gray-300", formErrors.create?.password && "border-red-500")}
                />
                {formErrors.create?.password && (
                  <p className="text-sm text-red-500">{formErrors.create.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password *</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={newUser.confirm_password}
                  onChange={(e) => {
                    setNewUser({ ...newUser, confirm_password: e.target.value });
                    if (formErrors.create?.confirm_password) {
                      setFormErrors(prev => ({
                        ...prev,
                        create: { ...prev.create, confirm_password: '' }
                      }));
                    }
                  }}
                  placeholder="••••••••"
                  className={cn("border-gray-300", formErrors.create?.confirm_password && "border-red-500")}
                />
                {formErrors.create?.confirm_password && (
                  <p className="text-sm text-red-500">{formErrors.create.confirm_password}</p>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              Password must be at least 8 characters with uppercase, lowercase, and numbers
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_type">User Type</Label>
              <Select
                value={newUser.user_type}
                onValueChange={(value) => setNewUser({ ...newUser, user_type: value })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_staff"
                  checked={newUser.is_staff}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, is_staff: checked })}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="is_staff">Staff Member</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newUser.is_active}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
                  className="data-[state=checked]:bg-green-600"
                />
                <Label htmlFor="is_active">Active Account</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateUserOpen(false);
                setFormErrors(prev => ({ ...prev, create: {} }));
              }}
              disabled={createUserMutation.isPending}
              className="border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions. Leave password empty to keep current password.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">First Name (Optional)</Label>
                <Input
                  id="edit_first_name"
                  value={editUser.first_name || ''}
                  onChange={(e) => {
                    setEditUser({ ...editUser, first_name: e.target.value });
                  }}
                  placeholder="John"
                  className="border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Last Name (Optional)</Label>
                <Input
                  id="edit_last_name"
                  value={editUser.last_name || ''}
                  onChange={(e) => {
                    setEditUser({ ...editUser, last_name: e.target.value });
                  }}
                  placeholder="Doe"
                  className="border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={editUser.email || ''}
                onChange={(e) => {
                  setEditUser({ ...editUser, email: e.target.value });
                  if (formErrors.edit?.email) {
                    setFormErrors(prev => ({
                      ...prev,
                      edit: { ...prev.edit, email: '' }
                    }));
                  }
                }}
                placeholder="john.doe@example.com"
                className={cn("border-gray-300", formErrors.edit?.email && "border-red-500")}
              />
              {formErrors.edit?.email && (
                <p className="text-sm text-red-500">{formErrors.edit.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_password">New Password (Optional)</Label>
              <Input
                id="edit_password"
                type="password"
                value={editUser.password || ''}
                onChange={(e) => {
                  setEditUser({ ...editUser, password: e.target.value });
                  if (formErrors.edit?.password) {
                    setFormErrors(prev => ({
                      ...prev,
                      edit: { ...prev.edit, password: '' }
                    }));
                  }
                }}
                placeholder="Leave empty to keep current password"
                className={cn("border-gray-300", formErrors.edit?.password && "border-red-500")}
              />
              {formErrors.edit?.password && (
                <p className="text-sm text-red-500">{formErrors.edit.password}</p>
              )}
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              If provided, must be at least 8 characters with uppercase, lowercase, and numbers
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_user_type">User Type</Label>
              <Select
                value={editUser.user_type || 'staff'}
                onValueChange={(value) => setEditUser({ ...editUser, user_type: value })}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_staff"
                  checked={editUser.is_staff || false}
                  onCheckedChange={(checked) => setEditUser({ ...editUser, is_staff: checked })}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="edit_is_staff">Staff Member</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={editUser.is_active || true}
                  onCheckedChange={(checked) => setEditUser({ ...editUser, is_active: checked })}
                  className="data-[state=checked]:bg-green-600"
                />
                <Label htmlFor="edit_is_active">Active Account</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditUserOpen(false);
                setFormErrors(prev => ({ ...prev, edit: {} }));
              }}
              disabled={updateUserMutation.isPending}
              className="border-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={updateUserMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-sm text-gray-600">
              This will permanently delete the user account and all associated data.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleteUserMutation.isPending}
              className="border-gray-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}