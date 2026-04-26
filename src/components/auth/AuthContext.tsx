import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'root' | 'gerente_general' | 'gerente_sucursal' | 'cajero' | 'vendedor';
  branchId?: string;
  activeBranchId?: string;
  allowedBranchIds: string[];
  hasAllBranchAccess: boolean;
  canCreateUsers: string[];
  permissions: string[];
  token?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchBranch: (branchId: string) => Promise<void>;
  loading: boolean;
  // Métodos de conveniencia para permisos
  hasPermission: (permission: string) => boolean;
  canCreateUser: (role: string) => boolean;
  canAccessAllBranches: () => boolean;
  canManageBranch: () => boolean;
  canManageProducts: () => boolean;
  canOperateBranch: () => boolean;
  canManageUsersPanel: () => boolean;
  isSellerOnly: () => boolean;
  isCashier: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const resolvedToken = token || parsedUser?.token;

        if (resolvedToken) {
          setUser({ ...parsedUser, token: resolvedToken });
          localStorage.setItem('token', resolvedToken);
          localStorage.setItem('user', JSON.stringify({ ...parsedUser, token: resolvedToken }));
        } else {
          logout();
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    } else if (token) {
      localStorage.removeItem('token');
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Credenciales inválidas');
      }

      const data = await response.json();
      
      const userData = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        branchId: data.user.branchId,
        activeBranchId: data.user.activeBranchId || data.user.branchId,
        allowedBranchIds: data.user.allowedBranchIds || [],
        hasAllBranchAccess: data.user.hasAllBranchAccess,
        canCreateUsers: data.user.canCreateUsers,
        permissions: data.user.permissions,
        token: data.access_token || data.token,
      };

      const resolvedToken = data.access_token || data.token;

      setUser(userData);
      localStorage.setItem('token', resolvedToken);
      localStorage.setItem('user', JSON.stringify({ ...userData, token: resolvedToken }));
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const switchBranch = async (branchId: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/switch-branch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branchId }),
      });

      if (!response.ok) {
        throw new Error('Error cambiando de sucursal');
      }

      const data = await response.json();
      
      const updatedUser = {
        ...user!,
        ...data.user,
        branchId: data.user.activeBranchId || data.user.branchId || branchId,
        activeBranchId: data.user.activeBranchId || data.user.branchId || branchId,
        allowedBranchIds: data.user.allowedBranchIds || user?.allowedBranchIds || [],
        token: data.access_token || data.token,
      };

      const resolvedToken = data.access_token || data.token;

      setUser(updatedUser);
      localStorage.setItem('token', resolvedToken);
      localStorage.setItem('user', JSON.stringify({ ...updatedUser, token: resolvedToken }));
    } catch (error) {
      throw error;
    }
  };

  // Métodos de conveniencia para permisos
  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const canCreateUser = (role: string): boolean => {
    return user?.canCreateUsers?.includes(role) || false;
  };

  const canAccessAllBranches = (): boolean => {
    return user?.hasAllBranchAccess || false;
  };

  const canManageBranch = (): boolean => {
    return hasPermission('manage_branch') || hasPermission('manage_all');
  };

  const canManageProducts = (): boolean => {
    return hasPermission('manage_products') || hasPermission('manage_all');
  };

  const canOperateBranch = (): boolean => {
    return hasPermission('operate_branch') || hasPermission('manage_all');
  };

  const canManageUsersPanel = (): boolean => {
    return (user?.canCreateUsers?.length || 0) > 0;
  };

  const isSellerOnly = (): boolean => {
    return user?.role === 'vendedor';
  };

  const isCashier = (): boolean => {
    return user?.role === 'cajero';
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    switchBranch,
    loading,
    hasPermission,
    canCreateUser,
    canAccessAllBranches,
    canManageBranch,
    canManageProducts,
    canOperateBranch,
    canManageUsersPanel,
    isSellerOnly,
    isCashier,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
