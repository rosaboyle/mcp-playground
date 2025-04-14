import React from 'react';

const ModelInfoBanner: React.FC = () => {
    return (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs border-b border-blue-100 dark:border-blue-800/30">
            <strong>Note:</strong> Select your preferred model in the Providers tab.
        </div>
    );
};

export default ModelInfoBanner; 