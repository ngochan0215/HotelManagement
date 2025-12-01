import { useState } from 'react';
import { AuthProvider } from '../hooks/authContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../hooks/authContext.jsx";
//import {useAuth} from '../hooks/useAuth.js';
import Input from "../../../components/ui/Input.jsx";
import Button from "../../../components/ui/Button.jsx";

// Mock API call
// const login = async (email, password) => {
//   if (email === 'admin@example.com' && password === '123456') {
//     return { token: 'fake-jwt-token' };
//   } else {
//     throw new Error('Email hoặc mật khẩu không đúng');
//   }
// };

const login = async (email, password) => {
  const res = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Đăng nhập thất bại");
  }

  return await res.json(); // API trả token + user id + system_role
};


function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = await login(email, password);
      loginUser(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-md p-6 bg-white rounded shadow">
          <h1 className="text-2xl font-bold mb-4 text-center">Đăng nhập</h1>
          {error && <p className="text-red-500 mb-2">{error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit">Đăng nhập</Button>
          </form>
        </div>
      </div>
    );

}

export default LoginPage;