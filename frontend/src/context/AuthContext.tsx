import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { User } from '../api/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('glucotwin_token');
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('glucotwin_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('glucotwin_token', newToken);
    localStorage.setItem('glucotwin_user', JSON.stringify(newUser));
    if (newUser.patient_id) {
      localStorage.setItem('glucotwin_active_patient_id', newUser.patient_id.toString());
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('glucotwin_token');
    localStorage.removeItem('glucotwin_user');
    localStorage.removeItem('glucotwin_active_patient_id');
  };

  const refreshUser = async () => {
    const currentToken = localStorage.getItem('glucotwin_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await apiRequest<User>('/auth/me');
      setUser(userData);
      localStorage.setItem('glucotwin_user', JSON.stringify(userData));
      if (userData.patient_id) {
        localStorage.setItem('glucotwin_active_patient_id', userData.patient_id.toString());
      }
    } catch (err) {
      console.warn('Failed to refresh user session; clearing credentials:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
