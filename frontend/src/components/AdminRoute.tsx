import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const userRaw = localStorage.getItem("user");
  const user = userRaw ? (JSON.parse(userRaw) as { role?: string }) : null;
  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "ROLE_ADMIN";

  if (!token || !isAdmin) {
    alert("관리자 권한이 필요합니다.");
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

