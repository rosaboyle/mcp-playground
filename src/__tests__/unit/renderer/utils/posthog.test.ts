import * as posthogModule from '../../../../renderer/utils/posthog';

// Mock the PostHog library
jest.mock('posthog-js', () => {
    return {
        __loaded: false,
        init: jest.fn().mockImplementation(() => { }),
        capture: jest.fn(),
        identify: jest.fn(),
        startSessionRecording: jest.fn(),
    };
});

// Mock window for Electron environment checks
Object.defineProperty(global, 'window', {
    value: {
        electron: {
            ipcRenderer: {
                invoke: jest.fn().mockResolvedValue(false)
            }
        },
        __posthog_full_bundle: undefined
    },
    writable: true
});

describe('PostHog Analytics Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the loaded state before each test
        (require('posthog-js') as any).__loaded = false;
    });

    describe('initPostHog', () => {
        it('initializes PostHog with correct settings', async () => {
            await posthogModule.initPostHog();

            const posthog = require('posthog-js');
            expect(posthog.init).toHaveBeenCalledWith(
                'phc_EoMHKFbx6j2wUFsf8ywqgHntY4vEXC3ZzLFoPJVjRRT',
                expect.objectContaining({
                    api_host: 'https://us.i.posthog.com',
                    disable_session_recording: false,
                    capture_pageview: true,
                    autocapture: true,
                    capture_performance: true
                })
            );

            // Check if startSessionRecording is called when loaded callback is triggered
            const loadedCallback = posthog.init.mock.calls[0][1].loaded;
            loadedCallback(posthog);
            expect(posthog.startSessionRecording).toHaveBeenCalled();
        });

        it('does not re-initialize if already loaded', async () => {
            // Mark PostHog as already loaded
            (require('posthog-js') as any).__loaded = true;

            await posthogModule.initPostHog();

            const posthog = require('posthog-js');
            expect(posthog.init).not.toHaveBeenCalled();
        });

        it('handles initialization errors gracefully', async () => {
            const posthog = require('posthog-js');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            posthog.init.mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            await posthogModule.initPostHog();

            expect(consoleSpy).toHaveBeenCalledWith(
                '[PostHog] Failed to initialize',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('trackEvent', () => {
        it('captures events with properties', () => {
            const properties = { test: 'value' };
            const posthog = require('posthog-js');

            posthogModule.trackEvent('test_event', properties);

            expect(posthog.capture).toHaveBeenCalledWith('test_event', properties);
        });

        it('captures events without properties', () => {
            const posthog = require('posthog-js');

            posthogModule.trackEvent('test_event');

            expect(posthog.capture).toHaveBeenCalledWith('test_event', undefined);
        });

        it('handles tracking errors gracefully', () => {
            const posthog = require('posthog-js');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            posthog.capture.mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            posthogModule.trackEvent('test_event');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[PostHog] Failed to track event: test_event',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('identifyUser', () => {
        it('identifies users with properties', () => {
            const properties = { test: 'value' };
            const posthog = require('posthog-js');

            posthogModule.identifyUser('user123', properties);

            expect(posthog.identify).toHaveBeenCalledWith('user123', properties);
        });

        it('identifies users without properties', () => {
            const posthog = require('posthog-js');

            posthogModule.identifyUser('user123');

            expect(posthog.identify).toHaveBeenCalledWith('user123', undefined);
        });

        it('handles identification errors gracefully', () => {
            const posthog = require('posthog-js');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            posthog.identify.mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            posthogModule.identifyUser('user123');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[PostHog] Failed to identify user: user123',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('trackPageView', () => {
        it('captures page views with custom URL', () => {
            const posthog = require('posthog-js');

            posthogModule.trackPageView('settings-screen');

            expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
                $current_url: 'settings-screen'
            });
        });

        it('captures page views with default URL', () => {
            const posthog = require('posthog-js');

            posthogModule.trackPageView('');

            expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
                $current_url: 'main'
            });
        });

        it('handles page view tracking errors gracefully', () => {
            const posthog = require('posthog-js');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            posthog.capture.mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            posthogModule.trackPageView('test-page');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[PostHog] Failed to track page view',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });
}); 