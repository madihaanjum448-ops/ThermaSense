import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const DEMO_OFFICIALS = {
  officer1: {
    username: 'officer1',
    name: 'R. Sharma',
    role: 'Disaster Management Officer',
    department: 'BBMP',
    password: 'demo123',
  },
  officer2: {
    username: 'officer2',
    name: 'A. Iyer',
    role: 'Municipal Health Officer',
    department: 'Bengaluru Urban Health Dept',
    password: 'demo123',
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authError, setAuthError] = useState(null);

  const login = useCallback(async (username, password) => {
    setAuthError(null);
    const cleanUser = username?.trim().toLowerCase();
    const cleanPass = password?.trim();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(data.access_token);
        setAuthError(null);
        return { success: true, user: data.user };
      } else {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.detail || 'Invalid officer credentials. Use officer1 or officer2 with demo123.';
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch {
      // Graceful local fallback if backend server is not running
      const official = DEMO_OFFICIALS[cleanUser];
      if (official && official.password === cleanPass) {
        const userProfile = {
          username: official.username,
          name: official.name,
          role: official.role,
          department: official.department,
        };
        setUser(userProfile);
        setToken(`simulated-token-${Date.now()}`);
        setAuthError(null);
        return { success: true, user: userProfile };
      }

      const errorMsg = 'Invalid credentials. Username: officer1 or officer2, Password: demo123';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);


  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAuthError(null);
  }, []);

  const value = {
    user,
    token,
    authError,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
