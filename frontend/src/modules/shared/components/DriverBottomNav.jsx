import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Briefcase,
  Car,
  Home,
  IndianRupee,
  Trophy,
  User,
  History,
  Users,
} from "lucide-react";

const DriverBottomNav = () => {
  const location = useLocation();
  const role = String(localStorage.getItem("role") || "driver").toLowerCase();
  const isOwner = role === "owner";

  // Matching user's latest screenshot labels: Home, History, Earnings, Accounts
  const navItems = isOwner
    ? [
        {
          icon: <Briefcase size={22} />,
          label: "Dashboard",
          path: "/taxi/driver/dashboard",
        },
        {
          icon: <Users size={22} />,
          label: "Drivers",
          path: "/taxi/driver/manage-drivers",
        },
        {
          icon: <Car size={22} />,
          label: "Vehicle",
          path: "/taxi/driver/vehicle-fleet",
        },
        {
          icon: <User size={22} />,
          label: "Account",
          path: "/taxi/driver/profile",
        },
      ]
    : [
        { icon: <Home size={22} />, label: "Home", path: "/taxi/driver/home" },
        {
          icon: <History size={22} />,
          label: "History",
          path: "/taxi/driver/history",
        },
        {
          icon: <IndianRupee size={22} />,
          label: "Earnings",
          path: "/taxi/driver/wallet",
        },
        {
          icon: <Trophy size={22} />,
          label: "Milestone",
          path: "/taxi/driver/incentives",
        },
        {
          icon: <User size={22} />,
          label: "Accounts",
          path: "/taxi/driver/profile",
        },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center justify-around z-50 h-[72px] px-6 pb-2 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path === "/taxi/driver/home" &&
            location.pathname === "/taxi/driver/dashboard");
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative ${
              isActive
                ? "text-black translate-y-[-2px]"
                : "text-black/60 font-bold opacity-80"
            }`}>
            <div
              className={`transition-all duration-300 ${isActive ? "scale-110 mb-0.5" : ""}`}>
              {React.cloneElement(item.icon, {
                strokeWidth: isActive ? 2.5 : 2,
                size: 22,
              })}
            </div>
            <span
              className={`text-[10px] uppercase tracking-[0.08em] transition-all duration-300 ${
                isActive
                  ? "opacity-100 scale-100 font-black"
                  : "opacity-80 scale-95 font-bold"
              }`}>
              {item.label}
            </span>
            {isActive && (
              <div className="absolute -top-3 w-8 h-[2px] bg-slate-900 rounded-full" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default DriverBottomNav;
