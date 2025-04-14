import { API_KEY_ENV_VARS, DEFAULT_MODELS, PROVIDERS, ProviderConfig, UserSettings } from './types';

// Debug logging function
const debugLog = (message: string) => {
    console.log(`[CONFIG DEBUG] ${message}`);
}

// Default settings
const DEFAULT_TIME_STYLE = 'iso'; // Options: "iso", "human", "relative"
const DEFAULT_THEME = 'system'; // Options: "light", "dark", "system"

// Default provider and model configuration
const DEFAULT_PROVIDER = 'fireworks';
const DEFAULT_MODEL = 'accounts/fireworks/models/deepseek-r1';

// Helper function to check if we're in the renderer process
const isRenderer = () => {
    return typeof window !== 'undefined' && window.electron !== undefined;
};

// Helper function to safely require modules (for testing environment)
const safeRequire = (moduleName: string) => {
    try {
        if (typeof require !== 'undefined') {
            return require(moduleName);
        }
    } catch (error) {
        console.error(`Error requiring module ${moduleName}:`, error);
        debugLog(`Cannot require module ${moduleName} - this is expected in browser environments`);
    }
    return null;
};

// Helper for file operations
const fileSystem = {
    existsSync: (path: string): boolean => {
        if (isRenderer()) {
            return window.electron.fs.exists(path);
        }
        // Fallback for non-renderer context (used during testing)
        const fs = safeRequire('fs');
        if (fs) {
            return fs.existsSync(path);
        }
        debugLog('fs module not available - returning false');
        return false;
    },

    mkdirSync: (path: string, options?: any): void => {
        if (isRenderer()) {
            window.electron.fs.mkdir(path, options);
            return;
        }
        // Fallback for non-renderer context
        const fs = safeRequire('fs');
        if (fs) {
            fs.mkdirSync(path, options);
        } else {
            debugLog(`Cannot create directory ${path} - fs module not available`);
        }
    },

    readFileSync: (path: string, encoding: string): string => {
        if (isRenderer()) {
            try {
                const content = window.electron.fs.readFile(path, encoding);
                // Ensure we always return a string
                return typeof content === 'string' ? content : content.toString();
            } catch (error) {
                debugLog(`Error reading file ${path}: ${(error as Error).message}`);
                return '';
            }
        }
        // Fallback for non-renderer context
        const fs = safeRequire('fs');
        if (fs) {
            try {
                return fs.readFileSync(path, encoding).toString();
            } catch (error) {
                debugLog(`Error reading file ${path}: ${(error as Error).message}`);
                return '';
            }
        }
        debugLog(`Cannot read file ${path} - fs module not available`);
        return '';
    },

    writeFileSync: (path: string, data: string, encoding: string): void => {
        if (isRenderer()) {
            try {
                window.electron.fs.writeFile(path, data, encoding);
            } catch (error) {
                debugLog(`Error writing file ${path}: ${(error as Error).message}`);
            }
            return;
        }
        // Fallback for non-renderer context
        const fs = safeRequire('fs');
        if (fs) {
            try {
                fs.writeFileSync(path, data, encoding);
            } catch (error) {
                debugLog(`Error writing file ${path}: ${(error as Error).message}`);
            }
        } else {
            debugLog(`Cannot write file ${path} - fs module not available`);
        }
    }
};

// Helper for path operations
const pathUtil = {
    join: (...paths: string[]): string => {
        if (isRenderer()) {
            return window.electron.path.join(...paths);
        }
        // Fallback for non-renderer context
        const path = safeRequire('path');
        if (path) {
            return path.join(...paths);
        }
        // Cross-platform fallback implementation
        debugLog('path module not available - using cross-platform join');
        // First normalize all path separators to forward slashes
        const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'));
        // Join with forward slash and normalize multiple slashes
        const joinedPath = normalizedPaths.join('/').replace(/\/+/g, '/');
        // Remove trailing slash except for root
        return joinedPath.endsWith('/') && joinedPath.length > 1
            ? joinedPath.slice(0, -1)
            : joinedPath;
    }
};

/**
 * Configuration manager for the app
 */
export class Config {
    public storageDir: string;
    public credentialsDir: string;
    public configDir: string;
    private providerConfig: ProviderConfig;
    private settingsFile: string;
    private settings: UserSettings;
    private initialized: boolean = false;

    /**
     * Initialize configuration with storage paths
     */
    constructor(storageDir: string, credentialsDir: string, configDir: string) {
        debugLog('Creating Config instance');
        this.storageDir = storageDir;
        this.credentialsDir = credentialsDir;
        this.configDir = configDir;

        // Ensure directories exist
        this.ensureDirectoriesExist();

        // User settings
        this.settingsFile = pathUtil.join(this.configDir, 'settings.json');
        this.settings = this.loadSettings();

        // Load provider configuration
        this.providerConfig = this.loadProviderConfig();

        // Don't call initializeCredentials here - it will be called separately
        // to avoid using process.env in the renderer
        debugLog('Config instance created');
    }

    /**
     * Initialize credentials from environment variables (async)
     * This needs to be called separately after creating the Config instance
     */
    public async initializeCredentials(): Promise<void> {
        debugLog('Initializing credentials from environment variables');
        try {
            // Try to load API keys from environment variables using IPC
            for (const [provider, envVar] of Object.entries(API_KEY_ENV_VARS)) {
                try {
                    debugLog(`Getting environment variable for ${provider}: ${envVar}`);
                    // Use IPC to get environment variables instead of process.env
                    let apiKey = null;
                    if (isRenderer()) {
                        apiKey = await window.electron.ipcRenderer.invoke('get-env-variable', envVar);
                        debugLog(`Received API key for ${provider}: ${apiKey ? '✓' : '✗'}`);
                    } else {
                        debugLog('Window or window.electron not available');
                    }

                    if (apiKey && (!this.providerConfig.providers[provider] || !this.providerConfig.providers[provider].api_key)) {
                        // Make sure we have an entry for this provider
                        if (!this.providerConfig.providers[provider]) {
                            this.providerConfig.providers[provider] = {};
                        }

                        this.providerConfig.providers[provider].api_key = apiKey;
                        this.saveProviderConfig();
                    }
                } catch (error) {
                    console.error(`Error loading environment variable ${envVar}:`, error);
                    debugLog(`Error loading environment variable ${envVar}: ${(error as Error).message}`);
                }
            }
            this.initialized = true;
            debugLog('Credentials initialized successfully');
        } catch (error) {
            console.error('Error initializing credentials:', error);
            debugLog(`Error initializing credentials: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Check if initialization is complete
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Ensure all required directories exist
     */
    private ensureDirectoriesExist(): void {
        debugLog('Ensuring directories exist');
        try {
            if (!fileSystem.existsSync(this.storageDir)) {
                debugLog(`Creating storage directory: ${this.storageDir}`);
                fileSystem.mkdirSync(this.storageDir, { recursive: true });
            }

            if (!fileSystem.existsSync(this.credentialsDir)) {
                debugLog(`Creating credentials directory: ${this.credentialsDir}`);
                fileSystem.mkdirSync(this.credentialsDir, { recursive: true });
            }

            if (!fileSystem.existsSync(this.configDir)) {
                debugLog(`Creating config directory: ${this.configDir}`);
                fileSystem.mkdirSync(this.configDir, { recursive: true });
            }
            debugLog('All directories exist or were created');
        } catch (error) {
            console.error('Error creating directories:', error);
            debugLog(`Error creating directories: ${(error as Error).message}`);
        }
    }

    /**
     * Load user settings from file
     */
    private loadSettings(): UserSettings {
        debugLog('Loading user settings');
        try {
            if (fileSystem.existsSync(this.settingsFile)) {
                debugLog(`Settings file exists: ${this.settingsFile}`);
                const settings = JSON.parse(fileSystem.readFileSync(this.settingsFile, 'utf8')) as Partial<UserSettings>;
                debugLog('Settings loaded successfully');
                return {
                    time_style: settings.time_style || DEFAULT_TIME_STYLE,
                    theme: settings.theme || DEFAULT_THEME,
                    show_thinking: settings.show_thinking ?? false,
                    use_markdown: settings.use_markdown ?? true
                };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            debugLog(`Error loading settings: ${(error as Error).message}`);
        }

        debugLog('Using default settings');
        return {
            time_style: DEFAULT_TIME_STYLE,
            theme: DEFAULT_THEME,
            show_thinking: false,
            use_markdown: true
        };
    }

    /**
     * Save user settings to file
     */
    public saveSettings(): void {
        debugLog('Saving user settings');
        try {
            fileSystem.writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2), 'utf8');
            debugLog('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            debugLog(`Error saving settings: ${(error as Error).message}`);
        }
    }

    /**
     * Get user settings
     */
    public getSettings(): UserSettings {
        return { ...this.settings };
    }

    /**
     * Update user settings
     */
    public updateSettings(settings: Partial<UserSettings>): void {
        debugLog(`Updating settings: ${JSON.stringify(settings)}`);
        this.settings = { ...this.settings, ...settings };
        this.saveSettings();
    }

    /**
     * Load provider configuration from file
     */
    private loadProviderConfig(): ProviderConfig {
        debugLog('Loading provider configuration');
        const configFile = pathUtil.join(this.configDir, 'providers.json');

        try {
            if (fileSystem.existsSync(configFile)) {
                debugLog(`Provider config file exists: ${configFile}`);
                const config = JSON.parse(fileSystem.readFileSync(configFile, 'utf8')) as Partial<ProviderConfig>;
                debugLog('Provider config loaded successfully');

                // Ensure we have a valid configuration
                return {
                    active_provider: config.active_provider || DEFAULT_PROVIDER,
                    active_model: config.active_model || DEFAULT_MODEL,
                    providers: config.providers || {}
                };
            }
        } catch (error) {
            console.error('Error loading provider configuration:', error);
            debugLog(`Error loading provider configuration: ${(error as Error).message}`);
        }

        // Default configuration
        debugLog('Using default provider configuration');
        return {
            active_provider: DEFAULT_PROVIDER,
            active_model: DEFAULT_MODEL,
            providers: {}
        };
    }

    /**
     * Save provider configuration to file
     */
    private saveProviderConfig(): void {
        debugLog('Saving provider configuration');
        const configFile = pathUtil.join(this.configDir, 'providers.json');

        try {
            fileSystem.writeFileSync(configFile, JSON.stringify(this.providerConfig, null, 2), 'utf8');
            debugLog('Provider configuration saved successfully');
        } catch (error) {
            console.error('Error saving provider configuration:', error);
            debugLog(`Error saving provider configuration: ${(error as Error).message}`);
        }
    }

    /**
     * Get the provider configuration
     */
    public getProviderConfig(): ProviderConfig {
        return this.providerConfig;
    }

    /**
     * Get all available providers
     */
    public getProviders(): string[] {
        return Object.keys(PROVIDERS);
    }

    /**
     * Check if a provider has an API key set
     */
    public hasProviderApiKey(provider: string): boolean {
        return !!(
            this.providerConfig?.providers?.[provider]?.api_key ||
            (process.env && process.env[API_KEY_ENV_VARS[provider]])
        );
    }

    /**
     * Get all available models for a provider
     */
    public getModelsForProvider(provider: string): string[] {
        if (this.providerConfig?.providers?.[provider]?.models?.length) {
            return this.providerConfig.providers[provider].models || [];
        }
        return DEFAULT_MODELS[provider] || [];
    }

    /**
     * Get the active provider
     */
    public getActiveProvider(): string {
        return this.providerConfig?.active_provider || DEFAULT_PROVIDER;
    }

    /**
     * Set the active provider
     */
    public setActiveProvider(provider: string): void {
        debugLog(`Setting active provider to: ${provider}`);
        if (provider && Object.keys(PROVIDERS).includes(provider)) {
            this.providerConfig.active_provider = provider;

            // If no model is set for this provider, set the default
            if (!this.isModelForProvider(this.providerConfig.active_model, provider)) {
                this.providerConfig.active_model = this.getDefaultModelForProvider(provider);
            }

            this.saveProviderConfig();
        }
    }

    /**
     * Get the active model
     */
    public getActiveModel(): string {
        return this.providerConfig.active_model;
    }

    /**
     * Set the active model
     */
    public setActiveModel(model: string): void {
        debugLog(`Setting active model to: ${model}`);
        if (model) {
            this.providerConfig.active_model = model;
            this.saveProviderConfig();
        }
    }

    /**
     * Check if model belongs to provider
     */
    private isModelForProvider(model: string, provider: string): boolean {

        if (model.startsWith(`${provider}/`)) {
            return true;
        }

        // Handle models that are in the DEFAULT_MODELS list for this provider
        if (DEFAULT_MODELS[provider]?.includes(model)) {
            return true;
        }

        // Handle models that are added by the user for this provider
        if (this.providerConfig.providers[provider]?.models?.includes(model)) {
            return true;
        }

        return false;
    }

    /**
     * Get default model for provider
     */
    public getDefaultModelForProvider(provider: string): string {
        // Return the first model in the default list for this provider
        if (DEFAULT_MODELS[provider] && DEFAULT_MODELS[provider].length > 0) {
            return DEFAULT_MODELS[provider][0];
        }

        // Fallback to the current active model
        return this.providerConfig.active_model;
    }

    /**
     * Get provider API key
     */
    public getProviderApiKey(provider: string): string | null {
        return this.providerConfig.providers[provider]?.api_key || null;
    }

    /**
     * Set provider API key
     */
    public setProviderApiKey(provider: string, apiKey: string): void {
        debugLog(`Setting API key for provider: ${provider}`);
        if (!this.providerConfig.providers[provider]) {
            this.providerConfig.providers[provider] = {};
        }

        this.providerConfig.providers[provider].api_key = apiKey;
        this.saveProviderConfig();
    }

    /**
     * Get available models for provider
     */
    public getProviderModels(provider: string): string[] {
        // Start with default models
        const models = [...(DEFAULT_MODELS[provider] || [])];

        // Add user-defined models
        if (this.providerConfig.providers[provider]?.models) {
            for (const model of this.providerConfig.providers[provider].models!) {
                if (!models.includes(model)) {
                    models.push(model);
                }
            }
        }

        return models;
    }

    /**
     * Add a custom model for provider
     */
    public addCustomModelForProvider(provider: string, model: string): void {
        debugLog(`Adding custom model ${model} for provider ${provider}`);
        if (!this.providerConfig.providers[provider]) {
            this.providerConfig.providers[provider] = {};
        }

        if (!this.providerConfig.providers[provider].models) {
            this.providerConfig.providers[provider].models = [];
        }

        if (!this.providerConfig.providers[provider].models!.includes(model)) {
            this.providerConfig.providers[provider].models!.push(model);
            this.saveProviderConfig();
        }
    }

    /**
     * Remove a custom model for provider
     */
    public removeCustomModelForProvider(provider: string, model: string): void {
        debugLog(`Removing custom model ${model} for provider ${provider}`);
        if (
            this.providerConfig.providers[provider]?.models &&
            this.providerConfig.providers[provider].models!.includes(model)
        ) {
            this.providerConfig.providers[provider].models = this.providerConfig.providers[provider].models!.filter(
                m => m !== model
            );
            this.saveProviderConfig();
        }
    }
} 