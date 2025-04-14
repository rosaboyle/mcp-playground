import React, { useEffect, useState } from 'react';
import { Config } from '../../shared/config';

// Debug logging function
const debugLog = (message: string) => {
    console.log(`[PROVIDER SELECTION DEBUG] ${message}`);
}

interface ProviderSelectionProps {
    config: Config;
}

const ProviderSelection: React.FC<ProviderSelectionProps> = ({ config }) => {
    // State
    const [providers, setProviders] = useState<string[]>([]);
    const [activeProvider, setActiveProvider] = useState<string>('');
    const [models, setModels] = useState<string[]>([]);
    const [activeModel, setActiveModel] = useState<string>('');
    const [apiKey, setApiKey] = useState('');
    const [isEditingKey, setIsEditingKey] = useState(false);
    const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
    const [selectedProvider, setSelectedProvider] = useState('fireworks');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' }>({ text: '', type: 'info' });

    // Show toast message
    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setMessage({ text, type });
        setTimeout(() => {
            setMessage({ text: '', type: 'info' });
        }, 3000);
    };

    // Load providers and models
    useEffect(() => {
        debugLog('Loading providers from config');

        // Get providers from config
        const configProviders = config.getProviders();
        setProviders(configProviders);

        // Get active provider and model
        const provider = config.getActiveProvider();
        setActiveProvider(provider);

        // Get API key status
        const hasKey = config.hasProviderApiKey(provider);
        setApiKey(hasKey ? 'API Key is set' : '');

        // Get models for this provider
        const providerModels = config.getModelsForProvider(provider);
        setModels(providerModels);

        // Get active model
        const model = config.getActiveModel();
        setActiveModel(model);

        debugLog(`Provider: ${provider}, Model: ${model}, Has API Key: ${hasKey}`);
    }, [config, activeProvider]);

    // Save API key for a provider
    const handleSaveApiKey = async (provider: string, apiKey: string) => {
        debugLog(`Saving API key for ${provider}`);

        try {
            // Update config with new API key
            config.setProviderApiKey(provider, apiKey);
            debugLog(`Successfully saved API key for ${provider}`);

            // Now initialize the provider with the new API key
            try {
                debugLog(`Initializing provider ${provider} with new API key`);
                const initialized = await window.electron.ai.initializeProvider(provider, apiKey);
                debugLog(`Provider ${provider} initialization result: ${initialized ? 'success' : 'failed'}`);

                if (initialized) {
                    showToast(`${provider} API key saved and provider initialized successfully!`, 'success');
                } else {
                    showToast(`${provider} API key saved but provider initialization failed. Check the key and try again.`, 'error');
                }
            } catch (error) {
                console.error(`Error initializing provider ${provider}:`, error);
                showToast(`API key saved but provider initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
            }

            // Refresh the UI
            setApiKeyInputs({
                ...apiKeyInputs,
                [provider]: ''
            });
            setSelectedProvider(provider);
            setApiKey('API Key is set');
            setIsEditingKey(false);
        } catch (error) {
            debugLog(`Failed to save API key for ${provider}: ${error}`);
            showToast('Failed to save API key', 'error');
        }
    };

    // Handle provider change
    const handleProviderChange = (provider: string) => {
        debugLog(`Changing provider to: ${provider}`);
        config.setActiveProvider(provider);
        setActiveProvider(provider);

        // Update models for this provider
        const providerModels = config.getModelsForProvider(provider);
        setModels(providerModels);

        // Update active model if needed
        const currentModel = config.getActiveModel();
        if (!providerModels.includes(currentModel)) {
            const defaultModel = providerModels[0] || '';
            config.setActiveModel(defaultModel);
            setActiveModel(defaultModel);
        }

        // Update API key status
        const hasKey = config.hasProviderApiKey(provider);
        setApiKey(hasKey ? 'API Key is set' : '');
        setIsEditingKey(false);
    };

    // Handle model change
    const handleModelChange = (model: string) => {
        debugLog(`Changing model to: ${model}`);
        console.log(`[MODEL UI DEBUG] Changing model in UI to: ${model}`);
        config.setActiveModel(model);
        setActiveModel(model);
    };

    return (
        <div className="flex-1 p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">AI Providers</h1>

            {/* Toast message */}
            {message.text && (
                <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' :
                    message.type === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="max-w-2xl space-y-8">
                {/* Provider Selection */}
                <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <h2 className="text-xl font-semibold mb-4">Select Provider</h2>

                    <div className="mb-6">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {providers.map(provider => (
                                <button
                                    key={provider}
                                    className={`p-3 border rounded-md text-center capitalize ${activeProvider === provider
                                        ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                        }`}
                                    onClick={() => handleProviderChange(provider)}
                                >
                                    {provider}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 dark:text-gray-300 mb-2">API Key</label>
                        {isEditingKey ? (
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    className="flex-1 p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={`Enter ${activeProvider} API Key`}
                                />
                                <button
                                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
                                    onClick={() => handleSaveApiKey(activeProvider, apiKey)}
                                >
                                    Save API Key
                                </button>
                                <button
                                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-md"
                                    onClick={() => setIsEditingKey(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex space-x-2">
                                <div className="flex-1 p-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 rounded-md">
                                    {apiKey || `No API key set for ${activeProvider}`}
                                </div>
                                <button
                                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md"
                                    onClick={() => setIsEditingKey(true)}
                                >
                                    {apiKey ? 'Change API Key' : 'Add API Key'}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Model Selection */}
                <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                    <h2 className="text-xl font-semibold mb-4">Select Model</h2>

                    {/* Info message about models */}
                    {activeProvider === 'fireworks' ? (
                        <div className="mb-4 p-3 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                            <p>Fireworks supports multiple models. Some models support the Model Context Protocol (MCP).</p>
                        </div>
                    ) : activeProvider === 'groq' ? (
                        <div className="mb-4 p-3 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                            <p>Groq supports multiple models. Select the model that best fits your needs.</p>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {models.map(model => {
                            // Extract just the model name for display
                            const displayName = model.includes('/')
                                ? model.split('/').pop() || model
                                : model;

                            // Check if model supports MCP
                            const supportsMCP = [
                                'llama-v3p1-405b-instruct',
                                'llama-v3p1-70b-instruct',
                                'qwen2p5-72b-instruct'
                            ].some(mcpModel => model.includes(mcpModel));

                            return (
                                <button
                                    key={model}
                                    className={`p-3 border rounded-md text-center ${activeModel === model
                                        ? 'bg-primary-100 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-300'
                                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                        }`}
                                    onClick={() => handleModelChange(model)}
                                >
                                    <div>{displayName}</div>
                                    {supportsMCP && (
                                        <div className="text-xs mt-1 inline-block bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                                            MCP
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ProviderSelection; 