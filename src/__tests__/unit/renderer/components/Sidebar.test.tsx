import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../../../../renderer/components/Sidebar';

// Mock icon components since they may cause issues in tests
jest.mock('react-icons/fi', () => ({
    FiList: () => <div data-testid="icon-list" />,
    FiMessageSquare: () => <div data-testid="icon-message" />,
    FiPlus: () => <div data-testid="icon-plus" />,
    FiServer: () => <div data-testid="icon-server" />,
    FiSettings: () => <div data-testid="icon-settings" />,
    FiTerminal: () => <div data-testid="icon-terminal" />
}));

// Mock the Config and ChatSession since they're not needed for these tests
jest.mock('../../../../shared/config', () => ({}));
jest.mock('../../../../shared/storage', () => ({}));

describe('Sidebar', () => {
    const mockOnViewChange = jest.fn();
    const mockOnNewSession = jest.fn();

    beforeEach(() => {
        mockOnViewChange.mockClear();
        mockOnNewSession.mockClear();
    });

    it('renders the sidebar with app title', () => {
        render(
            <Sidebar
                currentView="chat"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        expect(screen.getByText('Trmx Agent')).toBeInTheDocument();
        expect(screen.getByText('AI Chat Interface')).toBeInTheDocument();
    });

    it('renders a new chat button', () => {
        render(
            <Sidebar
                currentView="chat"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        const newChatButton = screen.getByText('New Chat');
        expect(newChatButton).toBeInTheDocument();
    });

    it('calls onNewSession when new chat button is clicked', () => {
        render(
            <Sidebar
                currentView="chat"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        const newChatButton = screen.getByText('New Chat');
        fireEvent.click(newChatButton);

        expect(mockOnNewSession).toHaveBeenCalledTimes(1);
    });

    it('renders all navigation items', () => {
        render(
            <Sidebar
                currentView="chat"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        expect(screen.getByText('Current Chat')).toBeInTheDocument();
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getByText('Providers')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('MCP Playground')).toBeInTheDocument();
    });

    it('applies correct styling to the current view item', () => {
        render(
            <Sidebar
                currentView="settings"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        const settingsButton = screen.getByText('Settings').closest('button');
        const chatButton = screen.getByText('Current Chat').closest('button');

        expect(settingsButton).toHaveClass('bg-gray-100');
        expect(chatButton).not.toHaveClass('bg-gray-100');
    });

    it('calls onViewChange with correct view ID when navigation item is clicked', () => {
        render(
            <Sidebar
                currentView="chat"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        fireEvent.click(screen.getByText('Settings'));
        expect(mockOnViewChange).toHaveBeenCalledWith('settings');

        fireEvent.click(screen.getByText('Sessions'));
        expect(mockOnViewChange).toHaveBeenCalledWith('sessions');
    });

    it('renders app version information', () => {
        render(
            <Sidebar
                currentView="chat"
                onViewChange={mockOnViewChange}
                onNewSession={mockOnNewSession}
            />
        );

        expect(screen.getByText(/Trmx Agent v/)).toBeInTheDocument();
        expect(screen.getByText('Built with Airtrain & Electron')).toBeInTheDocument();
    });
}); 