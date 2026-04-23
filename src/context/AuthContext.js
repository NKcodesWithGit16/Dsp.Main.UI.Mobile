import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState('dispatcher');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('userName'),
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userToken'),
      AsyncStorage.getItem('userRole'),
    ]).then(([id, name, email, token, role]) => {
      if (id) {
        setUserId(id);
        setUserName(name || '');
        setUserEmail(email || '');
        setUserToken(token || null);
        setUserRole(role || 'dispatcher');
      }
      setLoading(false);
    });
  }, []);

  const login = async (id, name, email, token = null, role = 'dispatcher') => {
    await AsyncStorage.multiSet([
      ['userId', String(id)],
      ['userName', name || ''],
      ['userEmail', email || ''],
      ['userToken', token || ''],
      ['userRole', role || 'dispatcher'],
    ]);
    setUserId(String(id));
    setUserName(name || '');
    setUserEmail(email || '');
    setUserToken(token || null);
    setUserRole(role || 'dispatcher');
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['userId', 'userName', 'userEmail', 'userToken', 'userRole']);
    setUserId(null);
    setUserName('');
    setUserEmail('');
    setUserToken(null);
    setUserRole('dispatcher');
  };

  return (
    <AuthContext.Provider value={{ userId, userName, userEmail, userToken, userRole, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
