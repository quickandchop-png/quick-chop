import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import {
  AppUser, UserRole,
  login as loginFn, register as registerFn, logout as logoutFn,
  getCurrentUser, seedInitialData,
  registerCustomer as registerCustomerFn,
  findCustomerByPhone,
  setUserPin, verifyUserPin, hasUserPin,
} from '../../lib/storage';

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  isGuest: boolean;
  hasPinSetup: boolean;
  login: (phone: string, password: string) => Promise<AppUser | null>;
  register: (phone: string, password: string, name: string, role: UserRole) => Promise<AppUser>;
  registerCustomer: (phone: string, name: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  checkHasPin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPinSetup, setHasPinSetup] = useState(false);

  useEffect(() => {
    async function init() {
      await seedInitialData();
      const current = await getCurrentUser();
      setUser(current);
      if (current) {
        const pin = await hasUserPin(current.id);
        setHasPinSetup(pin);
      }
      setIsLoading(false);
    }
    init();
  }, []);

  const login = async (phone: string, password: string) => {
    const u = await loginFn(phone, password);
    setUser(u);
    if (u) {
      const pin = await hasUserPin(u.id);
      setHasPinSetup(pin);
    }
    return u;
  };

  const register = async (phone: string, password: string, name: string, role: UserRole) => {
    const u = await registerFn(phone, password, name, role);
    setUser(u);
    return u;
  };

  const registerCustomer = useCallback(async (phone: string, name: string): Promise<AppUser> => {
    let u: AppUser;
    const existing = await findCustomerByPhone(phone);
    if (existing && existing.role === 'customer') {
      u = existing;
    } else {
      const safeName = name.trim() || 'Customer';
      u = await registerCustomerFn(phone, safeName);
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('qc_current_user', JSON.stringify(u));
    setUser(u);
    const pin = await hasUserPin(u.id);
    setHasPinSetup(pin);
    return u;
  }, []);

  const logout = async () => {
    await logoutFn();
    setUser(null);
    setHasPinSetup(false);
  };

  const refreshUser = async () => {
    const current = await getCurrentUser();
    setUser(current);
    if (current) {
      const pin = await hasUserPin(current.id);
      setHasPinSetup(pin);
    }
  };

  const setupPin = useCallback(async (pin: string) => {
    if (!user) return;
    await setUserPin(user.id, pin);
    setHasPinSetup(true);
  }, [user]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!user) return false;
    return verifyUserPin(user.id, pin);
  }, [user]);

  const checkHasPin = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const has = await hasUserPin(user.id);
    setHasPinSetup(has);
    return has;
  }, [user]);

  const isGuest = !user && !isLoading;

  const value = useMemo(() => ({
    user, isLoading, isGuest, hasPinSetup,
    login, register, registerCustomer, logout, refreshUser,
    setupPin, verifyPin, checkHasPin,
  }), [user, isLoading, isGuest, hasPinSetup, registerCustomer, setupPin, verifyPin, checkHasPin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
