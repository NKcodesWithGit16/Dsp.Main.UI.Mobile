import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readUserFromToken } from '../utils/auth';
import { readToken, writeToken, clearToken } from '../utils/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('userName'),
      AsyncStorage.getItem('userEmail'),
      readToken(),
    ]).then(([name, email, token]) => {
      const claims = readUserFromToken(token);
      if (claims && claims.userId) {
        setUserId(claims.userId);
        setUserName(name || '');
        setUserEmail(email || '');
        setUserToken(token);
        setUserRole(claims.role);
      }
      setLoading(false);
    });
  }, []);

  // `role` and `id` args are ignored — both are derived from the token
  // claims so they can't be tampered with via storage.
  const login = async (_id, name, email, token = null) => {
    const claims = readUserFromToken(token);
    if (!claims || !claims.userId) {
      throw new Error('Login token missing or invalid');
    }
    await AsyncStorage.multiSet([
      ['userName', name || ''],
      ['userEmail', email || ''],
    ]);
    await writeToken(token || '');
    setUserId(claims.userId);
    setUserName(name || '');
    setUserEmail(email || '');
    setUserToken(token || null);
    setUserRole(claims.role);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['userId', 'userName', 'userEmail', 'userRole']);
    await clearToken();
    setUserId(null);
    setUserName('');
    setUserEmail('');
    setUserToken(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ userId, userName, userEmail, userToken, userRole, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
