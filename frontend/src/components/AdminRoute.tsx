import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { adminApi } from "../services/adminApi";

type AuthUser = {
  role?: string;
};

function isAdminRole(role?: string) {
  const normalized = (role || "").toUpperCase();
  return normalized === "ADMIN" || normalized === "ROLE_ADMIN";
}

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      let localUser: AuthUser | null = null;
      try {
        const userRaw = localStorage.getItem("user");
        localUser = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
      } catch {
        localUser = null; // 깨진 값이면 권한 없음으로 본다(화면이 하얗게 멈추지 않게)
      }
      if (!isAdminRole(localUser?.role)) {
        if (!cancelled) setAllowed(false);
        return;
      }

      try {
        const me = await adminApi.getMe();
        if (!cancelled) setAllowed(isAdminRole(me.role));
      } catch {
        if (!cancelled) setAllowed(false);
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) {
    return (
      <section className="min-h-screen px-6 pt-28 text-chalk lg:px-10">
        <div className="dg-steel mx-auto flex max-w-3xl items-center gap-4 p-6 text-steel-300" role="status">
          <span className="dg-loading-plates" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          관리자 권한 확인 중...
        </div>
      </section>
    );
  }

  if (!allowed) {
    return (
      <Navigate
        to="/forbidden"
        replace
        state={{ reason: "관리자 권한이 필요하거나 세션이 만료되었습니다." }}
      />
    );
  }

  return <>{children}</>;
}
