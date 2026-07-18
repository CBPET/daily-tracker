import { useState, useEffect } from 'react';

const Toast = ({ show, message, onDone }) => {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (show) {
            setExiting(false);
            const timer = setTimeout(() => setExiting(true), 2000);
            const removeTimer = setTimeout(() => {
                setExiting(false);
                onDone();
            }, 2400);
            return () => {
                clearTimeout(timer);
                clearTimeout(removeTimer);
            };
        }
    }, [show, onDone]);

    if (!show && !exiting) return null;

    return (
        <div
            className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-xl shadow-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold flex items-center gap-3 ${exiting ? 'toast-exit' : 'toast-enter'
                }`}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-8.08" />
                <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {message}
        </div>
    );
};

export default Toast;
