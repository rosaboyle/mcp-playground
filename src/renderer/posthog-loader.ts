/**
 * This file loads the full PostHog bundle in the actual application
 * It's loaded at runtime, before the React app starts
 */

// Only run this in the actual app, not in tests
if (typeof window !== 'undefined' && typeof window.electron !== 'undefined') {
    try {
        // Dynamically import the PostHog full bundle
        import('posthog-js/dist/module.full.js')
            .then((module) => {
                console.log('[PostHog] Full bundle imported successfully');
                // Store the imported module for use in the posthog.ts utility
                window.__posthog_full_bundle = module.default;
            })
            .catch((error) => {
                console.error('[PostHog] Failed to import full bundle:', error);
            });
    } catch (error) {
        console.error('[PostHog] Error setting up PostHog full bundle:', error);
    }
}

export { }; 