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
          icon: <Home size={22} />,
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
          label: "Wallet",
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-md shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
      <div
        className="mx-auto grid h-[68px] w-full max-w-lg items-stretch gap-0.5"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path === "/taxi/driver/home" &&
            location.pathname === "/taxi/driver/dashboard");
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition-all duration-300 ${
              isActive
                ? "bg-slate-50 text-black translate-y-[-1px]"
                : "text-black/60 font-bold opacity-80"
            }`}>
            <div
              className={`transition-all duration-300 ${isActive ? "scale-105" : ""}`}>
              {React.cloneElement(item.icon, {
                strokeWidth: isActive ? 2.5 : 2,
                size: 20,
              })}
            </div>
            <span
              className={`max-w-full truncate text-[8px] uppercase tracking-[0.04em] transition-all duration-300 ${
                isActive
                  ? "opacity-100 scale-100 font-black"
                  : "opacity-80 scale-95 font-bold"
              }`}>
              {item.label}
            </span>
            {isActive && (
              <div className="absolute -top-2 h-[2px] w-7 rounded-full bg-slate-900" />
            )}
          </NavLink>
        );
      })}
      </div>
    </nav>
  );
};

export default DriverBottomNav;
