// Message role types matching Airtrain API
export enum MessageRole {
    SYSTEM = 'system',
    USER = 'user',
    ASSISTANT = 'assistant',
    FUNCTION = 'function',
    TOOL = 'tool'
}

// Message structure for chat sessions
export interface Message {
    role: string;
    content: string;
    timestamp: string;
    thinking?: string;
}

// Session information structure
export interface SessionInfo {
    session_id: string;
    created_at: string;
    formatted_time?: string;
    message_count: number;
    title: string;
    provider: string;
    model: string;
    file_path?: string;
    preview?: string;
}

// Provider configuration
export interface ProviderConfig {
    active_provider: string;
    active_model: string;
    providers: Record<string, {
        api_key?: string;
        models?: string[];
    }>;
}

export const PROVIDERS = {
    fireworks: 'Fireworks',
    groq: 'Groq'
    // Add other providers when needed:
    // openai: 'OpenAI',
    // anthropic: 'Anthropic',
    // together: 'Together AI',
    // cerebras: 'Cerebras',
    // google: 'Google'
};

// Provider API key environment variables
export const API_KEY_ENV_VARS: Record<string, string> = {
    fireworks: 'FIREWORKS_API_KEY',
    groq: 'GROQ_API_KEY'
    // openai: 'OPENAI_API_KEY',
    // anthropic: 'ANTHROPIC_API_KEY',
    // together: 'TOGETHER_API_KEY',
    // cerebras: 'CEREBRAS_API_KEY',
    // google: 'GOOGLE_API_KEY'
};

// Default models for each provider
export const DEFAULT_MODELS: Record<string, string[]> = {
    fireworks: [
        'accounts/fireworks/models/deepseek-r1',
        'accounts/fireworks/models/llama-v3p1-70b-instruct',
        'accounts/fireworks/models/llama-v3p1-8b-instruct',
        'accounts/fireworks/models/qwen2p5-72b-instruct',     // Supports MCP
        'accounts/fireworks/models/llama4-maverick-instruct-basic',
        'accounts/fireworks/models/llama4-scout-instruct-basic',
    ],
    groq: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama3-70b-8192',
        'llama3-8b-8192',
        'qwen-qwq-32b',
        'qwen-2.5-32b',
        'deepseek-r1-distill-qwen-32b',
        'deepseek-r1-distill-llama-70b'
    ]
    // openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    // anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    // together: ['togethercomputer/llama-3-70b-instruct', 'togethercomputer/llama-3-8b-instruct', 'mistralai/Mixtral-8x7B-v0.1'],
    // cerebras: ['cerebras/Cerebras-GPT-13B', 'cerebras/Cerebras-GPT-2.7B', 'cerebras/Cerebras-GPT-111M'],
    // google: ['gemini-pro', 'gemini-ultra']
};

// User settings
export interface UserSettings {
    time_style: string;
    theme: 'light' | 'dark' | 'system';
    show_thinking: boolean;
    use_markdown: boolean;
} 