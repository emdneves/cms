import express, { Request, Response } from 'express';
import { 
    ContentRow,
    ContentType,
    CreateContentTypeInput
} from './types';
import { 
    validateFieldType, 
    validateUUID, 
    ValidationError,
    validateContentDataForType
} from './validation';

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for demo
const contentStore = new Map<string, ContentRow>();
const contentTypeStore = new Map<string, ContentType>();

// Middleware
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    return next();
});

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - start;
        const timestamp = new Date().toISOString();
        
        // Log request details
        let logMessage = `[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`;
        
        // Add request body for POST requests
        if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
            logMessage += `\n  Request Body: ${JSON.stringify(req.body, null, 2)}`;
        }
        
        // Add response data
        try {
            const responseData = typeof data === 'string' ? JSON.parse(data) : data;
            logMessage += `\n  Response: ${JSON.stringify(responseData, null, 2)}`;
        } catch (e) {
            logMessage += `\n  Response: ${data}`;
        }
        
        console.log(logMessage);
        return originalSend.call(this, data);
    };
    
    next();
});

// Helper to generate UUID (simple version for demo)
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Error handling middleware
const errorHandler = (err: Error, _req: Request, res: Response) => {
    console.error('Error:', err);
    if (err instanceof ValidationError) {
        res.status(400).json({
            success: false,
            error: err.message
        });
        return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
            success: false,
            error: 'Invalid JSON'
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
};

// Routes

// Create content type
app.post('/content-type/create', (req, res) => {
    try {
        const { name, fields }: CreateContentTypeInput = req.body;
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Content type name is required and must be a string');
        }
        if (!Array.isArray(fields) || fields.length === 0) {
            throw new ValidationError('Fields must be a non-empty array');
        }
        for (const field of fields) {
            if (!field.name || typeof field.name !== 'string') {
                throw new ValidationError('Each field must have a name of type string');
            }
            validateFieldType(field.type);
        }
        const id = generateUUID();
        const contentType: ContentType = {
            id,
            name,
            fields,
            created_at: new Date()
        };
        contentTypeStore.set(id, contentType);
        return res.json({ success: true, contentType });
    } catch (error) {
        return errorHandler(error as Error, req, res);
    }
});

// List content types
app.get('/content-type/list', (_req, res) => {
    try {
        const contentTypes = Array.from(contentTypeStore.values());
        return res.json({ success: true, contentTypes });
    } catch (error) {
        return errorHandler(error as Error, _req, res);
    }
});

// Create content
app.post('/content/create', (req, res) => {
    try {
        const { content_type_id, data } = req.body;
        const contentType = contentTypeStore.get(content_type_id);
        if (!contentType) {
            return res.status(400).json({ success: false, error: 'Invalid content_type_id' });
        }
        const validatedData = validateContentDataForType(data, contentType.fields);
        const content: ContentRow = {
            id: generateUUID(),
            content_type_id,
            data: validatedData,
            created_at: new Date(),
            updated_at: new Date()
        };
        contentStore.set(content.id, content);
        return res.json({ success: true, content });
    } catch (error) {
        return errorHandler(error as Error, req, res);
    }
});

// Read content
app.post('/content/read', async (req, res) => {
    try {
        const { id } = req.body;
        validateUUID(id);
        const content = contentStore.get(id);
        if (!content) {
            res.status(404).json({
                success: false,
                error: 'Content not found'
            });
            return;
        }
        res.json({
            success: true,
            content
        });
    } catch (error) {
        errorHandler(error as Error, req, res);
    }
});

// Update content
app.post('/content/update', (req, res) => {
    try {
        const { id, data } = req.body;
        validateUUID(id);
        const existing = contentStore.get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Content not found' });
        }
        const contentType = contentTypeStore.get(existing.content_type_id);
        if (!contentType) {
            return res.status(400).json({ success: false, error: 'Content type not found' });
        }
        const validatedData = validateContentDataForType(data, contentType.fields);
        const updated: ContentRow = {
            ...existing,
            data: validatedData,
            updated_at: new Date()
        };
        contentStore.set(id, updated);
        return res.json({ success: true, content: updated });
    } catch (error) {
        return errorHandler(error as Error, req, res);
    }
});

// Delete content
app.post('/content/delete', (req, res) => {
    try {
        const { id } = req.body;
        validateUUID(id);
        const deleted = contentStore.delete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Content not found' });
        }
        return res.json({ success: true });
    } catch (error) {
        return errorHandler(error as Error, req, res);
    }
});

// List contents
app.post('/content/list', (req, res) => {
    try {
        const { content_type_id } = req.body;
        let contents = Array.from(contentStore.values());
        if (content_type_id) {
            contents = contents.filter(c => c.content_type_id === content_type_id);
        }
        contents.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        return res.json({ success: true, contents });
    } catch (error) {
        return errorHandler(error as Error, req, res);
    }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ 
        status: 'ok', 
        mode: 'demo (in-memory)',
        timestamp: new Date().toISOString() 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Demo server running on http://localhost:${PORT}`);
    console.log('⚠️  Note: This is running in demo mode with in-memory storage');
    console.log('    Data will be lost when the server stops!\n');
    console.log('Available endpoints (all POST):');
    console.log('  - /content/create');
    console.log('  - /content/read');
    console.log('  - /content/update');
    console.log('  - /content/delete');
    console.log('  - /content/list');
    console.log('\nHealth check (GET):');
    console.log('  - /health');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down demo server...');
    process.exit(0);
});
