import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, Bell } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Welcome back, <span className="text-emerald-600">{user?.name || 'User'}</span>
        </h2>
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-200" />

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-300">
            {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-sm font-medium text-gray-800 leading-none">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          title="Logout"
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
