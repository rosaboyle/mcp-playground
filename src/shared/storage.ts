import { v4 as uuidv4 } from 'uuid';
import { Message, SessionInfo } from './types';

// Debug logging function
const debugLog = (message: string) => {
    console.log(`[STORAGE DEBUG] ${message}`);
}

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
    },

    readdirSync: (path: string): string[] => {
        if (isRenderer()) {
            try {
                return window.electron.fs.readdir(path);
            } catch (error) {
                debugLog(`Error reading directory ${path}: ${(error as Error).message}`);
                return [];
            }
        }
        // Fallback for non-renderer context
        const fs = safeRequire('fs');
        if (fs) {
            try {
                return fs.readdirSync(path);
            } catch (error) {
                debugLog(`Error reading directory ${path}: ${(error as Error).message}`);
                return [];
            }
        }
        debugLog(`Cannot read directory ${path} - fs module not available`);
        return [];
    },

    unlinkSync: (path: string): void => {
        if (isRenderer()) {
            try {
                window.electron.fs.unlink(path);
            } catch (error) {
                debugLog(`Error deleting file ${path}: ${(error as Error).message}`);
            }
            return;
        }
        // Fallback for non-renderer context
        const fs = safeRequire('fs');
        if (fs) {
            try {
                fs.unlinkSync(path);
            } catch (error) {
                debugLog(`Error deleting file ${path}: ${(error as Error).message}`);
            }
        } else {
            debugLog(`Cannot delete file ${path} - fs module not available`);
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
    },

    dirname: (filePath: string): string => {
        if (isRenderer()) {
            return window.electron.path.dirname(filePath);
        }
        // Fallback for non-renderer context
        const path = safeRequire('path');
        if (path) {
            return path.dirname(filePath);
        }
        // Cross-platform fallback implementation
        debugLog('path module not available - using cross-platform dirname');
        // Normalize path separators to forward slashes
        const normalizedPath = filePath.replace(/\\/g, '/');
        // Handle special case of root paths
        if (normalizedPath === '/' || normalizedPath === '') return '/';
        if (/^[A-Za-z]:[\\/]?$/.test(filePath)) return filePath; // Windows root drive

        // Remove trailing slash if present
        const pathWithoutTrailingSlash = normalizedPath.endsWith('/')
            ? normalizedPath.slice(0, -1)
            : normalizedPath;

        // Find the last path separator
        const lastSlashIndex = pathWithoutTrailingSlash.lastIndexOf('/');
        if (lastSlashIndex === -1) return '.';

        // Return everything before the last slash, or '/' for root
        const dirname = pathWithoutTrailingSlash.slice(0, lastSlashIndex);
        return dirname || '/';
    }
};

/**
 * Generate a concise title based on user input
 * 
 * @param userInput - First user message content
 * @param aiResponse - Optional AI response
 */
export function generateTitle(userInput: string, aiResponse: string = ''): string {
    if (!userInput) {
        return 'New Chat';
    }

    // Remove any special characters and extra whitespace
    const cleanInput = userInput.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract key parts based on common patterns

    // Check for questions (who, what, where, when, why, how)
    const questionPatterns = ['who', 'what', 'where', 'when', 'why', 'how', 'can', 'could', 'would', 'should'];
    for (const pattern of questionPatterns) {
        if (cleanInput.toLowerCase().startsWith(pattern)) {
            // Extract first few words for questions
            const parts = cleanInput.split(' ');
            if (parts.length > 3) {
                const topic = parts.slice(0, 3).join(' ');
                return topic + '...';
            }
        }
    }

    // Check for commands (explain, tell me, show me, etc.)
    const commandPatterns = ['explain', 'tell', 'show', 'give', 'create', 'make', 'write', 'find'];
    for (const pattern of commandPatterns) {
        if (cleanInput.toLowerCase().split(' ').includes(pattern)) {
            const words = cleanInput.split(' ');
            const idx = words.findIndex(word => word.toLowerCase() === pattern);
            if (idx >= 0 && idx + 2 < words.length) {
                return `${words[idx][0].toUpperCase() + words[idx].slice(1)} ${words[idx + 1]} ${words[idx + 2]}...`;
            }
        }
    }

    // Extract main topic (nouns after "about")
    if (cleanInput.toLowerCase().split(' ').includes('about')) {
        const words = cleanInput.split(' ');
        const idx = words.indexOf('about');
        if (idx + 2 < words.length) {
            return `About ${words[idx + 1]} ${words[idx + 2]}...`;
        }
    }

    // Default case: Take 2-3 key words to form a short title
    const words = cleanInput.split(' ');

    // Use first 2-3 words, but limit to 20 characters total
    let title = words.slice(0, 3).join(' ');
    if (title.length > 20) {
        title = title.substring(0, 17) + '...';
    }

    return title;
}

/**
 * Format a timestamp for display
 * 
 * @param timestamp - ISO timestamp string
 * @param style - Format style (iso, human, relative)
 */
export function formatTimestamp(timestamp: string, style: string = 'iso'): string {
    try {
        const date = new Date(timestamp);

        switch (style) {
            case 'human':
                return date.toLocaleString();

            case 'relative': {
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffSeconds = Math.floor(diffMs / 1000);

                if (diffSeconds < 60) {
                    return 'just now';
                } else if (diffSeconds < 3600) {
                    const minutes = Math.floor(diffSeconds / 60);
                    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
                } else if (diffSeconds < 86400) {
                    const hours = Math.floor(diffSeconds / 3600);
                    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                } else if (diffSeconds < 604800) {
                    const days = Math.floor(diffSeconds / 86400);
                    return `${days} day${days > 1 ? 's' : ''} ago`;
                } else {
                    return date.toLocaleDateString();
                }
            }

            case 'iso':
            default:
                return timestamp;
        }
    } catch (error) {
        return timestamp;
    }
}

/**
 * Chat session class for managing messages
 */
export class ChatSession {
    public session_id: string;
    public created_at: string;
    public messages: Message[];
    public title: string;
    public provider?: string;
    public model?: string;
    private file_path: string;
    private title_generation_pending: boolean;
    private static storageDir: string = './sessions'; // Default storage directory

    /**
     * Set the storage directory for chat sessions
     */
    public static setStorageDir(dir: string): void {
        debugLog(`Setting storage directory to ${dir}`);
        try {
            // Ensure the directory exists
            if (!fileSystem.existsSync(dir)) {
                debugLog(`Creating storage directory: ${dir}`);
                fileSystem.mkdirSync(dir, { recursive: true });
            }

            // Set the storage directory
            ChatSession.storageDir = dir;
            debugLog(`Storage directory set to ${dir}`);
        } catch (error) {
            console.error('Error setting storage directory:', error);
            debugLog(`Error setting storage directory: ${(error as Error).message}`);

            // Try to use a fallback directory
            const fallbackDir = './sessions';
            debugLog(`Using fallback directory: ${fallbackDir}`);
            ChatSession.storageDir = fallbackDir;

            try {
                if (!fileSystem.existsSync(fallbackDir)) {
                    fileSystem.mkdirSync(fallbackDir, { recursive: true });
                }
            } catch (fallbackError) {
                console.error(`Error creating fallback directory: ${(fallbackError as Error).message}`);
                debugLog(`Error creating fallback directory: ${(fallbackError as Error).message}`);
            }
        }
    }

    /**
     * Create a new chat session or load an existing one
     * 
     * @param session_id - Optional session ID (generated if not provided)
     * @param title - Optional title (generated if not provided)
     * @param provider - Optional LLM provider
     * @param model - Optional model name
     */
    constructor(
        session_id?: string,
        title?: string,
        provider?: string,
        model?: string
    ) {
        // Generate a session ID if not provided
        this.session_id = session_id || uuidv4();
        this.created_at = new Date().toISOString();
        this.messages = [];
        this.title = title || 'New Chat';
        this.provider = provider;
        this.model = model;
        this.title_generation_pending = !title;

        // Set the file path using cross-platform path handling
        this.file_path = pathUtil.join(ChatSession.storageDir, `${this.session_id}.json`);
        debugLog(`Chat session created: ${this.session_id} at ${this.file_path}`);
    }

    /**
     * Add a message to the chat session
     * 
     * @param role - Message role (user, assistant)
     * @param content - Message content
     */
    public addMessage(role: string, content: string): void {
        debugLog(`Adding message from ${role} to session ${this.session_id}`);

        const timestamp = new Date().toISOString();
        const message: Message = {
            role,
            content,
            timestamp
        };

        // Extract thinking content for assistant messages
        if (role === 'assistant') {
            const thinkingMatch = /<think>([\s\S]*?)<\/think>/i.exec(content);
            if (thinkingMatch) {
                message.thinking = thinkingMatch[1].trim();
            }
        }

        this.messages.push(message);

        // Generate a title based on the first user message
        if (this.title_generation_pending && role === 'user' && this.messages.filter(m => m.role === 'user').length === 1) {
            this.title = generateTitle(content);
            this.title_generation_pending = false;
            debugLog(`Generated title: ${this.title}`);
        }

        // Update title if first two messages complete a Q&A pair
        if (this.messages.length === 2 && role === 'assistant') {
            const userContent = this.messages[0].content;
            const aiContent = content;
            this.title = generateTitle(userContent, aiContent);
            debugLog(`Updated title based on Q&A: ${this.title}`);
        }

        // Save the session
        this.save();
    }

    /**
     * Set the provider and model for this session
     */
    public setProviderModel(provider: string, model: string): void {
        debugLog(`Setting provider ${provider} and model ${model}`);
        this.provider = provider;
        this.model = model;
        this.save();
    }

    /**
     * Save the chat session to a file
     */
    public save(): void {
        debugLog(`Saving chat session to ${this.file_path}`);
        try {
            // Ensure the storage directory exists
            if (!fileSystem.existsSync(ChatSession.storageDir)) {
                debugLog(`Creating storage directory: ${ChatSession.storageDir}`);
                fileSystem.mkdirSync(ChatSession.storageDir, { recursive: true });
            }

            // Convert to JSON
            const data = JSON.stringify({
                session_id: this.session_id,
                created_at: this.created_at,
                title: this.title,
                provider: this.provider,
                model: this.model,
                messages: this.messages
            }, null, 2);

            // Write to file
            fileSystem.writeFileSync(this.file_path, data, 'utf8');
            debugLog('Chat session saved successfully');
        } catch (error) {
            console.error('Error saving chat session:', error);
            debugLog(`Error saving chat session: ${(error as Error).message}`);
        }
    }

    /**
     * Load a chat session from a file
     * 
     * @param session_id - ID of the session to load
     * @returns ChatSession instance or null if not found
     */
    public static load(session_id: string): ChatSession | null {
        debugLog(`Loading chat session ${session_id}`);
        try {
            // Construct the file path using cross-platform path handling
            const filePath = pathUtil.join(ChatSession.storageDir, `${session_id}.json`);
            debugLog(`Looking for file at ${filePath}`);

            if (!fileSystem.existsSync(filePath)) {
                debugLog(`Session file not found: ${filePath}`);
                return null;
            }

            // Read and parse the file
            const data = fileSystem.readFileSync(filePath, 'utf8');
            const sessionData = JSON.parse(data);

            // Create a new session from the data
            const session = new ChatSession(
                sessionData.session_id,
                sessionData.title,
                sessionData.provider,
                sessionData.model
            );
            session.created_at = sessionData.created_at;
            session.messages = sessionData.messages;
            session.title_generation_pending = false;

            debugLog(`Successfully loaded session ${session_id}`);
            return session;
        } catch (error) {
            console.error(`Error loading chat session ${session_id}:`, error);
            debugLog(`Error loading chat session: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Delete a chat session
     * 
     * @param session_id - ID of the session to delete
     * @returns true if successful, false otherwise
     */
    public static deleteSession(session_id: string): boolean {
        debugLog(`Deleting chat session ${session_id}`);
        try {
            // Construct the file path using cross-platform path handling
            const filePath = pathUtil.join(ChatSession.storageDir, `${session_id}.json`);
            debugLog(`Looking for file at ${filePath}`);

            if (!fileSystem.existsSync(filePath)) {
                debugLog(`Session file not found: ${filePath}`);
                return false;
            }

            // Delete the file
            fileSystem.unlinkSync(filePath);
            debugLog(`Successfully deleted session ${session_id}`);
            return true;
        } catch (error) {
            console.error(`Error deleting chat session ${session_id}:`, error);
            debugLog(`Error deleting chat session: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * List all available chat sessions
     * 
     * @returns Array of session info objects
     */
    public static listSessions(): SessionInfo[] {
        debugLog(`Listing all chat sessions in ${ChatSession.storageDir}`);
        try {
            if (!fileSystem.existsSync(ChatSession.storageDir)) {
                debugLog(`Storage directory does not exist: ${ChatSession.storageDir}`);
                return [];
            }

            // List all JSON files in the directory
            const files = fileSystem.readdirSync(ChatSession.storageDir)
                .filter(file => file.endsWith('.json'));

            debugLog(`Found ${files.length} session files`);

            // Load basic info from each file
            const sessions: SessionInfo[] = [];
            for (const file of files) {
                try {
                    const filePath = pathUtil.join(ChatSession.storageDir, file);
                    const data = fileSystem.readFileSync(filePath, 'utf8');
                    const sessionData = JSON.parse(data);

                    sessions.push({
                        session_id: sessionData.session_id,
                        created_at: sessionData.created_at,
                        title: sessionData.title,
                        provider: sessionData.provider,
                        model: sessionData.model,
                        message_count: sessionData.messages ? sessionData.messages.length : 0
                    });
                } catch (error) {
                    console.error(`Error reading session file ${file}:`, error);
                    debugLog(`Error reading session file ${file}: ${(error as Error).message}`);
                    // Continue with other files
                }
            }

            // Sort sessions by creation date (newest first)
            sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            debugLog(`Successfully loaded info for ${sessions.length} sessions`);
            return sessions;
        } catch (error) {
            console.error('Error listing chat sessions:', error);
            debugLog(`Error listing chat sessions: ${(error as Error).message}`);
            return [];
        }
    }
} 