import { useState } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);

  const loginUser = (token, userInfo) => {
    localStorage.setItem('token', token);
    setUser(userInfo);
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return { user, loginUser, logoutUser };
};
