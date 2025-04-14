import React, { useEffect } from 'react';

interface ErrorBannerProps {
    error: string | null;
    setError: (error: string | null) => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, setError }) => {
    // Clear error after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error, setError]);

    if (!error) return null;

    return (
        <div className="p-3 bg-red-100 text-red-700 border-b border-red-200">
            {error}
        </div>
    );
};

export default ErrorBanner; 