import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import Home from "./pages/Home";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthCallback from "./auth/Callback";
import AdminDashboard from "./pages/AdminDashboard";


function App() {

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/auth/Callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
