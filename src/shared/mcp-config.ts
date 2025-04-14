import fs from 'fs';
import path from 'path';
import os from 'os';

// Define the MCP configuration schema
export interface MCPServerConfig {
    command: string;
    args: string[];
    env: Record<string, string>;
}

export interface MCPConfig {
    mcpServers: Record<string, MCPServerConfig>;
}

// Default configuration
const DEFAULT_CONFIG: MCPConfig = {
    mcpServers: {
        'perplexity-ask': {
            command: 'docker',
            args: [
                'run',
                '-i',
                '--rm',
                '-e',
                'PERPLEXITY_API_KEY',
                'mcp/perplexity-ask'
            ],
            env: {
                PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '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'
            }
        }
    }
};

// Config file path
const getConfigFilePath = (configDir: string): string => {
    return path.join(configDir, 'mcp-config.json');
};

// Load MCP configuration from file
export const loadMCPConfig = (configDir: string): MCPConfig => {
    const configPath = getConfigFilePath(configDir);

    try {
        // Check if config file exists
        if (!fs.existsSync(configPath)) {
            console.log(`MCP config file not found at ${configPath}, creating default config`);
            // Create default config file
            try {
                saveMCPConfig(DEFAULT_CONFIG, configDir);
            } catch (saveError) {
                console.error(`Failed to create default config: ${saveError}`);
                // Return default config anyway
            }
            return DEFAULT_CONFIG;
        }

        // Read and parse config file
        try {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configData) as MCPConfig;

            // Validate config
            if (!validateMCPConfig(config)) {
                console.warn('Invalid MCP config found, using default config');
                return DEFAULT_CONFIG;
            }

            return config;
        } catch (readError) {
            console.error(`Error reading MCP config: ${readError}`);
            return DEFAULT_CONFIG;
        }
    } catch (error) {
        console.error('Error loading MCP config:', error);
        return DEFAULT_CONFIG;
    }
};

// Save MCP configuration to file
export const saveMCPConfig = (config: MCPConfig, configDir: string): boolean => {
    const configPath = getConfigFilePath(configDir);

    try {
        console.log('Saving MCP configuration...');
        console.log('Config directory:', configDir);
        console.log('Config path:', configPath);
        console.log('Configuration to save:', config);

        // Ensure directory exists
        if (!fs.existsSync(configDir)) {
            console.log('Creating config directory:', configDir);
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Validate config before saving
        if (!validateMCPConfig(config)) {
            console.error('Invalid MCP configuration, validation failed');
            throw new Error('Invalid MCP configuration');
        }

        // Write config to file
        console.log('Writing configuration to file...');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log('Configuration saved successfully');

        // Verify the file was written correctly
        try {
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            console.log('Verified saved configuration:', savedConfig);
        } catch (verifyError) {
            console.error('Error verifying saved configuration:', verifyError);
        }

        return true;
    } catch (error) {
        console.error('Error saving MCP config:', error);
        return false;
    }
};

// Validate MCP configuration
export const validateMCPConfig = (config: any): config is MCPConfig => {
    // Check if config has mcpServers property
    if (!config || typeof config !== 'object' || !config.mcpServers || typeof config.mcpServers !== 'object') {
        console.error('Invalid config structure:', config);
        return false;
    }

    // Check each server configuration
    for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
        // Check server ID
        if (!serverId || typeof serverId !== 'string') {
            console.error(`Invalid server ID: ${serverId}`);
            return false;
        }

        // Check server config
        if (!serverConfig || typeof serverConfig !== 'object') {
            console.error(`Invalid server config for ${serverId}:`, serverConfig);
            return false;
        }

        // Check command
        if (!serverConfig.command || typeof serverConfig.command !== 'string') {
            console.error(`Missing or invalid command for server ${serverId}:`, serverConfig);
            return false;
        }

        // Check args
        if (!Array.isArray(serverConfig.args)) {
            console.error(`Invalid args for server ${serverId}:`, serverConfig);
            return false;
        }

        // Check env
        if (!serverConfig.env || typeof serverConfig.env !== 'object') {
            console.error(`Invalid env for server ${serverId}:`, serverConfig);
            return false;
        }
    }

    return true;
};

// Format validation errors for display
export const getValidationErrors = (jsonStr: string): string[] => {
    const errors: string[] = [];

    try {
        // Try to parse JSON
        const parsed = JSON.parse(jsonStr);

        // Check if config has mcpServers property
        if (!parsed || typeof parsed !== 'object') {
            errors.push('Configuration must be a JSON object');
        } else if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
            errors.push('Configuration must have a "mcpServers" object property');
        } else {
            // Check each server configuration
            for (const [serverId, serverConfig] of Object.entries(parsed.mcpServers)) {
                // Check server ID
                if (!serverId || typeof serverId !== 'string') {
                    errors.push(`Server ID must be a non-empty string: "${serverId}"`);
                }

                // Check server config
                if (!serverConfig || typeof serverConfig !== 'object') {
                    errors.push(`Server configuration for "${serverId}" must be an object`);
                    continue;
                }

                // Check command
                if (!serverConfig.command || typeof serverConfig.command !== 'string') {
                    errors.push(`Server "${serverId}" must have a "command" string property`);
                }

                // Check args
                if (!Array.isArray(serverConfig.args)) {
                    errors.push(`Server "${serverId}" must have an "args" array property`);
                }

                // Check env
                if (!serverConfig.env || typeof serverConfig.env !== 'object') {
                    errors.push(`Server "${serverId}" must have an "env" object property`);
                }
            }
        }
    } catch (error) {
        errors.push(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    return errors;
}; 