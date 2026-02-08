import {createContext, useContext, useState, ReactNode} from "react";

export interface Toast {
    id: string;
    message: string;
    type?: "info" | "success" | "error";
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: Toast["type"]) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({children}: {children: ReactNode}) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (message: string, type: Toast["type"] = "info") => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, {id, message, type}]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{toasts, addToast, removeToast}}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}
