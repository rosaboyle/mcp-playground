import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../../../renderer/components/ErrorBoundary';
import '@testing-library/jest-dom';
import { formatErrorForUser } from '../../../../shared/errors';

// Mock the debug log function
jest.mock('../../../../renderer/utils/chat', () => ({
    debugLog: jest.fn(),
}));

// Mock formatErrorForUser function
jest.mock('../../../../shared/errors', () => ({
    formatErrorForUser: jest.fn().mockImplementation((error) => `Formatted: ${error.message}`),
}));

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
    value: { reload: mockReload },
    writable: true
});

// Component that throws an error when shouldThrow is true
const ErrorThrowingComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

// Mock console methods to suppress expected error messages
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
    // Only log errors that aren't from React's error boundary
    if (!args[0]?.includes('React will try to recreate this component tree')) {
        console.log(...args);
    }
});

describe('ErrorBoundary', () => {
    beforeAll(() => {
        // Already mocked above
    });

    afterAll(() => {
        mockConsoleError.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockReload.mockClear();
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Child content</div>
            </ErrorBoundary>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders fallback UI when an error occurs', () => {
        // Suppress error boundary errors for this test
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // We need to catch the error that happens during render
        const wrapper = ({ children }: { children: React.ReactNode }) => children;

        // Using render with the expectation that it will trigger error boundary
        const { container } = render(
            <ErrorBoundary>
                <ErrorThrowingComponent shouldThrow={true} />
            </ErrorBoundary>,
            { wrapper }
        );

        // The error boundary renders an h2 with this text
        expect(container.textContent).toContain('Something went wrong');

        // Check that the error message is displayed
        expect(container.textContent).toContain('Formatted: Test error');

        // Check for the presence of buttons
        expect(container.textContent).toContain('Try again');
        expect(container.textContent).toContain('Reload application');

        // Verify formatErrorForUser was called
        expect(formatErrorForUser).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('uses custom fallback component when provided', () => {
        // Suppress error boundary errors for this test
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const CustomFallback = () => <div data-testid="custom-fallback">Custom error message</div>;

        const { container } = render(
            <ErrorBoundary fallback={<CustomFallback />}>
                <ErrorThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        // Check for the custom fallback
        expect(container.textContent).toContain('Custom error message');

        spy.mockRestore();
    });

    it('uses fallback function when provided', () => {
        // Suppress error boundary errors for this test
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const fallbackFn = jest.fn((error, resetError) => (
            <div data-testid="functional-fallback">
                <p>Error: {error.message}</p>
                <button data-testid="reset-button" onClick={resetError}>Reset</button>
            </div>
        ));

        const { container } = render(
            <ErrorBoundary fallback={fallbackFn}>
                <ErrorThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        // Check for the functional fallback content
        expect(container.textContent).toContain('Error: Test error');

        spy.mockRestore();
    });

    it('calls onError when an error occurs', () => {
        // Suppress error boundary errors for this test
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const handleError = jest.fn();

        render(
            <ErrorBoundary onError={handleError}>
                <ErrorThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        // Verify error handler was called
        expect(handleError).toHaveBeenCalled();

        spy.mockRestore();
    });

    it('allows resetting the error state', () => {
        // Create an instance with error state pre-populated
        class TestErrorBoundary extends ErrorBoundary {
            constructor(props) {
                super(props);
                this.state = {
                    hasError: true,
                    error: new Error('Test error')
                };
            }
        }

        const { container } = render(<TestErrorBoundary />);

        // Verify error state is rendering
        expect(container.textContent).toContain('Something went wrong');

        // Find and click the try again button using container queries
        const tryAgainButton = Array.from(container.querySelectorAll('button'))
            .find(button => button.textContent === 'Try again');
        fireEvent.click(tryAgainButton);

        // After clicking, the error UI should be gone
        expect(container.textContent).not.toContain('Something went wrong');
    });

    it('reloads the application when reload button is clicked', () => {
        // Suppress error boundary errors for this test
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

        class TestErrorBoundary extends ErrorBoundary {
            constructor(props) {
                super(props);
                this.state = {
                    hasError: true,
                    error: new Error('Test error')
                };
            }
        }

        const { container } = render(<TestErrorBoundary />);

        // Find and click the reload button using container queries
        const reloadButton = Array.from(container.querySelectorAll('button'))
            .find(button => button.textContent === 'Reload application');
        fireEvent.click(reloadButton);

        // Verify reload was called
        expect(mockReload).toHaveBeenCalled();

        spy.mockRestore();
    });
}); 