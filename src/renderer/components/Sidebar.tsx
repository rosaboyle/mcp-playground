import React from 'react';
import { FiList, FiMessageSquare, FiPlus, FiServer, FiSettings, FiTerminal } from 'react-icons/fi';
import { Config } from '../../shared/config';
import { ChatSession } from '../../shared/storage';

interface SidebarProps {
    config?: Config;
    currentView: 'chat' | 'sessions' | 'providers' | 'settings' | 'mcp-playground';
    onViewChange: (view: 'chat' | 'sessions' | 'providers' | 'settings' | 'mcp-playground') => void;
    onNewSession: () => void;
    onSessionChange?: (session: ChatSession | null) => void;
    currentSession?: ChatSession;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onNewSession }) => {
    // Navigation items
    const navItems = [
        { id: 'chat', label: 'Current Chat', icon: <FiMessageSquare size={20} /> },
        { id: 'sessions', label: 'Sessions', icon: <FiList size={20} /> },
        { id: 'providers', label: 'Providers', icon: <FiServer size={20} /> },
        { id: 'mcp-playground', label: 'MCP Playground', icon: <FiTerminal size={20} /> },
        { id: 'settings', label: 'Settings', icon: <FiSettings size={20} /> },
    ] as const;

    return (
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* App title */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">Trmx Agent</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI Chat Interface</p>
            </div>

            {/* New chat button */}
            <button
                className="mx-4 mt-4 p-2 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                onClick={onNewSession}
            >
                <FiPlus size={18} />
                <span>New Chat</span>
            </button>

            {/* Navigation */}
            <nav className="mt-6 flex-1">
                <ul>
                    {navItems.map((item) => (
                        <li key={item.id}>
                            <button
                                className={`w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${currentView === item.id ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 font-medium' : ''
                                    }`}
                                onClick={() => onViewChange(item.id)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* App version */}
            <div className="p-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                <p>Trmx Agent v0.1.0</p>
                <p>Built with Airtrain & Electron</p>
            </div>
        </div>
    );
};

export default Sidebar; 