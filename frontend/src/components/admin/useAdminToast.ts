import { useCallback, useState } from "react";
import type { AdminToastState } from "./AdminToast";

export function useAdminToast() {
  const [toast, setToast] = useState<AdminToastState | null>(null);

  const showSuccess = useCallback((message: string) => setToast({ type: "success", message }), []);
  const showError = useCallback((message: string) => setToast({ type: "error", message }), []);
  const clearToast = useCallback(() => setToast(null), []);

  return { toast, showSuccess, showError, clearToast };
}
