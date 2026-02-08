import {ReactNode, useEffect, useState} from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    widthClass?: string; // Optional width override (e.g., max-w-lg)
}

export default function Modal({
                                  isOpen,
                                  onClose,
                                  title,
                                  children,
                                  widthClass = "max-w-md",
                              }: ModalProps) {
    const [visible, setVisible] = useState(false);

    // Handle fade-in and fade-out transitions
    useEffect(() => {
        if (isOpen) setVisible(true);
        else {
            // Small timeout to allow fade-out animation to complete
            const timer = setTimeout(() => setVisible(false), 150);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    if (!isOpen && !visible) return null;

    // Click outside closes modal
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            onMouseDown={handleOverlayClick}
            className={`fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-150 ${
                isOpen ? "opacity-100" : "opacity-0"
            }`}
        >
            <div
                onMouseDown={(e) => e.stopPropagation()} // prevent closing on drag/select
                className={`bg-gray-900 rounded-md shadow-2xl w-full ${widthClass} p-6 border border-gray-800 relative transform transition-all duration-150 ${
                    isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
                } max-h-[90vh] overflow-y-auto select-text`}
            >
                {title && (
                    <h3 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
                        {title}
                    </h3>
                )}
                {children}
            </div>
        </div>
    );
}
