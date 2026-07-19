const Modal = ({ show, onClose, children, maxWidth = 'max-w-sm', panelClassName = '' }) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto modal-backdrop flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full ${maxWidth} text-center transform transition-all max-h-[min(80vh,720px)] flex flex-col overflow-hidden ${panelClassName}`}
            >
                {children}
            </div>
        </div>
    );
};

export default Modal;
