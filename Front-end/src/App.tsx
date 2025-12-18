import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { getAccessToken, getUserRole, getSelectedShop } from "@/utils/auth";
import CreateOrder from "./pages/CreateOrder";
import Orders from "./pages/Orders";
import HotelOrders from "./pages/HotelOrders";
import HotelExpenses from "./pages/HotelExpenses";
import Expenses from "./pages/Expenses";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PerformanceReport from "./pages/PerformanceReport";
import SiteManagement from "./pages/SiteManagement";
import LaundryDashboard from "./pages/LaundryDashboard";
import CustomersPage from "./pages/Customers";
import FoodItems from "./pages/foodItemspage";
import Dashboard from "./pages/Maindashboard";
import { ROUTES } from "./services/Routes";
import UserProfile from "./pages/user-profile";

const queryClient = new QueryClient();

// Types
type ShopType = 'Shop A' | 'Shop B' | null;
type AppShopType = 'laundry' | 'hotel' | null;

// Helper to convert ShopType to AppShopType
const getShopIdFromType = (shopType: ShopType): AppShopType => {
  if (!shopType) return null;

  // Map your shop types to section IDs
  const shopMapping: Record<string, 'laundry' | 'hotel'> = {
    'Shop A': 'laundry',
    'Shop B': 'hotel',
  };

  return shopMapping[shopType] || null;
};

// Protected Route wrapper with role-based access control
interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  shopType?: "laundry" | "hotel";
}

const ProtectedRoute = ({
  children,
  adminOnly = false,
  shopType
}: ProtectedRouteProps) => {
  const token = getAccessToken();
  const userRole = getUserRole();
  const selectedShop = getSelectedShop();

  // Convert selectedShop to app shop type
  const appSelectedShop = getShopIdFromType(selectedShop);

  // If not authenticated, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If user is staff and hasn't selected a shop, redirect to login to select shop
  if (userRole === "staff" && !selectedShop) {
    return <Navigate to="/login" replace state={{ needsShopSelection: true }} />;
  }

  // Check admin access
  if (adminOnly && userRole !== "admin") {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check shop access for staff
  if (userRole === "staff" && shopType && appSelectedShop !== shopType) {
    // Redirect staff to their assigned shop's dashboard
    if (appSelectedShop === "laundry") {
      return <Navigate to={ROUTES.laundryDashboard} replace />;
    } else if (appSelectedShop === "hotel") {
      return <Navigate to={ROUTES.fooditems} replace />;
    }
  }

  return <>{children}</>;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "staff" | null>(null);
  const [selectedShop, setSelectedShop] = useState<ShopType>(null);

  useEffect(() => {
    const token = getAccessToken();
    const role = getUserRole();
    const shop = getSelectedShop();

    setIsAuthenticated(!!token);
    setUserRole(role);
    setSelectedShop(shop);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Helper to get the initial route based on user role and shop
  const getInitialRoute = () => {
    if (!userRole) return "/login";

    if (userRole === "admin") {
      return ROUTES.dashboard;
    } else if (userRole === "staff") {
      const appSelectedShop = getShopIdFromType(selectedShop);
      if (appSelectedShop === "laundry") {
        return ROUTES.laundryDashboard;
      } else if (appSelectedShop === "hotel") {
        return ROUTES.fooditems;
      }
    }

    return "/login";
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            {isAuthenticated ? (
              <>
                {/* Root redirect */}
                <Route
                  path="/"
                  element={<Navigate to={getInitialRoute()} replace />}
                />

                {/* Admin routes */}
                <Route
                  path={ROUTES.dashboard}
                  element={
                    <ProtectedRoute adminOnly>
                      <MainLayout>
                        <Dashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.reports}
                  element={
                    <ProtectedRoute adminOnly>
                      <MainLayout>
                        <PerformanceReport />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.siteManagement}
                  element={
                    <ProtectedRoute adminOnly>
                      <MainLayout>
                        <SiteManagement />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Laundry routes */}
                <Route
                  path={ROUTES.laundryDashboard}
                  element={
                    <ProtectedRoute shopType="laundry">
                      <MainLayout>
                        <LaundryDashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.laundryCreateOrder}
                  element={
                    <ProtectedRoute shopType="laundry">
                      <MainLayout>
                        <CreateOrder />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.laundryOrders}
                  element={
                    <ProtectedRoute shopType="laundry">
                      <MainLayout>
                        <Orders />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.laundryCustomers}
                  element={
                    <ProtectedRoute shopType="laundry">
                      <MainLayout>
                        <CustomersPage />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.laundryExpenses}
                  element={
                    <ProtectedRoute shopType="laundry">
                      <MainLayout>
                        <Expenses />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Hotel routes */}
                <Route
                  path={ROUTES.fooditems}
                  element={
                    <ProtectedRoute shopType="hotel">
                      <MainLayout>
                        <FoodItems />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.hotelOrders}
                  element={
                    <ProtectedRoute shopType="hotel">
                      <MainLayout>
                        <HotelOrders />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.hotelExpenses}
                  element={
                    <ProtectedRoute shopType="hotel">
                      <MainLayout>
                        <HotelExpenses />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.userprofile}
                  element={
                   
                      <MainLayout>
                        <UserProfile />
                      </MainLayout>
                   
                  }
                />

                {/* Catch-all for authenticated users */}
                <Route path="*" element={<NotFound />} />
              </>
            ) : (
              /* Unauthenticated users get redirected to login */
              <Route path="*" element={<Navigate to="/login" replace />} />
            )}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;