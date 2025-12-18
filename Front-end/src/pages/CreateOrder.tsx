import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Customer, createorderpayload, OrderItem } from '@/services/types'
import { API_BASE_URL } from '../services/url'
import { getAccessToken } from "@/services/api";
import { get } from "https";

// --- API Endpoints ---
const ORDERS_URL = `${API_BASE_URL}/Laundry/orders/`;
const CUSTOMERS_URL = `${API_BASE_URL}/Laundry/customers/`;
const token = getAccessToken()

// --- Constants & Form Types ---
const SERVICE_TYPES = [
  { value: 'Washing', label: 'Washing' },
  { value: 'Ironing', label: 'Ironing' },
  { value: 'Folding', label: 'Folding' },
  { value: 'Dry cleaning', label: 'Dry cleaning' }
];

const ITEM_TYPES = [
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Bedding', label: 'Bedding' },
  { value: 'Household items', label: 'Household items' },
  { value: 'Footwares', label: 'Footwares' }
];

const CONDITIONS = [
  { value: 'New', label: 'New' },
  { value: 'Old', label: 'Old' },
  { value: 'Torn', label: 'Torn' }
];

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'mPesa', label: 'M-Pesa' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
  { value: 'None', label: 'None' }
];

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' }
];

interface FormOrderItem {
  servicetype: string[];
  itemtype: string;
  itemname: string;
  quantity: number;
  itemcondition: string;
  additional_info: string;
  unit_price: number;
}

// Custom MultiSelect Dropdown Component
interface MultiSelectDropdownProps {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCheckboxChange = (value: string, checked: boolean) => {
    let newSelected = [...selectedValues];
    if (checked) {
      if (!newSelected.includes(value)) {
        newSelected.push(value);
      }
    } else {
      newSelected = newSelected.filter(v => v !== value);
    }
    onChange(newSelected);
  };

  const handleClear = () => {
    onChange([]);
  };

  const handleSelectAll = () => {
    onChange(options.map(opt => opt.value));
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === options.length) return "All services selected";
    const selectedLabels = options
      .filter(opt => selectedValues.includes(opt.value))
      .map(opt => opt.label);
    return selectedLabels.join(', ');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className="truncate text-left">{getDisplayText()}</span>
        <span className="ml-2">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 space-y-1">
            {/* Select All / Clear All buttons */}
            <div className="flex justify-between px-2 py-1 border-b">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
            </div>

            {/* Checkbox Options */}
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded"
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => 
                    handleCheckboxChange(option.value, checked as boolean)
                  }
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}

            {/* Show selected count */}
            <div className="px-2 py-1 border-t text-xs text-gray-500">
              {selectedValues.length} of {options.length} selected
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function CreateOrder() {
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [shop, setShop] = useState<"Shop A" | "Shop B">("Shop A");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [address, setAddress] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [amountPaid, setAmountPaid] = useState(0);
  const [items, setItems] = useState<FormOrderItem[]>([{
    servicetype: [], itemtype: '', itemname: '', quantity: 1, itemcondition: '', additional_info: '', unit_price: 0,
  }]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);

  // Debug URLs
  useEffect(() => {
    console.log("API Endpoints:");
    console.log("CUSTOMERS_URL:", CUSTOMERS_URL);
    console.log("ORDERS_URL:", ORDERS_URL);
  }, []);

  const totalPrice = useMemo(() => {
    return items.reduce((sum, it) => sum + Number(it.unit_price), 0);
  }, [items]);

  const balance = useMemo(() => {
    return Math.max(0, totalPrice - amountPaid);
  }, [totalPrice, amountPaid]);

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // --- Item Management Callbacks ---
  const addItem = useCallback(() => {
    setItems(prev => [...prev, {
      servicetype: [], itemtype: '', itemname: '', quantity: 1, itemcondition: '', additional_info: '', unit_price: 0,
    }]);
  }, []);

  const updateItem = useCallback((index: number, field: keyof FormOrderItem, value: any) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }, []);

  // Handle service type selection from dropdown
  const handleServiceTypeChange = useCallback((index: number, selectedValues: string[]) => {
    updateItem(index, 'servicetype', selectedValues);
  }, [updateItem]);

  const removeItem = useCallback((index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  }, [items.length]);

  // --- API Call Functions ---
  const findCustomerByPhone = async (phone: string): Promise<Customer | null> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      console.log("Searching customer with phone:", formattedPhone);
      
      const response = await fetch(CUSTOMERS_URL, {
        headers: { 
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch customers:", errorText);
        throw new Error(`Failed to fetch customers: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Customers data:", data);
      
      let customers: Customer[] = [];
      if (Array.isArray(data)) {
        customers = data;
      } else if (data.results && Array.isArray(data.results)) {
        customers = data.results;
      }
      
      const foundCustomer = customers.find(customer => {
        const customerPhone = customer.phone?.toString() || '';
        const searchPhone = formattedPhone.replace(/\D/g, '');
        const custPhoneDigits = customerPhone.replace(/\D/g, '');
        
        return custPhoneDigits === searchPhone || 
               customerPhone === phone ||
               customerPhone === formattedPhone;
      });
      
      return foundCustomer || null;
    } catch (err: any) {
      console.error("Customer search failed:", err);
      setError("Failed to search for customer. Please try again.");
      return null;
    }
  };

  const createNewCustomer = async (name: string, phone: string): Promise<Customer | null> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      
      console.log("Creating customer with:", { name, phone: formattedPhone });
      
      const response = await fetch(CUSTOMERS_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          name, 
          phone: formattedPhone
        }),
      });

      const responseText = await response.text();
      console.log("Customer creation response:", responseText);
      
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<')) {
        throw new Error('Server returned HTML. Check API endpoint.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        console.error("API error response:", data);
        const errorMessage = data.phone?.[0] || 
                           data.name?.[0] || 
                           data.detail || 
                           data.non_field_errors?.[0] ||
                           `Failed to create customer: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      console.log("Customer created successfully:", data);
      return data as Customer;
    } catch (err: any) {
      console.error("Customer creation failed:", err.message);
      setError(err.message || "Failed to create new customer.");
      return null;
    }
  };

  // --- Primary Logic ---
  const handleCustomerLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone) {
      setError("Please enter a phone number to search.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const existingCustomer = await findCustomerByPhone(customerPhone);
    setIsLoading(false);

    if (existingCustomer) {
      setSelectedCustomer(existingCustomer);
      setCustomerName(existingCustomer.name);
      showToast("Customer found!");
      showStep(2);
    } else {
      if (!customerName.trim()) {
        setError("Customer not found. Please enter a name to create a new customer.");
        return;
      }
      
      setIsLoading(true);
      const newCustomer = await createNewCustomer(customerName.trim(), customerPhone);
      setIsLoading(false);
      
      if (newCustomer) {
        setSelectedCustomer(newCustomer);
        showToast("New customer created successfully!");
        showStep(2);
      }
    }
  };

  const handleOrderSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer) {
      setError("Please find or create a customer before submitting the order.");
      return;
    }
    
    if (!shop) {
      setError("Please select a shop.");
      return;
    }
    
    if (!deliveryDate) {
      setError("Please select a delivery date.");
      return;
    }
    
    if (items.length === 0) {
      setError("Please add at least one item to the order.");
      return;
    }
    
    const invalidItems = items.filter(it => 
      !it.servicetype.length || 
      !it.itemtype || 
      !it.itemcondition
    );
    
    if (invalidItems.length > 0) {
      setError("Please fill all required fields for each item (Service Type, Item Category, and Condition).");
      return;
    }

    setIsLoading(true);
    setError(null);

    const mappedItems = items.map(it => ({
      servicetype: it.servicetype,
      itemtype: it.itemtype as OrderItem['itemtype'],
      itemname: it.itemname || "",
      quantity: Number(it.quantity),
      itemcondition: it.itemcondition as OrderItem['itemcondition'],
      additional_info: it.additional_info || "",
      unit_price: Number(it.unit_price).toFixed(2),
      total_item_price: Number(it.unit_price).toFixed(2)
    }));

    const payload: createorderpayload = {
      customer_id: selectedCustomer.id,
      shop: shop,
      delivery_date: deliveryDate,
      addressdetails: address || "",
      payment_type: paymentType || "None",
      payment_status: paymentStatus,
      amount_paid: Number(amountPaid).toFixed(2),
      total_price: totalPrice.toFixed(2),
      items: mappedItems,
    };

    console.log("Submitting order payload:", JSON.stringify(payload, null, 2));
    console.log("URL:", ORDERS_URL);

    try {
      const response = await fetch(ORDERS_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...token ? { 'Authorization': `Bearer ${token}` } : {}
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Order response status:", response.status);
      console.log("Order response text:", responseText);

      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<')) {
        throw new Error('Server returned HTML instead of JSON. Check API endpoint.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse order response:", responseText);
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        console.error("Order submission error details:", data);
        
        let errorMsg = "Order submission failed.";
        
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMsg = data.non_field_errors.join(", ");
        } else if (typeof data === 'object') {
          const errorEntries = Object.entries(data);
          if (errorEntries.length > 0) {
            const [field, errors] = errorEntries[0];
            if (Array.isArray(errors) && errors.length > 0) {
              errorMsg = `${field}: ${errors[0]}`;
            } else if (typeof errors === 'string') {
              errorMsg = `${field}: ${errors}`;
            }
          }
        }
        
        throw new Error(errorMsg);
      }

      const orderCode = data.uniquecode || data.order_number || data.id || "N/A";
      showToast(`Order ${orderCode} created successfully!`);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      console.error("API Error:", err);
      setError(err.message || "An unknown error occurred during order submission.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCustomer, shop, deliveryDate, address, paymentType, paymentStatus, amountPaid, totalPrice, items, showToast]);

  const showStep = useCallback((stepNumber: number) => {
    setCurrentStep(stepNumber);
    setError(null);
  }, []);

  // Format phone number to +254 format
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      return `+254${cleaned}`;
    } else if (cleaned.length === 9) {
      return `+254${cleaned}`;
    }
    
    return phone;
  };

  // Calculate tomorrow's date for min date
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 border border-gray-100 mt-4 sm:mt-6 lg:mt-10">
        {/* Progress Steps */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="flex items-center space-x-2 sm:space-x-4 max-w-full overflow-x-auto px-2 py-2">
            {/* Step 1 */}
            <div className="flex items-center flex-shrink-0">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm ${currentStep >= 1 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"}`}>
                {currentStep > 1 ? "✓" : "1"}
              </div>
              <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${currentStep >= 1 ? "text-blue-600" : "text-gray-500"} hidden xs:inline`}>Customer</span>
            </div>
            <div className="w-6 sm:w-8 h-1 bg-gray-300 flex-shrink-0"></div>

            {/* Step 2 */}
            <div className="flex items-center flex-shrink-0">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm ${currentStep >= 2 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"}`}>
                {currentStep > 2 ? "✓" : "2"}
              </div>
              <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${currentStep >= 2 ? "text-blue-600" : "text-gray-500"} hidden xs:inline`}>Order Details</span>
            </div>
            <div className="w-6 sm:w-8 h-1 bg-gray-300 flex-shrink-0"></div>

            {/* Step 3 */}
            <div className="flex items-center flex-shrink-0">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm ${currentStep >= 3 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"}`}>
                {currentStep > 3 ? "✓" : "3"}
              </div>
              <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${currentStep >= 3 ? "text-blue-600" : "text-gray-500"} hidden xs:inline`}>Items</span>
            </div>
            <div className="w-6 sm:w-8 h-1 bg-gray-300 flex-shrink-0"></div>

            {/* Step 4 */}
            <div className="flex items-center flex-shrink-0">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm ${currentStep >= 4 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"}`}>
                4
              </div>
              <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${currentStep >= 4 ? "text-blue-600" : "text-gray-500"} hidden xs:inline`}>Payment</span>
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs sm:max-w-sm mx-auto sm:mx-0 z-50">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              {toastMessage}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Customer Information */}
        {currentStep === 1 && (
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">Customer Information</h1>
            <form onSubmit={handleCustomerLookup} className="space-y-4 sm:space-y-5 p-2 sm:p-4">
              <div>
                <Label className="block text-sm font-medium text-gray-700">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer full name"
                  required
                  className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 transition duration-150 text-sm sm:text-base"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomerPhone(value);
                    setSelectedCustomer(null);
                  }}
                  placeholder="0712345678 or 254712345678"
                  required
                  className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 transition duration-150 text-sm sm:text-base"
                />
                <p className="text-xs text-gray-500 mt-1">Enter phone number in any format</p>
              </div>
              
              {selectedCustomer && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">Customer Selected:</p>
                      <p className="text-sm text-green-700">{selectedCustomer.name} - {selectedCustomer.phone}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerPhone("");
                      }}
                      className="text-xs bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end mt-4 sm:mt-6">
                <Button
                  type="submit"
                  disabled={isLoading || !customerPhone || !customerName.trim()}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow transition duration-200 text-sm sm:text-base"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : "Next →"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Order Details */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Order Details</h2>
            <form className="space-y-4 sm:space-y-6 p-2 sm:p-4">
              {selectedCustomer && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Customer:</p>
                  <p className="text-sm text-blue-700">{selectedCustomer.name} - {selectedCustomer.phone}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-700">
                    Shop <span className="text-red-500">*</span>
                  </Label>
                  <Select value={shop} onValueChange={(value: "Shop A" | "Shop B") => setShop(value)} required>
                    <SelectTrigger className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 text-sm sm:text-base">
                      <SelectValue placeholder="-- Select Shop --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shop A">Shop A</SelectItem>
                      <SelectItem value="Shop B">Shop B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700">
                    Delivery/Picked Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={getTomorrowDate()}
                    required
                    className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700">Delivery/Pick Address (Optional)</Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Enter delivery or pickup address (optional)"
                  className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 text-sm sm:text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4 sm:mt-6">
                <Button
                  onClick={() => showStep(1)}
                  type="button"
                  className="order-2 sm:order-1 px-4 sm:px-6 py-2.5 rounded-lg bg-gray-300 text-gray-700 font-medium hover:bg-gray-400 transition duration-200 text-sm sm:text-base"
                >
                  ← Back
                </Button>
                <Button
                  onClick={() => {
                    if (!shop || !deliveryDate) {
                      setError("Please select a shop and delivery date");
                      return;
                    }
                    showStep(3);
                  }}
                  type="button"
                  className="order-1 sm:order-2 px-4 sm:px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow transition duration-200 text-sm sm:text-base"
                >
                  Next →
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Items */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Order Items</h2>
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <h3 className="text-md font-semibold text-gray-700">Add Items to Order</h3>
                <Button
                  onClick={addItem}
                  type="button"
                  className="w-full sm:w-auto text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 sm:py-1.5 rounded-md shadow-sm transition duration-150"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="text-sm text-gray-600 mb-4">
                <p>Fill in all required fields for each item. Required fields are marked with <span className="text-red-500">*</span></p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 p-2 sm:p-4">
                {items.map((it, index) => (
                  <div key={index} className="item-row border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-700">Item #{index + 1}</h4>
                      {items.length > 1 && (
                        <Button
                          onClick={() => removeItem(index)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                          type="button"
                        >
                          <Trash className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    {/* Service Type Dropdown with Checkboxes */}
                    <div className="mb-4">
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Service Type <span className="text-red-500">*</span>
                      </Label>
                      <MultiSelectDropdown
                        options={SERVICE_TYPES}
                        selectedValues={it.servicetype}
                        onChange={(selected) => handleServiceTypeChange(index, selected)}
                        placeholder="Select service types..."
                      />
                      {it.servicetype.length === 0 && (
                        <p className="text-xs text-red-500 mt-2">Please select at least one service type</p>
                      )}
                      {it.servicetype.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Selected: {it.servicetype.length} service(s) selected
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                          Item Category <span className="text-red-500">*</span>
                        </Label>
                        <Select 
                          value={it.itemtype} 
                          onValueChange={(value) => updateItem(index, 'itemtype', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="-- Select Category --" />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                          Condition <span className="text-red-500">*</span>
                        </Label>
                        <Select 
                          value={it.itemcondition} 
                          onValueChange={(value) => updateItem(index, 'itemcondition', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="-- Select Condition --" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITIONS.map(condition => (
                              <SelectItem key={condition.value} value={condition.value}>
                                {condition.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                          Item Names
                        </Label>
                        <Input
                          value={it.itemname}
                          onChange={(e) => updateItem(index, 'itemname', e.target.value)}
                          placeholder="e.g., Shirts, Trousers, Dresses"
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Comma-separated if multiple</p>
                      </div>
                      
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value) || 1)}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Price (KES)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value) || 0)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Information (Optional)
                      </Label>
                      <Input
                        value={it.additional_info}
                        onChange={(e) => updateItem(index, 'additional_info', e.target.value)}
                        placeholder="Any special instructions or notes"
                        className="w-full"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Selected services: <span className="font-medium">{it.servicetype.length} service(s)</span>
                      </div>
                      <div className="text-sm font-medium">
                        Item price: <span className="text-blue-600">KES {Number(it.unit_price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total Price Preview */}
              <div className="p-4 bg-gray-100 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Estimated Total:</span>
                  <span className="text-xl font-bold text-blue-600">KES {totalPrice.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4 sm:mt-6">
                <Button
                  onClick={() => showStep(2)}
                  className="order-2 sm:order-1 px-4 sm:px-6 py-2.5 rounded-lg bg-gray-300 text-gray-700 font-medium hover:bg-gray-400 transition duration-200 text-sm sm:text-base"
                >
                  ← Back
                </Button>
                <Button
                  onClick={() => {
                    if (items.length === 0) {
                      setError("Please add at least one item");
                      return;
                    }
                    const valid = items.every(it => it.servicetype.length > 0 && it.itemtype && it.itemcondition);
                    if (!valid) {
                      setError("Please fill all required fields for each item (Service Type, Item Category, and Condition)");
                      return;
                    }
                    showStep(4);
                  }}
                  className="order-1 sm:order-2 px-4 sm:px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow transition duration-200 text-sm sm:text-base"
                >
                  Next →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Payment Information</h2>
            <form onSubmit={handleOrderSubmit} className="space-y-4 sm:space-y-6 p-2 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-700">Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 text-sm sm:text-base">
                      <SelectValue placeholder="-- Select Payment Type --" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700">Payment Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 text-sm sm:text-base">
                      <SelectValue placeholder="-- Select Status --" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-700">Amount Paid (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalPrice}
                    value={amountPaid}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 0;
                      setAmountPaid(value);
                      
                      if (value === 0) {
                        setPaymentStatus('pending');
                      } else if (value >= totalPrice) {
                        setPaymentStatus('paid');
                      } else {
                        setPaymentStatus('partial');
                      }
                    }}
                    className="mt-1 sm:mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-2 sm:p-3 text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-gray-700 mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>KES {totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className={amountPaid > 0 ? "text-green-600 font-medium" : ""}>
                      KES {amountPaid.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium text-gray-700">Balance:</span>
                    <span className={`font-bold ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                      KES {balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8">
                <Button
                  onClick={() => showStep(3)}
                  type="button"
                  className="order-2 sm:order-1 px-4 sm:px-6 py-2.5 rounded-lg bg-gray-300 text-gray-700 font-medium hover:bg-gray-400 transition duration-200 text-sm sm:text-base"
                >
                  ← Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !selectedCustomer || items.length === 0 || !deliveryDate || !shop}
                  className="order-1 sm:order-2 bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium shadow transition duration-200 text-sm sm:text-base"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Order...
                    </div>
                  ) : "Create Order"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}