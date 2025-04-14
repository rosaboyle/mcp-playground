import React from 'react';
import { UserSettings } from '../../shared/types';
import UpdaterSection from './UpdaterSection';

interface SettingsProps {
    settings: UserSettings;
    onSettingsChange: (settings: Partial<UserSettings>) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange }) => {
    // Handle theme change
    const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
        onSettingsChange({ theme });
    };

    // Handle time style change
    const handleTimeStyleChange = (timeStyle: string) => {
        onSettingsChange({ time_style: timeStyle });
    };

    // Handle toggle for showing thinking
    const handleShowThinkingToggle = () => {
        onSettingsChange({ show_thinking: !settings.show_thinking });
    };

    // Handle toggle for markdown rendering
    const handleMarkdownToggle = () => {
        onSettingsChange({ use_markdown: !settings.use_markdown });
    };

    return (
        <div className="flex-1 h-full flex flex-col overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto">
                <h1 className="text-2xl font-bold mb-6">Settings</h1>

                <div className="max-w-2xl space-y-8 pb-8">
                    {/* Theme Settings */}
                    <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h2 className="text-xl font-semibold mb-4">Appearance</h2>

                        <div className="mb-4">
                            <label className="block text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                            <div className="flex flex-wrap gap-3">
                                {['light', 'dark', 'system'].map((theme) => (
                                    <button
                                        key={theme}
                                        className={`px-4 py-2 rounded-md border ${settings.theme === theme
                                            ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                            }`}
                                        onClick={() => handleThemeChange(theme as 'light' | 'dark' | 'system')}
                                    >
                                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Chat Settings */}
                    <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h2 className="text-xl font-semibold mb-4">Chat</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-gray-700 dark:text-gray-300">Show AI thinking</label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${settings.show_thinking ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    onClick={handleShowThinkingToggle}
                                >
                                    <span
                                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${settings.show_thinking ? 'transform translate-x-6' : ''
                                            }`}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-gray-700 dark:text-gray-300">Render markdown in responses</label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${settings.use_markdown ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    onClick={handleMarkdownToggle}
                                >
                                    <span
                                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${settings.use_markdown ? 'transform translate-x-6' : ''
                                            }`}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Time Settings */}
                    <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                        <h2 className="text-xl font-semibold mb-4">Time Display</h2>

                        <div>
                            <label className="block text-gray-700 dark:text-gray-300 mb-2">Time Format</label>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { id: 'iso', label: 'ISO (2023-01-01T12:00:00Z)' },
                                    { id: 'human', label: 'Human (1/1/2023, 12:00:00 PM)' },
                                    { id: 'relative', label: 'Relative (2 hours ago)' }
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        className={`px-4 py-2 rounded-md border ${settings.time_style === option.id
                                            ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                            }`}
                                        onClick={() => handleTimeStyleChange(option.id)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Application Updates */}
                    <UpdaterSection />
                </div>
            </div>
        </div>
    );
};

export default Settings; 