import { createContext, useContext, useState, useCallback } from "react";
import { loginUser as loginAPI, loginGoogle as loginGoogleAPI } from "../api/authApi.js";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();
const AUTH_FLASH_KEY = "auth_flash_message";

export const AuthProvider = ({ children }) => {
  const parseTokenToUser = (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp < Date.now() / 1000) return null;
      return {
        token,
        ...decoded,
        _id: decoded.userId || decoded._id || decoded.id,
        role: (decoded.role || decoded.system_role || "").toLowerCase()
      };
    } catch {
      return null;
    }
  };

  const readStoredUser = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const userFromToken = parseTokenToUser(token);
    if (!userFromToken) {
      localStorage.removeItem("token");
      localStorage.removeItem("user_info");
      localStorage.removeItem("role");
      localStorage.removeItem("position");
      return null;
    }

    const storedInfo = localStorage.getItem("user_info");
    return storedInfo ? { ...userFromToken, ...JSON.parse(storedInfo) } : userFromToken;
  };

  const [user, setUser] = useState(() => readStoredUser());
  const [isLoading] = useState(false);

  const refreshUser = useCallback((updatedData) => {
    setUser((prevUser) => {
      const newUserState = { ...prevUser, ...updatedData };
      localStorage.setItem("user_info", JSON.stringify(newUserState));
      return newUserState;
    });
  }, []);

  const logout = useCallback(({ message } = {}) => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user_info");
    localStorage.removeItem("role");
    localStorage.removeItem("position");
    if (message) {
      sessionStorage.setItem(AUTH_FLASH_KEY, message);
    }
  }, []);

  const login = async (credentials) => {
    const data = await loginAPI(credentials);
    const userFromToken = parseTokenToUser(data.token);

    if (userFromToken) {
      const fullUser = { ...userFromToken, ...data.theUser };
      setUser(fullUser);

      console.log("fullUser: ", fullUser);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.theUser));
      localStorage.setItem("role", (fullUser.role || data.theUser?.role || data.theUser?.system_role || "").toLowerCase());
      localStorage.setItem("position", data.theUser.position || "");
      localStorage.setItem("position", data.theUser.phone_number || "");
    }
    return data;
  };

  const loginGoogle = async (credentials) => {
    const data = await loginGoogleAPI(credentials);
    const userFromToken = parseTokenToUser(data.token);

    if (userFromToken) {
      const fullUser = { ...userFromToken, ...data.theUser };
      setUser(fullUser);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.theUser));
      localStorage.setItem("role", (fullUser.role || data.theUser?.role || data.theUser?.system_role || "").toLowerCase());
      localStorage.setItem("position", data.theUser.position || "");
      localStorage.setItem("position", data.theUser.phone_number || "");
    }
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, login, loginGoogle, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
