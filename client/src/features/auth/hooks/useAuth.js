import { useState } from 'react';

export function useAuth() {
  const tokenFromStorage = localStorage.getItem('token');
  const [user, setUser] = useState(tokenFromStorage ? { token: tokenFromStorage } : null);

  const loginUser = (token) => {
    localStorage.setItem('token', token);
    setUser({ token });
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return { user, loginUser, logoutUser };
}
