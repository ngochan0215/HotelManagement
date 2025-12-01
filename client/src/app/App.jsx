import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes.jsx';
import { AuthProvider } from '../features/auth/hooks/authContext.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
