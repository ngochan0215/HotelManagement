import { createContext, useContext, useState } from "react";
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const tokenFromStorage = localStorage.getItem("token");
  const [user, setUser] = useState(tokenFromStorage ? { token: tokenFromStorage } : null);

  const loginUser = (token) => {
    localStorage.setItem("token", token);
    setUser({ token });
  };

  const logoutUser = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
