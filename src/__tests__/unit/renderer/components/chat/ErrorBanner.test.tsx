import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ErrorBanner from '../../../../../renderer/components/chat/ErrorBanner';

describe('ErrorBanner', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders the error message when error is provided', () => {
        const setError = jest.fn();
        render(<ErrorBanner error="Test error message" setError={setError} />);

        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('does not render anything when error is null', () => {
        const setError = jest.fn();
        const { container } = render(<ErrorBanner error={null} setError={setError} />);

        expect(container.firstChild).toBeNull();
    });

    it('clears the error after 5 seconds', () => {
        const setError = jest.fn();
        render(<ErrorBanner error="Test error message" setError={setError} />);

        // Fast-forward time
        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(setError).toHaveBeenCalledWith(null);
    });

    it('cleans up the timer on unmount', () => {
        const setError = jest.fn();
        const { unmount } = render(<ErrorBanner error="Test error message" setError={setError} />);

        // Clear any existing calls
        setError.mockClear();

        // Unmount the component
        unmount();

        // Fast-forward time
        act(() => {
            jest.advanceTimersByTime(5000);
        });

        // The setError shouldn't be called after unmount
        expect(setError).not.toHaveBeenCalled();
    });
}); 