import React, { useState, useEffect } from 'react';

interface UpdateStatus {
    checking: boolean;
    available: boolean;
    downloaded: boolean;
    error: string | null;
    version: string | null;
    progress: number;
}

const UpdaterSection: React.FC = () => {
    const [currentVersion, setCurrentVersion] = useState<string>('');
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
        checking: false,
        available: false,
        downloaded: false,
        error: null,
        version: null,
        progress: 0
    });

    // Get current app version from package.json on component mount
    useEffect(() => {
        // We need to check if these APIs exist before using them
        // This is important for tests and environments where electron might not be available
        try {
            // Get the version from package.json directly when running in development
            // In production, the app.getVersion() should be available
            const packageVersion = '0.1.3'; // Hardcoded fallback

            // Safely get version
            if (window.electron?.app?.getVersion) {
                try {
                    const version = window.electron.app.getVersion();
                    setCurrentVersion(version || packageVersion);
                } catch (versionError) {
                    console.error('Error getting app version:', versionError);
                    setCurrentVersion(packageVersion);
                }
            } else {
                setCurrentVersion(packageVersion);
                console.log('App version API not available, using fallback version');
            }

            // Register update event listeners only if they exist
            let removeUpdateAvailable = () => { };
            let removeUpdateDownloaded = () => { };
            let removeUpdateError = () => { };
            let removeDownloadProgress = () => { };

            if (window.electron?.updater?.onUpdateAvailable) {
                removeUpdateAvailable = window.electron.updater.onUpdateAvailable((info) => {
                    setUpdateStatus(prev => ({
                        ...prev,
                        checking: false,
                        available: true,
                        version: info.version
                    }));
                });
            }

            if (window.electron?.updater?.onUpdateDownloaded) {
                removeUpdateDownloaded = window.electron.updater.onUpdateDownloaded(() => {
                    setUpdateStatus(prev => ({
                        ...prev,
                        downloaded: true,
                        progress: 100
                    }));
                });
            }

            if (window.electron?.updater?.onUpdateError) {
                removeUpdateError = window.electron.updater.onUpdateError((message) => {
                    setUpdateStatus(prev => ({
                        ...prev,
                        checking: false,
                        error: message
                    }));
                });
            }

            if (window.electron?.updater?.onDownloadProgress) {
                removeDownloadProgress = window.electron.updater.onDownloadProgress((progressObj) => {
                    setUpdateStatus(prev => ({
                        ...prev,
                        progress: progressObj.percent
                    }));
                });
            }

            // Clean up event listeners on component unmount
            return () => {
                removeUpdateAvailable();
                removeUpdateDownloaded();
                removeUpdateError();
                removeDownloadProgress();
            };
        } catch (error) {
            console.error('Error setting up updater component:', error);
            setCurrentVersion('0.1.3'); // Default fallback version
            return () => { }; // Empty cleanup function
        }
    }, []);

    // Handle checking for updates
    const handleCheckForUpdates = async () => {
        if (!window.electron?.updater?.checkForUpdates) {
            setUpdateStatus(prev => ({
                ...prev,
                error: 'Update checking not available in this environment'
            }));
            return;
        }

        setUpdateStatus(prev => ({
            ...prev,
            checking: true,
            error: null
        }));

        try {
            const result = await window.electron.updater.checkForUpdates();
            if (!result.success) {
                setUpdateStatus(prev => ({
                    ...prev,
                    checking: false,
                    error: result.message || 'Failed to check for updates'
                }));
            } else {
                // If no update-available event is fired after some time, clear the checking state
                setTimeout(() => {
                    setUpdateStatus(prev => {
                        if (prev.checking) {
                            return {
                                ...prev,
                                checking: false,
                                error: 'No update information received. You may be on the latest version.'
                            };
                        }
                        return prev;
                    });
                }, 10000); // 10 second timeout
            }
            // Other statuses will be handled by event listeners
        } catch (error) {
            setUpdateStatus(prev => ({
                ...prev,
                checking: false,
                error: error instanceof Error ? error.message : 'Unknown error checking for updates'
            }));
        }
    };

    // Handle downloading update
    const handleDownloadUpdate = async () => {
        if (!window.electron?.updater?.downloadUpdate) {
            setUpdateStatus(prev => ({
                ...prev,
                error: 'Update downloading not available in this environment'
            }));
            return;
        }

        setUpdateStatus(prev => ({
            ...prev,
            error: null
        }));

        try {
            const result = await window.electron.updater.downloadUpdate();
            if (!result.success) {
                setUpdateStatus(prev => ({
                    ...prev,
                    error: result.message || 'Failed to download update'
                }));
            }
            // Download progress and completion will be handled by event listeners
        } catch (error) {
            setUpdateStatus(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error downloading update'
            }));
        }
    };

    // Handle installing update
    const handleInstallUpdate = async () => {
        if (!window.electron?.updater?.quitAndInstall) {
            setUpdateStatus(prev => ({
                ...prev,
                error: 'Update installation not available in this environment'
            }));
            return;
        }

        await window.electron.updater.quitAndInstall();
    };

    // This is a helper to determine if we're in a test environment
    const isRunningInTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

    // Don't render the section at all in test environment unless we've mocked the required APIs
    if (isRunningInTest && !window.electron?.updater) {
        return <div data-testid="updater-section-disabled">Updater disabled in test environment</div>;
    }

    return (
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Updates</h2>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Current Version</span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {currentVersion}
                    </span>
                </div>

                {updateStatus.error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
                        {updateStatus.error}
                    </div>
                )}

                {updateStatus.checking && (
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span>Checking for updates...</span>
                    </div>
                )}

                {updateStatus.available && !updateStatus.downloaded && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-400">
                        <p>Version {updateStatus.version} is available!</p>

                        {updateStatus.progress > 0 && (
                            <div className="mt-2">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                                    <div
                                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                                        style={{ width: `${updateStatus.progress}%` }}
                                    ></div>
                                </div>
                                <span className="text-xs">{Math.round(updateStatus.progress)}% downloaded</span>
                            </div>
                        )}
                    </div>
                )}

                {updateStatus.downloaded && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-400">
                        Update has been downloaded and is ready to install.
                    </div>
                )}

                <div className="flex flex-wrap gap-3 mt-4">
                    <button
                        className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleCheckForUpdates}
                        disabled={updateStatus.checking}
                    >
                        Check for Updates
                    </button>

                    {updateStatus.available && !updateStatus.downloaded && (
                        <button
                            className="px-4 py-2 rounded-md bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleDownloadUpdate}
                            disabled={updateStatus.progress > 0}
                        >
                            Download Update
                        </button>
                    )}

                    {updateStatus.downloaded && (
                        <button
                            className="px-4 py-2 rounded-md bg-purple-500 text-white hover:bg-purple-600"
                            onClick={handleInstallUpdate}
                        >
                            Install & Restart
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
};

export default UpdaterSection; 