import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Pill, History, FileText, Settings } from 'lucide-react';

export default function MobileNav() {
  const items = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/medicines', label: 'Medicines', icon: Pill },
    { to: '/history', label: 'History', icon: History },
    { to: '/reports', label: 'AI Reports', icon: FileText },
    { to: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-semibold transition-colors ${
                isActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
