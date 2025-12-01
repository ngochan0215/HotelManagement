import { createContext, useContext, useState } from "react";
import { loginUser } from "../API/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const tokenFromStorage = localStorage.getItem("token");
  const [user, setUser] = useState(tokenFromStorage ? { token: tokenFromStorage } : null);

  const login = async (credentials) => {
    const data = await loginUser(credentials);
    setUser({ token: data.token });
    localStorage.setItem("token", data.token);
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
