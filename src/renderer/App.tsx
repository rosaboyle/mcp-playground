import React, { useEffect, useState } from 'react';
import { Config } from '../shared/config';
import { ChatSession } from '../shared/storage';
import { UserSettings } from '../shared/types';
import ChatInterface from './components/ChatInterface';
import ProviderSelection from './components/ProviderSelection';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import MCPPlayground from './components/MCPPlayground';
// Import PostHog utilities
import { initPostHog, trackEvent, identifyUser } from './utils/posthog';
// Import error utilities
import { createError, ErrorType, classifyError, formatErrorForUser } from '../shared/errors';
// Import theme utility
import { applyTheme, setupThemeListener } from './utils/theme';

// Debug logging function
const debugLog = (message: string) => {
    console.log(`[RENDERER DEBUG] ${message}`);
}

// The main app states
type AppView = 'chat' | 'sessions' | 'providers' | 'settings' | 'mcp-playground';

const App: React.FC = () => {
    debugLog('App component rendering');

    // App state
    const [config, setConfig] = useState<Config | null>(null);
    const [view, setView] = useState<AppView>('chat');
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [appPaths, setAppPaths] = useState<{
        storageDir: string;
        credentialsDir: string;
        configDir: string
    } | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    // Initialize app
    useEffect(() => {
        debugLog('App useEffect - initialization starting');

        const initApp = async () => {
            try {
                debugLog('Getting app paths from main process');
                let paths;
                try {
                    // Get app paths from main process
                    paths = await window.electron.ipcRenderer.invoke('get-app-paths');
                    debugLog(`Received app paths: ${JSON.stringify(paths)}`);
                } catch (pathError) {
                    throw createError(
                        `Failed to get app paths: ${(pathError as Error).message}`,
                        ErrorType.STORAGE,
                        pathError
                    );
                }
                setAppPaths(paths);

                debugLog('Setting ChatSession storage directory');
                try {
                    // Set storage directory for chat sessions
                    ChatSession.setStorageDir(paths.storageDir);
                } catch (storageError) {
                    const classifiedError = classifyError(storageError);
                    debugLog(`Warning: Error setting storage dir: ${classifiedError.message}`);
                    console.warn('Error setting storage directory - trying to continue:', classifiedError);
                    // Continue anyway - we have fallbacks in place
                }

                debugLog('Creating config object');
                let appConfig;
                try {
                    // Initialize config
                    appConfig = new Config(
                        paths.storageDir,
                        paths.credentialsDir,
                        paths.configDir
                    );
                } catch (configError) {
                    throw createError(
                        `Failed to create Config object: ${(configError as Error).message}`,
                        ErrorType.STORAGE,
                        configError
                    );
                }

                // Initialize credentials asynchronously
                debugLog('Initializing credentials');
                try {
                    await appConfig.initializeCredentials();
                    debugLog('Credentials initialized');
                } catch (credError) {
                    const classifiedError = classifyError(credError);
                    debugLog(`Warning: Error initializing credentials: ${classifiedError.message}`);
                    console.warn('Error initializing credentials - proceeding with empty credentials:', classifiedError);
                    // Continue anyway - we can still function without API keys
                }

                // Initialize AI providers
                debugLog('Initializing AI providers');
                try {
                    // Initialize active provider
                    const initializeProvider = async () => {
                        debugLog('Initializing active provider');
                        const provider = appConfig.getActiveProvider();

                        debugLog(`Initializing active provider: ${provider}`);

                        try {
                            let apiKey = appConfig.getProviderApiKey(provider);
                            if (apiKey) {
                                const initialized = await window.electron.ai.initializeProvider(provider, apiKey);
                                debugLog(`Provider ${provider} initialized successfully: ${initialized}`);
                                return initialized;
                            } else {
                                debugLog(`No API key found for provider: ${provider}`);
                                return false;
                            }
                        } catch (error) {
                            const classifiedError = classifyError(error);
                            console.error('Error initializing provider:', classifiedError);
                            debugLog(`Error initializing provider: ${formatErrorForUser(classifiedError)}`);
                            return false;
                        }
                    };

                    const initialized = await initializeProvider();

                    if (initialized) {
                        debugLog(`Provider ${appConfig.getActiveProvider()} initialized successfully`);
                    } else {
                        debugLog(`Provider ${appConfig.getActiveProvider()} initialization failed`);
                    }
                } catch (aiError) {
                    const classifiedError = classifyError(aiError);
                    debugLog(`Warning: Error initializing AI providers: ${classifiedError.message}`);
                    console.warn('Error initializing AI providers - proceeding without AI:', classifiedError);
                    // Continue anyway - we will handle this gracefully in the UI
                }

                setConfig(appConfig);

                debugLog('Loading user settings');
                try {
                    // Load user settings
                    setUserSettings(appConfig.getSettings());
                } catch (settingsError) {
                    throw createError(
                        `Failed to load settings: ${(settingsError as Error).message}`,
                        ErrorType.STORAGE,
                        settingsError
                    );
                }

                debugLog('Creating new chat session');
                try {
                    // Create a new session by default
                    const newSession = new ChatSession(
                        undefined,
                        'New Chat',
                        appConfig.getActiveProvider(),
                        appConfig.getActiveModel()
                    );
                    setCurrentSession(newSession);
                } catch (sessionError) {
                    throw createError(
                        `Failed to create chat session: ${(sessionError as Error).message}`,
                        ErrorType.STORAGE,
                        sessionError
                    );
                }

                debugLog('App initialization complete');
                setIsInitialized(true);

                // Initialize PostHog analytics with session recording
                debugLog('Initializing PostHog analytics');
                try {
                    await initPostHog();
                    trackEvent('app_initialized');
                    debugLog('PostHog initialized successfully');
                } catch (analyticsError) {
                    const classifiedError = classifyError(analyticsError);
                    debugLog(`Warning: Error initializing analytics: ${classifiedError.message}`);
                    console.warn('Error initializing analytics - proceeding without tracking:', classifiedError);
                }

            } catch (error) {
                const classifiedError = classifyError(error);
                console.error('Error initializing app:', classifiedError);
                setInitError(formatErrorForUser(classifiedError));
                debugLog(`Initialization error: ${formatErrorForUser(classifiedError)}`);
            }
        };

        initApp();
    }, []);

    // Apply theme when settings change
    useEffect(() => {
        if (userSettings) {
            debugLog(`Applying theme: ${userSettings.theme}`);
            applyTheme(userSettings.theme);

            // Set up listener for system theme changes
            const cleanupListener = setupThemeListener(userSettings.theme);
            return cleanupListener;
        }
    }, [userSettings]);

    // Handle view changes
    const handleViewChange = (newView: AppView) => {
        debugLog(`Changing view to: ${newView}`);
        setView(newView);

        // Track view change in PostHog
        trackEvent('view_changed', { view: newView });
    };

    // Handle session changes
    const handleSessionChange = (session: ChatSession | null) => {
        debugLog(`Changing session: ${session?.session_id}`);
        setCurrentSession(session);

        // Track session change in PostHog
        if (session) {
            trackEvent('session_changed', {
                session_id: session.session_id,
                provider: session.provider,
                model: session.model
            });
        }
    };

    // Create a new session
    const handleNewSession = () => {
        debugLog('Creating new session');
        if (config) {
            const newSession = new ChatSession(
                undefined,
                'New Chat',
                config.getActiveProvider(),
                config.getActiveModel()
            );
            setCurrentSession(newSession);

            // Track new session creation in PostHog
            trackEvent('new_session_created', {
                provider: config.getActiveProvider(),
                model: config.getActiveModel()
            });

            setView('chat');
        }
    };

    // Handle settings changes
    const handleSettingsChange = (settings: Partial<UserSettings>) => {
        debugLog(`Updating settings: ${JSON.stringify(settings)}`);
        if (config && userSettings) {
            const updatedSettings = { ...userSettings, ...settings };
            config.updateSettings(updatedSettings);
            setUserSettings(updatedSettings);

            // Apply theme change if theme setting was updated
            if (settings.theme) {
                applyTheme(settings.theme);
            }
        }
    };

    // Handle session message additions
    const handleSaveMessage = (message: any) => {
        debugLog(`Adding message to session: ${message.role}`);
        if (currentSession) {
            console.log('[DEBUG-SAVE-MESSAGE] Before adding message:', {
                sessionId: currentSession.session_id,
                messageCount: currentSession.messages.length,
                newMessageRole: message.role,
                contentPreview: message.content.substring(0, 30) + '...'
            });

            // THIS FUNCTION IS NOT BEING USED BY THE COMPONENTS ANYMORE
            // BUT KEEPING FOR BACKWARDS COMPATIBILITY

            // Make a copy of the current session to avoid issues with React state updates
            const sessionCopy = new ChatSession(
                currentSession.session_id,
                currentSession.title,
                currentSession.provider,
                currentSession.model
            );
            sessionCopy.created_at = currentSession.created_at;
            sessionCopy.messages = [...currentSession.messages]; // Create a new array with the existing messages

            // Add the message to the copy
            sessionCopy.addMessage(message.role, message.content);

            console.log('[DEBUG-SAVE-MESSAGE] After adding message:', {
                sessionId: sessionCopy.session_id,
                messageCount: sessionCopy.messages.length
            });

            // Update the current session with the copy that has the new message
            setCurrentSession(sessionCopy);
        }
    };

    // Update the session state
    const handleUpdateSession = (updatedSession: ChatSession) => {
        try {
            debugLog(`Updating session ${updatedSession.session_id}`);
            console.log('[DEBUG-UPDATE] Session type check:',
                updatedSession.constructor?.name,
                'Has methods:', typeof updatedSession.addMessage === 'function');

            // Just set the reference directly - don't create a plain object
            setCurrentSession(updatedSession);

            // Save to disk
            if (typeof updatedSession.save === 'function') {
                updatedSession.save();
                debugLog('Session saved to disk');
            } else {
                console.error('Unable to save session: save method not available');
                console.log('Session object:', updatedSession);
            }
        } catch (error) {
            console.error('Error updating session:', error);
        }
    };

    // Handle error logging for the error boundary
    const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
        const classifiedError = classifyError(error);
        console.error('Error caught by ErrorBoundary:', classifiedError);
        console.error('Error Info:', errorInfo);

        // Track error in analytics
        trackEvent('error_boundary_caught', {
            error_message: classifiedError.message,
            error_type: classifiedError.type,
            component_stack: errorInfo.componentStack
        });
    };

    // Custom error fallback component
    const renderErrorFallback = (error: Error, resetError: () => void) => (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="max-w-md text-center">
                <h2 className="text-2xl font-bold mb-4">Oops, something went wrong</h2>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md mb-6 text-left">
                    <p className="font-mono text-sm text-red-700 dark:text-red-400">
                        {formatErrorForUser(error)}
                    </p>
                </div>
                <p className="mb-6">Don't worry, your data is safe. Here are some things you can try:</p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={resetError}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        Try again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Reload application
                    </button>
                </div>
            </div>
        </div>
    );

    // If there's an initialization error, show it first
    if (initError) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <div className="max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">Initialization Error</h2>
                    <p className="mb-6">{initError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        Reload Application
                    </button>
                </div>
            </div>
        );
    }

    // Show loading state while initializing
    if (!isInitialized || !config || !userSettings || !currentSession) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-lg">Loading Trmx Agent...</p>
                </div>
            </div>
        );
    }

    // Wrap the entire application in the error boundary
    return (
        <ErrorBoundary onError={handleError} fallback={renderErrorFallback}>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                {/* Sidebar */}
                {/* @ts-ignore - Sidebar props will be updated later */}
                <Sidebar
                    config={config}
                    onViewChange={handleViewChange}
                    onSessionChange={handleSessionChange}
                    onNewSession={handleNewSession}
                    currentView={view}
                    currentSession={currentSession}
                />

                {/* Main content area */}
                <div className="flex-1 overflow-hidden">
                    {view === 'chat' && currentSession && (
                        <ErrorBoundary
                            onError={(error) => {
                                console.error('Chat interface error:', error);
                                trackEvent('chat_interface_error', { error_message: error.message });
                            }}
                        >
                            <ChatInterface
                                session={currentSession}
                                config={config}
                                settings={userSettings}
                                updateSession={handleUpdateSession}
                                onSaveMessage={handleSaveMessage}
                            />
                        </ErrorBoundary>
                    )}

                    {view === 'sessions' && (
                        <div className="flex-1 p-4 overflow-y-auto">
                            <h1 className="text-2xl font-bold mb-4">Chat Sessions</h1>
                            <div className="grid gap-4">
                                {ChatSession.listSessions().map((session) => (
                                    <div
                                        key={session.session_id}
                                        className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
                                        onClick={() => {
                                            const loadedSession = ChatSession.load(session.session_id);
                                            if (loadedSession) {
                                                handleSessionChange(loadedSession);
                                            }
                                        }}
                                    >
                                        <h2 className="text-xl font-semibold">{session.title}</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {session.formatted_time} • {session.message_count} messages
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                            {session.preview}
                                        </p>
                                        <div className="mt-2 flex text-xs">
                                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                                {session.provider}
                                            </span>
                                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded ml-2">
                                                {session.model.split('/').pop() || session.model}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {view === 'providers' && (
                        <ErrorBoundary>
                            <ProviderSelection
                                config={config}
                            />
                        </ErrorBoundary>
                    )}

                    {view === 'settings' && (
                        <ErrorBoundary>
                            <Settings
                                settings={userSettings}
                                onSettingsChange={handleSettingsChange}
                            />
                        </ErrorBoundary>
                    )}

                    {view === 'mcp-playground' && (
                        <ErrorBoundary>
                            <MCPPlayground
                                config={config}
                            />
                        </ErrorBoundary>
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default App; 