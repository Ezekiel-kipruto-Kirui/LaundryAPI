import * as React from "react";
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, getUserRole, getSelectedShop } from '@/utils/auth';
import { ROUTES } from '@/services/Routes';

interface ProtectedRouteProps {
    children: React.ReactNode;
    adminOnly?: boolean;
    shopType?: 'laundry' | 'hotel';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    adminOnly = false,
    shopType
}) => {
    const location = useLocation();
    const authenticated = isAuthenticated();
    const userRole = getUserRole();
    const selectedShop = getSelectedShop();

    if (!authenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check admin access
    if (adminOnly && userRole !== 'admin') {
        return <Navigate to="/unauthorized" replace />;
    }

    // Check shop access for staff
    if (userRole === 'staff' && shopType && selectedShop !== shopType) {
        // If staff tries to access wrong shop, redirect to their selected shop
        if (selectedShop === 'laundry') {
            return <Navigate to={ROUTES.laundryDashboard} replace />;
        } else if (selectedShop === 'hotel') {
            return <Navigate to={ROUTES.fooditems} replace />;
        }
        // If no shop selected, redirect to login to select shop
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;