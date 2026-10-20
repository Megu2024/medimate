import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('medimate_token'));
  const [loading, setLoading] = useState(true);

  // Fetch current user & patient profile on mount or token change
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          setUser(res.data.user);
          setPatient(res.data.patient);
        }
      } catch (err) {
        console.error('[AuthContext] Session expired or invalid:', err.message);
        localStorage.removeItem('medimate_token');
        setToken(null);
        setUser(null);
        setPatient(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      localStorage.setItem('medimate_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setPatient(res.data.patient);
      return res.data;
    }
    throw new Error(res.data.message || 'Login failed');
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    if (res.data.success) {
      localStorage.setItem('medimate_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setPatient(res.data.patient);
      return res.data;
    }
    throw new Error(res.data.message || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('medimate_token');
    setToken(null);
    setUser(null);
    setPatient(null);
    api.post('/auth/logout').catch(() => {});
  };

  const updatePatientState = (newPatientData) => {
    setPatient(newPatientData);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        setPatient(res.data.patient);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        patient,
        token,
        isAuthenticated: Boolean(token && user),
        loading,
        login,
        register,
        logout,
        updatePatientState,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
