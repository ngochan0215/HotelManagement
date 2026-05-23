import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/authContext.jsx';
import Input from "../../../components/ui/Input.jsx";
import Button from "../../../components/ui/Button.jsx";
import { employeeApi } from "../../api/employeeApi.js";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GoogleLogin } from '@react-oauth/google';

const LoginPage = () => {
  const { login, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [credentials, setCredentials] = useState({
    email: "",
    password: ""
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const userResponse = await login(credentials);
        const role = localStorage.getItem("role") || "employee";

        if (role === 'manager') {
           localStorage.setItem("position", "manager");
           navigate("/dashboard");
        } else {
           try {
               const res = await employeeApi.getProfile();
               const employee = res.employee || res;
               const pos = employee?.position;

               if (pos) {
                   localStorage.setItem("position", pos);
                   if (pos === 'receptionist') navigate("/room-calendar");
                   else if (pos === 'technician') navigate("/incidents");
                   else navigate("/dashboard");
               } else {
                   localStorage.setItem("position", "employee");
                   navigate("/dashboard");
               }
           } catch (err) {
               console.error("Lỗi lấy profile:", err);
               localStorage.setItem("position", "unknown");
               navigate("/dashboard");
           }
        }

      } catch (err) {
        setError("Lỗi đăng nhập: " + (err.response?.data?.message || err.message));
      } finally {
          setLoading(false);
      }
    };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-4 text-center">Đăng nhập</h1>

        {error && <p className="text-red-500 mb-2">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input type="email" placeholder="Email" name="email" value={credentials.email} onChange={handleChange} />
          <Input type="password" placeholder="Mật khẩu" name="password" value={credentials.password} onChange={handleChange} required />

          <Button type="submit" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đăng nhập"}
          </Button>
        </form>

        <GoogleOAuthProvider clientId="10090795936-3p8j69nbncuu5rq1p8k7lc75n48g9j6c.apps.googleusercontent.com">
          <GoogleLogin
            // onSuccess={credentialResponse => {
            //   console.log(credentialResponse);
            // }}
            onSuccess={async (credentialResponse) => {
            try {
              setLoading(true);
              setError("");

              const googleToken = credentialResponse.credential;

              // Call your backend (you need to implement this API)
              const response = await loginGoogle({
                googleToken: googleToken
              });

              if (response.isNewUser) {
                navigate("/register", {
                  state: res.googleData
                });
                return;
              }

              const role = localStorage.getItem("role") || "employee";

              if (role === 'manager') {
                localStorage.setItem("position", "manager");
                navigate("/dashboard");
              } else {
                try {
                  const res = await employeeApi.getProfile();

                  const employee = res.employee || res;
                  const pos = employee?.position;

                  if (pos) {
                    localStorage.setItem("position", pos);

                    if (pos === 'receptionist') navigate("/room-calendar");
                    else if (pos === 'technician') navigate("/incidents");
                    else navigate("/dashboard");
                  } else {
                    localStorage.setItem("position", "employee");
                    navigate("/dashboard");
                  }
                } catch (err) {
                  console.error("Lỗi lấy profile:", err);
                  localStorage.setItem("position", "unknown");
                  navigate("/dashboard");
                }
              }

            } catch (err) {
              setError("Google login failed: " + (err.response?.data?.message || err.message));
            } finally {
              setLoading(false);
            }
          }}
            onError={() => {
              console.log('Login Failed');
            }}
          />
        </GoogleOAuthProvider>

      </div>
    </div>
  );
};

export default LoginPage;