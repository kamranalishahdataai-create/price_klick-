import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000); // auto dismiss after 3s
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 9999
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: "12px 18px",
              borderRadius: 8,
              color: "#fff",
              fontWeight: 600,
              background:
                toast.type === "success"
                  ? "linear-gradient(90deg,#4CAF50,#43A047)"
                  : toast.type === "error"
                  ? "linear-gradient(90deg,#f44336,#e53935)"
                  : "linear-gradient(90deg,#2196F3,#1976D2)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
