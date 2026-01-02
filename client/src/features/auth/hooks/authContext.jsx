import { createContext, useContext, useState, useEffect } from "react";
import { loginUser as loginAPI } from "../api/authApi";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const parseTokenToUser = (token) => {
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      if (decoded.exp < currentTime) {
         console.log("Token hết hạn");
         return null;
      }

      return {
        token,
        ...decoded,
        _id: decoded.userId || decoded._id || decoded.id,
        role: (decoded.role || decoded.system_role || "").toLowerCase()
      };
    } catch (error) {
      console.error("Lỗi giải mã token:", error);
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const userFromToken = parseTokenToUser(token);
      if (userFromToken) {
        setUser(userFromToken);
      } else {
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      const data = await loginAPI(credentials);
      const userFromToken = parseTokenToUser(data.token);

      if (userFromToken) {
        setUser(userFromToken);
        localStorage.setItem("token", data.token);
      }
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};