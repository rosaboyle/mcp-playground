/**
 * Theme utility functions
 */

/**
 * Apply the selected theme to the document
 * @param theme The theme to apply (light, dark, or system)
 */
export const applyTheme = (theme: 'light' | 'dark' | 'system'): void => {
    const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

/**
 * Set up a listener for system theme changes when using 'system' theme
 * @param currentTheme The current theme setting
 */
export const setupThemeListener = (currentTheme: 'light' | 'dark' | 'system'): () => void => {
    // Only set up the listener if we're using system theme
    if (currentTheme !== 'system' || !window.matchMedia) {
        return () => { }; // No-op cleanup
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Handler for theme changes
    const themeChangeHandler = (e: MediaQueryListEvent) => {
        if (e.matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // Add the listener
    mediaQuery.addEventListener('change', themeChangeHandler);

    // Return cleanup function
    return () => {
        mediaQuery.removeEventListener('change', themeChangeHandler);
    };
} 