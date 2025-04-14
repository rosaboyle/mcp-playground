import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpdaterSection from '../../../../renderer/components/UpdaterSection';

describe('UpdaterSection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.electron.app.getVersion.mockReturnValue('0.1.2-test');
    });

    it('renders with current version', () => {
        render(<UpdaterSection />);
        expect(screen.getByText('Updates')).toBeInTheDocument();
        expect(screen.getByText('Current Version')).toBeInTheDocument();
        expect(screen.getByText('0.1.2-test')).toBeInTheDocument();
        expect(screen.getByText('Check for Updates')).toBeInTheDocument();
    });

    it('shows checking state when checking for updates', async () => {
        // Setup a delayed promise for the check for updates call
        window.electron.updater.checkForUpdates.mockImplementation(() => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve({ success: true });
                }, 100);
            });
        });

        render(<UpdaterSection />);

        // Click the check for updates button
        const checkButton = screen.getByText('Check for Updates');
        fireEvent.click(checkButton);

        // Check that we see the loading indicator
        expect(await screen.findByText('Checking for updates...')).toBeInTheDocument();

        // Wait for the check to complete
        await waitFor(() => {
            expect(window.electron.updater.checkForUpdates).toHaveBeenCalled();
        });
    });

    it('shows error message when check fails', async () => {
        // Mock a failed check
        window.electron.updater.checkForUpdates.mockResolvedValue({
            success: false,
            message: 'Failed to check for updates'
        });

        render(<UpdaterSection />);

        // Click the check for updates button
        const checkButton = screen.getByText('Check for Updates');
        fireEvent.click(checkButton);

        // Check that we see the error message
        expect(await screen.findByText('Failed to check for updates')).toBeInTheDocument();
    });

    it('shows available update when update is available', async () => {
        // Set up the onUpdateAvailable event
        window.electron.updater.onUpdateAvailable.mockImplementation(callback => {
            // Immediately call the callback to simulate an update being available
            setTimeout(() => {
                callback({ version: '0.2.0' });
            }, 10);
            return jest.fn();
        });

        render(<UpdaterSection />);

        // Wait for the update available message
        expect(await screen.findByText('Version 0.2.0 is available!')).toBeInTheDocument();

        // Check that the download button appears
        expect(screen.getByText('Download Update')).toBeInTheDocument();
    });

    it('shows download progress when downloading', async () => {
        // Set up the onUpdateAvailable event
        window.electron.updater.onUpdateAvailable.mockImplementation(callback => {
            // Immediately call the callback to simulate an update being available
            callback({ version: '0.2.0' });
            return jest.fn();
        });

        // Set up the onDownloadProgress event
        window.electron.updater.onDownloadProgress.mockImplementation(callback => {
            // Call with progress updates
            setTimeout(() => callback({ percent: 50 }), 10);
            return jest.fn();
        });

        render(<UpdaterSection />);

        // Wait for download button and click it
        const downloadButton = await screen.findByText('Download Update');
        fireEvent.click(downloadButton);

        // Wait for the progress indicator
        await waitFor(() => {
            expect(screen.getByText('50% downloaded')).toBeInTheDocument();
        });
    });

    it('shows download complete when download finishes', async () => {
        // Set up the onUpdateAvailable and onUpdateDownloaded events
        window.electron.updater.onUpdateAvailable.mockImplementation(callback => {
            callback({ version: '0.2.0' });
            return jest.fn();
        });

        window.electron.updater.onUpdateDownloaded.mockImplementation(callback => {
            setTimeout(() => callback(), 10);
            return jest.fn();
        });

        render(<UpdaterSection />);

        // Wait for the update downloaded message
        expect(await screen.findByText('Update has been downloaded and is ready to install.')).toBeInTheDocument();

        // Check that the install button appears
        expect(screen.getByText('Install & Restart')).toBeInTheDocument();
    });

    it('calls quitAndInstall when install button is clicked', async () => {
        // Set up the onUpdateAvailable and onUpdateDownloaded events
        window.electron.updater.onUpdateAvailable.mockImplementation(callback => {
            callback({ version: '0.2.0' });
            return jest.fn();
        });

        window.electron.updater.onUpdateDownloaded.mockImplementation(callback => {
            callback();
            return jest.fn();
        });

        render(<UpdaterSection />);

        // Wait for the install button and click it
        const installButton = await screen.findByText('Install & Restart');
        fireEvent.click(installButton);

        // Check that quitAndInstall was called
        expect(window.electron.updater.quitAndInstall).toHaveBeenCalled();
    });
}); 