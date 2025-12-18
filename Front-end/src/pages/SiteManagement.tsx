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
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Eye,
  Activity,
  Search,
  Shield,
  CheckCircle,
  XCircle,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  History,
  Globe,
  ShoppingBag,
  Trash2,
  Edit,
  Key,
  UserPlus,
  Loader2,
  Store,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/services/url";
import { getAccessToken } from "@/services/api";
import {
  User,
  Order as LaundryOrder,
  Customer,
  HotelOrderItem,
  FoodItem
} from "@/services/types";

// Extend Customer interface to include created_by
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

// Get auth headers function
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

// API functions
const fetchUsers = async (): Promise<User[]> => {
  const response = await fetch(`${API_BASE_URL}/Laundry/users/`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized. Please login again.');
    }
    throw new Error('Failed to fetch users');
  }

  return response.json();
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

// Fetch all laundry orders and filter by created_by
const fetchAllLaundryOrders = async (): Promise<LaundryOrder[]> => {
  const response = await fetch(`${API_BASE_URL}/Laundry/orders/`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
};

// Fetch all hotel order items and filter by created_by
const fetchAllHotelOrderItems = async (): Promise<HotelOrderItem[]> => {
  const response = await fetch(`${API_BASE_URL}/Hotel/order-items/`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
};

// Fetch all customers and filter by created_by
const fetchAllCustomers = async (): Promise<ExtendedCustomer[]> => {
  const response = await fetch(`${API_BASE_URL}/Laundry/customers/`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
};

const fetchPageVisits = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/page-visits/`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch {
    return [];
  }
};

const fetchSiteAnalytics = async (): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/site-analytics/`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Analytics endpoint not available');
    }

    return response.json();
  } catch {
    return {
      total_users: 0,
      active_today: 0,
      total_visits: 0,
      average_session_duration: 0,
    };
  }
};

// Function to get current user
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

export default function SiteManagement() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const isSuperUser = currentUser?.is_superuser || false;

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [loadingOrders, setLoadingOrders] = useState<Set<number>>(new Set());

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

  // Fetch data using React Query
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

  const { data: allHotelOrderItems = [], isLoading: hotelOrdersLoading } = useQuery({
    queryKey: ['hotel-order-items'],
    queryFn: fetchAllHotelOrderItems,
    retry: 1,
  });

  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
    retry: 1,
  });

  const { data: pageVisits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['page-visits'],
    queryFn: fetchPageVisits,
    retry: 1,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['site-analytics'],
    queryFn: fetchSiteAnalytics,
    retry: 1,
  });

  // Memoize filtered data for each user
  const userData = useMemo(() => {
    const data: Record<number, {
      laundryOrders: LaundryOrder[];
      hotelOrders: HotelOrderItem[];
      customers: ExtendedCustomer[];
    }> = {};

    users.forEach(user => {
      // Filter laundry orders by created_by
      const laundryOrders = allLaundryOrders.filter(order =>
        order.created_by?.id === user.id
      );

      // Filter hotel order items by created_by (handle both object and null cases)
      const hotelOrders = allHotelOrderItems.filter(order => {
        if (!order.created_by) return false;
        if (typeof order.created_by === 'object') {
          return order.created_by.id === user.id;
        }
        return order.created_by === user.id;
      });

      // Filter customers by created_by - using ExtendedCustomer type
      const customers = allCustomers.filter(customer =>
        customer.created_by?.id === user.id
      );

      data[user.id] = {
        laundryOrders,
        hotelOrders,
        customers
      };
    });

    return data;
  }, [users, allLaundryOrders, allHotelOrderItems, allCustomers]);

  // Load user data when expanded
  const loadUserData = async (userId: number) => {
    if (loadingOrders.has(userId)) return;
    setLoadingOrders(prev => new Set([...prev, userId]));
    // Data is already loaded via useQuery, just simulate loading
    setTimeout(() => {
      setLoadingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }, 300);
  };

  // Validate create form
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

  // Validate edit form
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

  // CREATE user mutation
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['site-analytics'] });
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

  // UPDATE user mutation
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

  // DELETE user mutation
  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['site-analytics'] });
      toast.success('User deleted successfully');
      setIsDeleteConfirmOpen(false);
      setSelectedUserId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });

  // Filter users based on search and filters
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

  // Get user's initials for avatar
  const getUserInitials = (user: User) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName || lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format time ago
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Toggle user details expansion
  const toggleUserExpansion = async (userId: number) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
        loadUserData(userId);
      }
      return newSet;
    });
  };

  // Handle CREATE user
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

  // Handle UPDATE user
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

  // Handle DELETE user
  const handleDeleteUser = () => {
    if (!selectedUserId) return;

    if (currentUser?.id === selectedUserId) {
      toast.error("You cannot delete your own account");
      return;
    }

    deleteUserMutation.mutate(selectedUserId);
  };

  // Open edit dialog
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

  // Open delete confirmation
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

  // Get user type badge color
  const getUserTypeColor = (userType: string) => {
    const colors: Record<string, string> = {
      'admin': 'bg-purple-100 text-purple-800',
      'staff': 'bg-blue-100 text-blue-800',
      'customer': 'bg-green-100 text-green-800',
      'manager': 'bg-orange-100 text-orange-800',
    };
    return colors[userType] || 'bg-gray-100 text-gray-800';
  };

  // Get order status badge color
  const getOrderStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'Completed': 'bg-green-100 text-green-800',
      'Delivered_picked': 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get payment status badge color
  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-red-100 text-red-800',
      'completed': 'bg-green-100 text-green-800',
      'partial': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Calculate total orders value for a user
  const calculateTotalOrdersValue = (orders: LaundryOrder[]): number => {
    return orders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);
  };

  // Calculate total hotel orders value for a user
  const calculateTotalHotelOrdersValue = (orders: HotelOrderItem[]): number => {
    return orders.reduce((sum, order) => {
      const price = parseFloat(order.total_price || '0');
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
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
          <p className="text-gray-600">Manage users and track site activity</p>
        </div>

        {isSuperUser && (
          <Button
            onClick={() => setIsCreateUserOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create New User
          </Button>
        )}
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : analytics?.total_users || users.length}
            </div>
            <p className="text-xs text-gray-500">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : analytics?.active_today || 0}
            </div>
            <p className="text-xs text-gray-500">Users active in last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : analytics?.total_visits || 0}
            </div>
            <p className="text-xs text-gray-500">Page visits today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Session</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : Math.round(analytics?.average_session_duration || 0)}
            </div>
            <p className="text-xs text-gray-500">Average session duration (seconds)</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Site Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {/* Filters and Search */}
          <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search users by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
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

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                {filteredUsers.length} users found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-sm font-medium text-gray-900">No users found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery ? 'Try a different search term' : 'No users match the selected filters'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => {
                    const isExpanded = expandedUsers.has(user.id);
                    const userVisits = pageVisits.filter((visit: any) => visit.user === user.id);
                    const userDataForUser = userData[user.id] || { laundryOrders: [], hotelOrders: [], customers: [] };
                    const { laundryOrders, hotelOrders, customers } = userDataForUser;
                    const isLoading = loadingOrders.has(user.id);

                    return (
                      <div key={user.id} className="border rounded-lg overflow-hidden">
                        {/* User Header */}
                        <div className="bg-gray-50 p-4 flex items-center justify-between hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarFallback className={cn(
                                "font-semibold",
                                user.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                              )}>
                                {getUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.email}
                                </h3>
                                <Badge variant="outline" className={getUserTypeColor(user.user_type)}>
                                  {user.user_type}
                                </Badge>
                                {user.is_staff && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Staff
                                  </Badge>
                                )}
                                {user.is_superuser && (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    <Key className="h-3 w-3 mr-1" />
                                    Superuser
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {user.is_active ? (
                                  <span className="text-green-600 flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="text-red-600 flex items-center gap-1">
                                    <XCircle className="h-4 w-4" />
                                    Inactive
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                Last login: {formatTimeAgo(user.last_login)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleUserExpansion(user.id)}
                                disabled={isLoading}
                              >
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>

                              {isSuperUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
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
                                          Deactivate User
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Activate User
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedUserId(user.id);
                                      setIsUserDetailsOpen(true);
                                    }}>
                                      <History className="mr-2 h-4 w-4" />
                                      View Activity
                                    </DropdownMenuItem>
                                    {!user.is_superuser && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => openDeleteConfirm(user.id)}
                                          className="text-red-600"
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

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t p-4 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">User Details</h4>
                                <div className="space-y-1 text-sm">
                                  <p><span className="text-gray-500">Joined:</span> {formatDate(user.date_joined)}</p>
                                  <p><span className="text-gray-500">Type:</span> {user.user_type}</p>
                                  <p><span className="text-gray-500">Staff:</span> {user.is_staff ? 'Yes' : 'No'}</p>
                                  <p><span className="text-gray-500">Superuser:</span> {user.is_superuser ? 'Yes' : 'No'}</p>
                                  <p><span className="text-gray-500">Customers Created:</span> {customers.length}</p>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Laundry Orders</h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">Total Orders:</span>
                                    <Badge variant="outline">{laundryOrders.length}</Badge>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">Total Value:</span>
                                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                                      KSh {calculateTotalOrdersValue(laundryOrders).toFixed(2)}
                                    </Badge>
                                  </div>
                                  {laundryOrders.slice(0, 3).map((order) => (
                                    <div key={order.id} className="text-sm border-l-2 border-blue-200 pl-2">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-medium truncate">{order.uniquecode}</p>
                                          <p className="text-xs text-gray-500">{order.customer?.name || 'Unknown Customer'}</p>
                                        </div>
                                        <div className="text-right">
                                          <Badge className={getOrderStatusColor(order.order_status)}>
                                            {order.order_status}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {laundryOrders.length === 0 && (
                                    <p className="text-sm text-gray-500">No laundry orders</p>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Hotel Orders</h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">Total Orders:</span>
                                    <Badge variant="outline">{hotelOrders.length}</Badge>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">Total Value:</span>
                                    <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                                      KSh {calculateTotalHotelOrdersValue(hotelOrders).toFixed(2)}
                                    </Badge>
                                  </div>
                                  {hotelOrders.slice(0, 3).map((order) => (
                                    <div key={order.id} className="text-sm border-l-2 border-orange-200 pl-2">
                                      <div className="flex justify-between">
                                        <span>Order #{order.id}</span>
                                        <span className="font-medium">KSh {parseFloat(order.total_price || '0').toFixed(2)}</span>
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        Item: {order.food_item?.name || 'N/A'} (Qty: {order.quantity})
                                      </p>
                                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                                    </div>
                                  ))}
                                  {hotelOrders.length === 0 && (
                                    <p className="text-sm text-gray-500">No hotel orders</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Orders Table */}
                            {(laundryOrders.length > 0 || hotelOrders.length > 0) && (
                              <div className="mt-6">
                                <Tabs defaultValue="laundry">
                                  <TabsList className="mb-4">
                                    <TabsTrigger value="laundry" className="flex items-center gap-2">
                                      <ShoppingBag className="h-4 w-4" />
                                      Laundry Orders ({laundryOrders.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="hotel" className="flex items-center gap-2">
                                      <Store className="h-4 w-4" />
                                      Hotel Orders ({hotelOrders.length})
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="laundry">
                                    {laundryOrders.length > 0 ? (
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Order Code</TableHead>
                                              <TableHead>Customer</TableHead>
                                              <TableHead>Shop</TableHead>
                                              <TableHead>Total</TableHead>
                                              <TableHead>Paid</TableHead>
                                              <TableHead>Status</TableHead>
                                              <TableHead>Payment</TableHead>
                                              <TableHead>Delivery Date</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {laundryOrders.map((order) => (
                                              <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                  {order.uniquecode}
                                                </TableCell>
                                                <TableCell>
                                                  <div>
                                                    <p>{order.customer?.name || 'Unknown Customer'}</p>
                                                    <p className="text-xs text-gray-500">{order.customer?.phone || 'No phone'}</p>
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  <Badge variant="outline">{order.shop}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                  KSh {parseFloat(order.total_price || '0').toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                  KSh {parseFloat(order.amount_paid || '0').toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                  <Badge className={getOrderStatusColor(order.order_status)}>
                                                    {order.order_status}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  <div className="flex flex-col gap-1">
                                                    <Badge className={getPaymentStatusColor(order.payment_status)}>
                                                      {order.payment_status}
                                                    </Badge>
                                                    <span className="text-xs text-gray-500">{order.payment_type}</span>
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  {new Date(order.delivery_date).toLocaleDateString()}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    ) : (
                                      <div className="text-center py-8 text-gray-500">
                                        No laundry orders found
                                      </div>
                                    )}
                                  </TabsContent>

                                  <TabsContent value="hotel">
                                    {hotelOrders.length > 0 ? (
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Order ID</TableHead>
                                              <TableHead>Food Item</TableHead>
                                              <TableHead>Category</TableHead>
                                              <TableHead>Quantity</TableHead>
                                              <TableHead>Price</TableHead>
                                              <TableHead>Total</TableHead>
                                              <TableHead>Created At</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {hotelOrders.map((order) => (
                                              <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                  #{order.id}
                                                </TableCell>
                                                <TableCell>
                                                  <div>
                                                    <p className="font-medium">{order.food_item?.name || 'N/A'}</p>
                                                    {order.food_item?.created_by && (
                                                      <p className="text-xs text-gray-500">
                                                        Created by: {order.food_item.created_by.email}
                                                      </p>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  {order.food_item?.category?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                  {order.quantity}
                                                </TableCell>
                                                <TableCell>
                                                  KSh {parseFloat(order.price || '0').toFixed(2)}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                  KSh {parseFloat(order.total_price || '0').toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                  {formatDate(order.created_at)}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    ) : (
                                      <div className="text-center py-8 text-gray-500">
                                        No hotel orders found
                                      </div>
                                    )}
                                  </TabsContent>
                                </Tabs>
                              </div>
                            )}

                            <div className="mt-4 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setIsUserDetailsOpen(true);
                                }}
                              >
                                <History className="h-4 w-4 mr-2" />
                                View Full Activity History
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => window.open(`/orders?created_by=${user.id}`, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View All Orders
                              </Button>
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
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Site Activity</CardTitle>
              <CardDescription>
                Track all page visits and user interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visitsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : pageVisits.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-sm font-medium text-gray-900">No activity recorded</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    User activity will appear here once users start browsing the site
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Page</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageVisits.map((visit: any) => (
                        <TableRow key={visit.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {visit.user_email?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{visit.user_email || 'Unknown User'}</p>
                                <p className="text-xs text-gray-500">User ID: {visit.user}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{visit.page_title || 'No title'}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">{visit.page_url || 'No URL'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{formatDate(visit.timestamp)}</p>
                              <p className="text-xs text-gray-500">{formatTimeAgo(visit.timestamp)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {Math.round(visit.duration_seconds || 0)}s
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {visit.ip_address || 'N/A'}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE User Dialog */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the required permissions. The password will be securely hashed by the server.
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
                className={formErrors.create?.email ? "border-red-500" : ""}
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
                  className={formErrors.create?.password ? "border-red-500" : ""}
                />
                {formErrors.create?.password && (
                  <p className="text-sm text-red-500">{formErrors.create.password}</p>
                )}
                <p className="text-xs text-gray-500">
                  Must be at least 8 characters with uppercase, lowercase, and numbers
                </p>
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
                  className={formErrors.create?.confirm_password ? "border-red-500" : ""}
                />
                {formErrors.create?.confirm_password && (
                  <p className="text-sm text-red-500">{formErrors.create.confirm_password}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_type">User Type</Label>
              <Select
                value={newUser.user_type}
                onValueChange={(value) => setNewUser({ ...newUser, user_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_staff"
                  checked={newUser.is_staff}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, is_staff: checked })}
                />
                <Label htmlFor="is_staff">Staff Member</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newUser.is_active}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
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
                className={formErrors.edit?.email ? "border-red-500" : ""}
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
                className={formErrors.edit?.password ? "border-red-500" : ""}
              />
              {formErrors.edit?.password && (
                <p className="text-sm text-red-500">{formErrors.edit.password}</p>
              )}
              <p className="text-xs text-gray-500">
                If provided, must be at least 8 characters with uppercase, lowercase, and numbers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_user_type">User Type</Label>
              <Select
                value={editUser.user_type || 'staff'}
                onValueChange={(value) => setEditUser({ ...editUser, user_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_staff"
                  checked={editUser.is_staff || false}
                  onCheckedChange={(checked) => setEditUser({ ...editUser, is_staff: checked })}
                />
                <Label htmlFor="edit_is_staff">Staff Member</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={editUser.is_active || true}
                  onCheckedChange={(checked) => setEditUser({ ...editUser, is_active: checked })}
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={updateUserMutation.isPending}
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
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
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

      {/* User Details Dialog */}
      <Dialog open={isUserDetailsOpen} onOpenChange={setIsUserDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Activity Details</DialogTitle>
          </DialogHeader>

          {selectedUserId && (() => {
            const user = users.find(u => u.id === selectedUserId);
            if (!user) return null;

            const userVisits = pageVisits.filter((visit: any) => visit.user === selectedUserId);

            return (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.email}
                      </h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Recent Page Visits</h4>
                  {userVisits.length > 0 ? (
                    <div className="space-y-2">
                      {userVisits.map((visit: any) => (
                        <div key={visit.id} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{visit.page_title || 'No title'}</p>
                              <p className="text-sm text-gray-600 truncate max-w-2xl">
                                {visit.page_url || 'No URL'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatDate(visit.timestamp)}</p>
                              <p className="text-xs text-gray-500">
                                Duration: {Math.round(visit.duration_seconds || 0)}s
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                            <code className="bg-gray-100 px-2 py-1 rounded">
                              IP: {visit.ip_address || 'N/A'}
                            </code>
                            <span>Session: {visit.session_id?.substring(0, 8) || 'Unknown'}...</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No page visits recorded for this user
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}