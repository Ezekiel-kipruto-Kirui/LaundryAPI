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
import LaundryLanding from "./pages/website";
import { ROUTES } from "./services/Routes";
import UserProfile from "./pages/user-profile";

const queryClient = new QueryClient();

// Types
type ShopType = 'Shop A' | 'Shop B' | null;
type AppShopType = 'laundry' | 'hotel' | null;

// Helper to convert ShopType to AppShopType
const getShopIdFromType = (shopType: ShopType): AppShopType => {
  if (!shopType) return null;

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
  const appSelectedShop = getShopIdFromType(selectedShop);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (userRole === "staff" && !selectedShop) {
    return <Navigate to="/login" replace state={{ needsShopSelection: true }} />;
  }

  if (adminOnly && userRole !== "admin") {
    return <Navigate to="/unauthorized" replace />;
  }

  if (userRole === "staff" && shopType && appSelectedShop !== shopType) {
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

  const getRootRedirect = () => {
    if (!isAuthenticated) {
      return "/home";
    }

    if (userRole === "admin") {
      return ROUTES.dashboard;
    } 
    
    if (userRole === "staff") {
      const appSelectedShop = getShopIdFromType(selectedShop);
      if (appSelectedShop === "laundry") return ROUTES.laundryDashboard;
      if (appSelectedShop === "hotel") return ROUTES.fooditems;
    }

    return "/home"; 
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* 
              PUBLIC LANDING PAGE 
              NO SIDEBAR: Wrapped in a simple div instead of MainLayout.
            */}
            <Route 
              path="/home" 
              element={
                <div className="min-h-screen w-full">
                  <LaundryLanding />
                </div>
              } 
            />

            {/* 
              ROOT REDIRECT (/)
            */}
            <Route 
              path="/" 
              element={<Navigate to={getRootRedirect()} replace />} 
            />

            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* 
              PROTECTED ROUTES 
              Still using MainLayout (which has Sidebar) for these.
            */}
            {isAuthenticated ? (
              <>
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
                    <ProtectedRoute>
                      <MainLayout>
                        <UserProfile />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </>
            ) : (
              <Route path="*" element={<Navigate to="/login" replace />} />
            )}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;