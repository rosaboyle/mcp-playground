// Import PostHog - in production this will use the full bundle
// In tests, this will be mocked
import posthog from 'posthog-js';

/**
 * Detect if the app is running in production
 * This is more reliable than checking process.env.NODE_ENV which can be lost during bundling
 */
const isProduction = () => {
    // Check if app is running in Electron and not in developer mode
    return window.electron && !window.electron.ipcRenderer.invoke('is-dev');
};

/**
 * Get the correct PostHog bundle in the actual app
 * This ensures we're using the full bundle in the app but allowing tests to mock the normal import
 */
const getPostHogInstance = () => {
    // In the actual app, dynamically import the full bundle
    // This won't be executed in tests since we're mocking the module
    if (typeof window !== 'undefined' && window.electron) {
        try {
            // Try to use the full bundle in the app
            // This is a runtime check that won't affect Jest tests
            return window.__posthog_full_bundle || posthog;
        } catch (e) {
            console.error('[PostHog] Failed to load full bundle, falling back to standard import', e);
            return posthog;
        }
    }
    return posthog;
};

// Get the PostHog instance to use
const posthogInstance = getPostHogInstance();

/**
 * Initialize PostHog tracking with session recording for Electron
 */
export const initPostHog = async () => {
    // Only initialize once
    if (!posthogInstance.__loaded) {
        try {
            // Use PostHog's API key and host
            posthogInstance.init('phc_EoMHKFbx6j2wUFsf8ywqgHntY4vEXC3ZzLFoPJVjRRT', {
                api_host: 'https://us.i.posthog.com',
                disable_session_recording: false,  // Enable session recording/screen replay
                capture_pageview: true,
                autocapture: true, // Enable autocapture for all clicks, form submissions, etc.
                capture_performance: true,
                loaded: (posthog) => {
                    console.log('[PostHog] Loaded successfully');
                    // Explicitly start session recording for screen replay
                    posthog.startSessionRecording();
                }
            });
        } catch (error) {
            console.error('[PostHog] Failed to initialize', error);
        }
    }
};

/**
 * Track a custom event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    try {
        posthogInstance.capture(eventName, properties);
    } catch (error) {
        console.error(`[PostHog] Failed to track event: ${eventName}`, error);
    }
};

/**
 * Identify a user
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
    try {
        posthogInstance.identify(userId, properties);
    } catch (error) {
        console.error(`[PostHog] Failed to identify user: ${userId}`, error);
    }
};

/**
 * Track page view manually - needed for Electron apps since they don't have pages
 */
export const trackPageView = (pageName: string) => {
    try {
        posthogInstance.capture('$pageview', {
            $current_url: pageName || 'main'
        });
    } catch (error) {
        console.error('[PostHog] Failed to track page view', error);
    }
};

// Export PostHog instance directly for advanced usage
export { posthogInstance as posthog }; 