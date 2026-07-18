const Modal = ({ show, onClose, children, maxWidth = 'max-w-sm' }) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto modal-backdrop flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full ${maxWidth} text-center transform transition-all`}
            >
                {children}
            </div>
        </div>
    );
};

export default Modal;
