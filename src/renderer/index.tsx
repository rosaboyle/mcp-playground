// Import PostHog loader first to ensure it's loaded before anything else
import './posthog-loader';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Get the container for the React app
const container = document.getElementById('root');

if (!container) {
    throw new Error('Root container not found. Unable to mount React app.');
}

// Create a root for React to render into
const root = createRoot(container);

// Render the app
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
); 