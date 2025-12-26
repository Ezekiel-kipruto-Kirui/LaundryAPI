import { useState, useEffect, useCallback } from "react";
import { FoodItem, FoodCategory, User } from "@/services/types";
import { fetchApi } from "@/services/api";
import { getUserData } from "@/utils/auth";

const FOOD_URL = "food-items/";
const CATEGORIES_URL = "food-categories/";

export default function FoodItems() {
  // Get user from auth utilities instead of AuthContext
  const [user, setUser] = useState<User | null>(null);
  
  // Food Items State
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Categories State
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  
  // Modal States
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [currentFoodItem, setCurrentFoodItem] = useState<FoodItem | null>(null);
  const [currentCategory, setCurrentCategory] = useState<FoodCategory | null>(null);
  
  // Form States
  const [foodFormData, setFoodFormData] = useState({
    name: "",
    category: "", // Changed from category_id to category to match serializer
    total_order_price: "",
    quantity: ""
  });
  
  const [categoryFormData, setCategoryFormData] = useState({
    name: ""
  });

  // Get user data on component mount
  useEffect(() => {
    const userData = getUserData();
    setUser(userData);
  }, []);

  // =========================================================================
  // 1. READ (Fetch Data)
  // =========================================================================

  const fetchFoodItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: FoodItem[] = await fetchApi<FoodItem[]>(
        FOOD_URL,
        { method: 'GET' },
        'hotel'
      );
      setFoodItems(data);
    } catch (err: any) {
      console.error("Fetch Error:", err);
      // Handle unauthorized error specifically
      if (err.message === "Unauthorized") {
        setError("Session expired. Please login again.");
      } else {
        setError(`Failed to fetch food items: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const data: FoodCategory[] = await fetchApi<FoodCategory[]>(
        CATEGORIES_URL,
        { method: 'GET' },
        'hotel'
      );
      setCategories(data);
    } catch (err: any) {
      console.error("Fetch Categories Error:", err);
      if (err.message === "Unauthorized") {
        setError("Session expired. Please login again.");
      } else {
        setError(`Failed to fetch categories: ${err.message}`);
      }
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFoodItems();
    fetchCategories();
  }, [fetchFoodItems, fetchCategories]);

  // =========================================================================
  // 2. FOOD ITEM CRUD OPERATIONS
  // =========================================================================

  const openCreateFoodModal = () => {
    setCurrentFoodItem(null);
    setFoodFormData({
      name: "",
      category: categories.length > 0 ? String(categories[0].id) : "", // FIXED: Use String() instead of toString()
      total_order_price: "",
      quantity: ""
    });
    setIsFoodModalOpen(true);
  };

  const openEditFoodModal = (item: FoodItem) => {
    setCurrentFoodItem(item);
    
    // Extract category ID from item - use 'category' field
    let categoryId = "";
    
    if (item.category) {
      if (typeof item.category === 'object' && item.category !== null && 'id' in item.category) {
        // Safely get id from category object
        const categoryObj = item.category as any;
        categoryId = categoryObj.id !== undefined && categoryObj.id !== null ? String(categoryObj.id) : "";
      } else if (typeof item.category === 'number') {
        categoryId = String(item.category);
      } else if (typeof item.category === 'string') {
        categoryId = item.category;
      }
    }
    
    // Check category_id safely - FIXED ERROR #1
    if (!categoryId && item.category_id !== undefined && item.category_id !== null) {
      categoryId = String(item.category_id);
    }
    
    // Handle total_order_price safely
    const totalOrderPrice = typeof item.total_order_price === 'string' 
      ? item.total_order_price 
      : (item.total_order_price || 0).toString();
    
    setFoodFormData({
      name: item.name,
      category: categoryId,
      total_order_price: totalOrderPrice,
      quantity: item.quantity?.toString() || "0"
    });
    setIsFoodModalOpen(true);
  };

  const handleFoodInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFoodFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFoodSave = async () => {
    // Basic validation
    if (!foodFormData.name.trim() || !foodFormData.category || !foodFormData.total_order_price) {
      setError("Please fill in all required fields (Name, Category, and Total Revenue)");
      return;
    }

    // Check if user is authenticated for create operations
    if (!currentFoodItem && !user?.id) {
      setError("You must be logged in to create food items");
      return;
    }

    try {
      setLoading(true);
      
      // Parse values safely
      const totalOrderPrice = parseFloat(foodFormData.total_order_price);
      const quantity = parseInt(foodFormData.quantity) || 0;
      
      if (isNaN(totalOrderPrice) || totalOrderPrice < 0) {
        setError("Please enter a valid total revenue");
        return;
      }

      // Prepare data with correct field names matching serializer
      const foodData: any = {
        name: foodFormData.name,
        category: parseInt(foodFormData.category), // Use 'category' not 'category_id'
        total_order_price: totalOrderPrice.toFixed(2), // Ensure 2 decimal places
        quantity: quantity
      };

      // Add created_by for new items or if required for updates
      if (!currentFoodItem && user?.id) {
        // For create operations
        foodData.created_by = user.id;
      } else if (currentFoodItem) {
        // For update operations, include created_by if it was set before
        // Or let the backend handle it
        if (currentFoodItem.created_by?.id) {
          foodData.created_by = currentFoodItem.created_by.id;
        }
      }

      console.log("Sending food data:", foodData); // Debug log

      if (currentFoodItem) {
        // Update existing food item
        await fetchApi<FoodItem>(
          `${FOOD_URL}${currentFoodItem.id}/`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(foodData)
          },
          'hotel'
        );
      } else {
        // Create new food item
        await fetchApi<FoodItem>(
          FOOD_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(foodData)
          },
          'hotel'
        );
      }

      setIsFoodModalOpen(false);
      fetchFoodItems(); // Refresh the list
      setError(null);
    } catch (err: any) {
      console.error("Save Error:", err);
      if (err.message === "Unauthorized") {
        setError("Session expired. Please login again.");
      } else {
        setError(err.message || "Failed to save food item");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFoodDelete = async (itemId: number) => {
    if (!window.confirm(`Are you sure you want to delete this food item?`)) {
      return;
    }

    try {
      setLoading(true);
      await fetchApi<void>(
        `${FOOD_URL}${itemId}/`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        'hotel'
      );

      setFoodItems(prevItems => prevItems.filter(item => item.id !== itemId));
      setError(null);
    } catch (err: any) {
      console.error("Delete Error:", err);
      if (err.message === "Unauthorized") {
        setError("Session expired. Please login again.");
      } else {
        setError(err.message || "Failed to delete food item");
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 3. CATEGORY CRUD OPERATIONS
  // =========================================================================

  const openCreateCategoryModal = () => {
    setCurrentCategory(null);
    setCategoryFormData({ name: "" });
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category: FoodCategory) => {
    setCurrentCategory(category);
    setCategoryFormData({ name: category.name });
    setIsCategoryModalOpen(true);
  };

  const handleCategoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategoryFormData({
      name: e.target.value
    });
  };

  const handleCategorySave = async () => {
    if (!categoryFormData.name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setLoading(true);
      
      if (currentCategory) {
        // Update existing category
        await fetchApi<FoodCategory>(
          `${CATEGORIES_URL}${currentCategory.id}/`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: categoryFormData.name })
          },
          'hotel'
        );
      } else {
        // Create new category
        await fetchApi<FoodCategory>(
          CATEGORIES_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: categoryFormData.name })
          },
          'hotel'
        );
      }

      setIsCategoryModalOpen(false);
      fetchCategories(); // Refresh categories
      fetchFoodItems(); // Refresh food items to update category references
      setError(null);
    } catch (err: any) {
      console.error("Category Save Error:", err);
      if (err.message === "Unauthorized") {
        setError("Session expired. Please login again.");
      } else {
        setError(err.message || "Failed to save category");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryDelete = async (categoryId: number) => {
    // Check if any food items use this category
    const itemsUsingCategory = foodItems.filter(item => {
      // Check category field (could be object, number, or string)
      if (item.category) {
        if (typeof item.category === 'object' && item.category !== null && 'id' in item.category) {
          const categoryObj = item.category as any;
          return categoryObj.id === categoryId;
        }
        if (typeof item.category === 'number') {
          return item.category === categoryId;
        }
        if (typeof item.category === 'string') {
          return parseInt(item.category) === categoryId;
        }
      }
      
      // Check category_id field - FIXED ERROR #2
      if (item.category_id !== undefined && item.category_id !== null) {
        if (typeof item.category_id === 'number') {
          return item.category_id === categoryId;
        }
        if (typeof item.category_id === 'string') {
          return parseInt(item.category_id) === categoryId;
        }
      }
      
      return false;
    });
    
    if (itemsUsingCategory.length > 0) {
      setError(`Cannot delete category. ${itemsUsingCategory.length} food item(s) are using it.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this category?`)) {
      return;
    }

    try {
      setLoading(true);
      await fetchApi<void>(
        `${CATEGORIES_URL}${categoryId}/`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        'hotel'
      );

      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      setError(null);
    } catch (err: any) {
      console.error("Category Delete Error:", err);
      if (err.message === "Unauthorized") {
        setError("Session expired. Please login again.");
      } else {
        setError(err.message || "Failed to delete category");
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get creator name safely
  const getCreatorName = (createdBy: User | undefined): string => {
    if (!createdBy) return 'Unknown';
    if (createdBy.first_name || createdBy.last_name) {
      return `${createdBy.first_name || ''} ${createdBy.last_name || ''}`.trim();
    }
    return createdBy.email || 'Unknown';
  };

  // Helper function to parse price safely
  const parsePrice = (price: string | number | undefined): number => {
    if (!price) return 0;
    if (typeof price === 'number') return price;
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper function to get category name
  const getCategoryName = (item: FoodItem): string => {
    if (item.category) {
      if (typeof item.category === 'object' && item.category !== null && 'name' in item.category) {
        return (item.category as any).name;
      }
      // If category is just an ID, find the category object
      // if (typeof item.category === 'number') {
      //   const category = categories.find(cat => cat.id === item.category);
      //   return category?.name || `Category ${item.category}`;
      // }
      if (typeof item.category === 'string') {
        const categoryId = parseInt(item.category);
        if (!isNaN(categoryId)) {
          const category = categories.find(cat => cat.id === categoryId);
          return category?.name || `Category ${item.category}`;
        }
        return item.category;
      }
    }
    if (item.category_id !== undefined && item.category_id !== null) {
      const categoryId = typeof item.category_id === 'number' ? item.category_id : parseInt(item.category_id);
      if (!isNaN(categoryId)) {
        const category = categories.find(cat => cat.id === categoryId);
        return category?.name || `Category ${item.category_id}`;
      }
    }
    return 'Uncategorized';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">🍽️ Food Management</h1>
          <div className="flex space-x-3">
            <button
              onClick={openCreateCategoryModal}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg shadow hover:bg-green-700 transition duration-200"
            >
              <i className="fas fa-tag mr-2"></i> Add Category
            </button>
            <button
              onClick={openCreateFoodModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700 transition duration-200"
            >
              <i className="fas fa-plus mr-2"></i> Add Food Item
            </button>
          </div>
        </div>

        {/* Categories Section */}
        <div className="mb-8 bg-white shadow-md rounded-lg p-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">📁 Food Categories</h2>
          {categoriesLoading ? (
            <div className="text-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading categories...</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="font-medium text-gray-800">{category.name}</span>
                  <div className="ml-3 flex space-x-1">
                    <button
                      onClick={() => openEditCategoryModal(category)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      onClick={() => handleCategoryDelete(category.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-gray-500 italic">No categories found. Add your first category!</p>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg border border-red-300">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}

        {/* Food Items Table */}
        {loading && foodItems.length === 0 ? (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-3 text-lg">Loading food items...</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="w-full min-w-full border-collapse">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Category</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">Total Revenue</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Quantity Sold</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {foodItems.length > 0 ? (
                  foodItems.map((item) => {
                    const price = parsePrice(item.total_order_price);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-semibold text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 text-gray-600">
                          {getCategoryName(item)}
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-right font-medium">
                          Ksh {price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-center">{item.quantity || 0}</td>
                        <td className="px-6 py-4 flex justify-center space-x-2">
                          <button
                            onClick={() => openEditFoodModal(item)}
                            className="px-3 py-2 text-xs font-medium text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleFoodDelete(item.id)}
                            className="px-3 py-2 text-xs font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-600 hover:text-white transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-yellow-700 bg-yellow-50 rounded-lg">
                      No food items found.
                      <button
                        onClick={openCreateFoodModal}
                        className="text-indigo-600 font-semibold hover:underline ml-1"
                      >
                        Add your first item
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Food Item Modal */}
        {isFoodModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {currentFoodItem ? 'Edit Food Item' : 'Create Food Item'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={foodFormData.name}
                    onChange={handleFoodInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter food item name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={foodFormData.category}
                    onChange={handleFoodInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Revenue *
                    </label>
                    <input
                      type="number"
                      name="total_order_price"
                      value={foodFormData.total_order_price}
                      onChange={handleFoodInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Total money generated by this item</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity Sold
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={foodFormData.quantity}
                      onChange={handleFoodInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Total units sold</p>
                  </div>
                </div>

                {!user?.id && !currentFoodItem && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      Note: You need to be logged in to create food items.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsFoodModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFoodSave}
                  disabled={loading || (!currentFoodItem && !user?.id)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Modal */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {currentCategory ? 'Edit Category' : 'Create Category'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={categoryFormData.name}
                    onChange={handleCategoryInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter category name"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCategorySave}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}