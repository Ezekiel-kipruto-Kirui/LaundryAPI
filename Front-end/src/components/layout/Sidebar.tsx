import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  ClipboardList,
  Receipt,
  LayoutDashboard,
  Shirt,
  Building,
  LogOut,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi } from "@/services/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ROUTES } from "@/services/Routes";
import {
  getUserRole,
  getSelectedShop,
  getSelectedShopType, // NEW: Import this
  getUserEmail,
  clearAuthData,
} from "@/utils/auth";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type UserRole = 'admin' | 'staff';

/* ------------------------------------------------------------------ */
/* Navigation config                                                   */
/* ------------------------------------------------------------------ */

const mainNavItems = [
  { to: ROUTES.dashboard, icon: LayoutDashboard, label: "General Dashboard", adminOnly: true },
  { to: ROUTES.reports, icon: BarChart3, label: "Performance Report", adminOnly: true },
  { to: ROUTES.siteManagement, icon: Settings, label: "Site Management", adminOnly: true },
];

const dropdownSections = [
  {
    id: "laundry",
    label: "Laundry Activities",
    icon: Shirt,
    items: [
      { to: ROUTES.laundryDashboard, icon: LayoutDashboard, label: "Laundry Dashboard" },
      { to: ROUTES.laundryCreateOrder, icon: ShoppingCart, label: "Create Order" },
      { to: ROUTES.laundryOrders, icon: ClipboardList, label: "Orders" },
      { to: ROUTES.laundryCustomers, icon: Users, label: "Customers" },
      { to: ROUTES.laundryExpenses, icon: Receipt, label: "Expenses" },
    ],
  },
  {
    id: "hotel",
    label: "Hotel Activities",
    icon: Building,
    items: [
      { to: ROUTES.fooditems, icon: LayoutDashboard, label: "Food Items" },
      { to: ROUTES.hotelOrders, icon: ClipboardList, label: "Hotel Orders" },
      { to: ROUTES.hotelExpenses, icon: Receipt, label: "Hotel Expenses" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole | null>(null);
  const [shop, setShop] = useState<'laundry' | 'hotel' | null>(null); // Updated to use shop type
  const [email, setEmail] = useState('');

  const [expandedSections, setExpandedSections] = useState({
    laundry: true,
    hotel: true,
  });

  /* ------------------------------------------------------------------ */
  /* Load auth state                                                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const userRole = getUserRole();
    const selectedShopType = getSelectedShopType(); // Use the new function

    setRole(userRole);
    setShop(selectedShopType);
    setEmail(getUserEmail());

    if (userRole === 'staff' && selectedShopType) {
      // Expand only the section for the selected shop
      setExpandedSections({
        laundry: selectedShopType === 'laundry',
        hotel: selectedShopType === 'hotel',
      });
    } else if (userRole === 'admin') {
      // Admin sees all sections expanded by default
      setExpandedSections({
        laundry: true,
        hotel: true,
      });
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Helper functions                                                    */
  /* ------------------------------------------------------------------ */

  // Get shop display name
  const getShopDisplayName = (shopType: 'laundry' | 'hotel' | null): string => {
    if (!shopType) return 'No Shop Selected';

    const shopMapping: Record<string, string> = {
      'laundry': 'Laundry Shop',
      'hotel': 'Hotel Shop',
    };

    return shopMapping[shopType] || 'Unknown Shop';
  };

  /* ------------------------------------------------------------------ */
  /* Derived navigation                                                  */
  /* ------------------------------------------------------------------ */

  const visibleMainNav = mainNavItems.filter(
    item => !item.adminOnly || role === 'admin'
  );

  const visibleDropdowns = dropdownSections.filter(section => {
    if (role === 'admin') return true;
    if (role === 'staff') {
      return shop === section.id;
    }
    return false;
  });

  /* ------------------------------------------------------------------ */
  /* Handlers                                                           */
  /* ------------------------------------------------------------------ */

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore API failure
    } finally {
      clearAuthData();
      toast.success("Logged out successfully");
      navigate("/login", { replace: true });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground">
      <div className="flex h-full flex-col">

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-primary">
            <img src="/logos/Clean-page-logo.png" className="h-10 w-10 rounded-full" />
          </div>
          <div>
            <h1 className="text-md font-bold">Clean Page Laundry</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">

          {/* Main nav - Only shown to admin */}
          {role === 'admin' && visibleMainNav.map(item => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium mb-1",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "opacity-70 hover:bg-sidebar-accent"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </RouterNavLink>
          ))}

          {/* Dropdowns */}
          {visibleDropdowns.map(section => (
            <div key={section.id} className="mt-3">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium opacity-70 hover:bg-sidebar-accent"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="h-5 w-5" />
                  {section.label}
                </div>
                {expandedSections[section.id]
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
              </button>

              {expandedSections[section.id] && (
                <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                  {section.items.map(item => (
                    <RouterNavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                          isActive
                            ? "bg-sidebar-primary/20 border-l-2 border-sidebar-primary"
                            : "opacity-60 hover:bg-sidebar-accent"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </RouterNavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t-1 p-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm opacity-70 hover:bg-sidebar-accent"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}