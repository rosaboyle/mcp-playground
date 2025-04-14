import React, { Component, ErrorInfo, ReactNode } from 'react';
import { formatErrorForUser } from '../../shared/errors';
import { debugLog } from '../utils/chat';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * A React Error Boundary component that catches errors in its child component tree
 * and displays a fallback UI instead of crashing the entire application.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console
    debugLog('ErrorBoundary caught an error:');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);

    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function' && this.state.error) {
          // @ts-ignore - React 18 types issue with function as ReactNode
          return this.props.fallback(this.state.error, this.resetError);
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex flex-col max-w-md text-center">
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-4">
              Something went wrong
            </h2>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-md mb-4 overflow-auto max-h-40 text-sm font-mono text-left">
              {this.state.error ? formatErrorForUser(this.state.error) : 'Unknown error'}
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The application encountered an unexpected error. You can try to:
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={this.resetError}
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
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 