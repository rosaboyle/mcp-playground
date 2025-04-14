import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../../../../renderer/components/Settings';
import UpdaterSection from '../../../../renderer/components/UpdaterSection';

// Mock the UpdaterSection component to simplify testing
jest.mock('../../../../renderer/components/UpdaterSection', () => {
    return function MockUpdaterSection() {
        return <div data-testid="mock-updater-section">Updates Section Placeholder</div>
    }
});

describe('Settings', () => {
    const mockSettings = {
        theme: 'light' as const,
        time_style: 'human',
        show_thinking: true,
        use_markdown: true
    };

    const mockOnSettingsChange = jest.fn();

    beforeEach(() => {
        mockOnSettingsChange.mockClear();
    });

    it('renders all settings sections', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Appearance')).toBeInTheDocument();
        expect(screen.getByText('Chat')).toBeInTheDocument();
        expect(screen.getByText('Time Display')).toBeInTheDocument();
        expect(screen.getByTestId('mock-updater-section')).toBeInTheDocument();
    });

    it('renders theme options with correct selected state', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        const lightButton = screen.getByText('Light');
        const darkButton = screen.getByText('Dark');
        const systemButton = screen.getByText('System');

        // Light should be selected
        expect(lightButton).toHaveClass('bg-primary-100');
        expect(darkButton).not.toHaveClass('bg-primary-100');
        expect(systemButton).not.toHaveClass('bg-primary-100');
    });

    it('calls onSettingsChange when theme is changed', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        fireEvent.click(screen.getByText('Dark'));

        expect(mockOnSettingsChange).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('renders time format options with correct selected state', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        // Find all time format options
        const humanOption = screen.getByText(/Human/);

        // Human should be selected since settings.time_style is 'human'
        expect(humanOption).toHaveClass('bg-primary-100');
    });

    it('calls onSettingsChange when time format is changed', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        fireEvent.click(screen.getByText(/ISO/));

        expect(mockOnSettingsChange).toHaveBeenCalledWith({ time_style: 'iso' });
    });

    it('renders toggle switches with correct states', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        // Find toggle switches by their labels
        const showThinkingLabel = screen.getByText('Show AI thinking');
        const renderMarkdownLabel = screen.getByText('Render markdown in responses');

        // Get the associated toggle switches (they are the next sibling div of the labels)
        const showThinkingToggle = showThinkingLabel.nextElementSibling;
        const renderMarkdownToggle = renderMarkdownLabel.nextElementSibling;

        // Both should be on (bg-primary-500) based on our mockSettings
        expect(showThinkingToggle).toHaveClass('bg-primary-500');
        expect(renderMarkdownToggle).toHaveClass('bg-primary-500');
    });

    it('calls onSettingsChange when show thinking toggle is clicked', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        const showThinkingLabel = screen.getByText('Show AI thinking');
        const showThinkingToggle = showThinkingLabel.nextElementSibling as HTMLElement;

        fireEvent.click(showThinkingToggle);

        expect(mockOnSettingsChange).toHaveBeenCalledWith({ show_thinking: false });
    });

    it('calls onSettingsChange when markdown toggle is clicked', () => {
        render(<Settings settings={mockSettings} onSettingsChange={mockOnSettingsChange} />);

        const renderMarkdownLabel = screen.getByText('Render markdown in responses');
        const renderMarkdownToggle = renderMarkdownLabel.nextElementSibling as HTMLElement;

        fireEvent.click(renderMarkdownToggle);

        expect(mockOnSettingsChange).toHaveBeenCalledWith({ use_markdown: false });
    });
}); 