import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheckCircle, faInfoCircle, faTimesCircle, faXmark} from "@fortawesome/free-solid-svg-icons";
import {useToast} from "./toast-context";

export default function ToastContainer() {
    const {toasts, removeToast} = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl px-4 py-3 min-w-[300px] max-w-[400px] animate-slide-in"
                >
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                            {toast.type === "success" && (
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-400" />
                            )}
                            {toast.type === "error" && (
                                <FontAwesomeIcon icon={faTimesCircle} className="text-red-400" />
                            )}
                            {toast.type === "info" && (
                                <FontAwesomeIcon icon={faInfoCircle} className="text-blue-400" />
                            )}
                        </div>
                        <div className="flex-1 text-sm text-gray-200 whitespace-pre-wrap">
                            {toast.message}
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                        >
                            <FontAwesomeIcon icon={faXmark} size="sm" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
