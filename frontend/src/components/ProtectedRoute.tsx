import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const token = localStorage.getItem("token");
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!token) {
      alert("⚠️ 로그인이 필요합니다!");
      setShouldRedirect(true);
    }
  }, [token]);

  if (shouldRedirect) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
