import express, { Request, Response, NextFunction } from 'express';
import { testConnection, pool } from './db';
import { queries } from './queries';
import { 
    validateFieldType, 
    validateUUID, 
    ValidationError,
    validateContentDataForType
} from './validation';
import {
    CreateContentInput,
    ReadContentInput,
    UpdateContentInput,
    DeleteContentInput,
    ListContentInput,
    ContentResponse,
    ListResponse,
    CreateContentTypeInput,
    ContentTypeResponse,
    ListContentTypesResponse,
    UpdateContentTypeInput,
    UpdateContentTypeResponse
} from './types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Robust CORS middleware (must be first)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Or use 'http://localhost:5173' for stricter security
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
  return;
});

// Set up multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, uploadDir);
    },
    filename: function (_req, file, cb) {
        const filePath = path.join(uploadDir, file.originalname);
        // If file exists, remove it before saving new one
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Serve uploads directory statically
app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res, _path) => {
        res.set('Cache-Control', 'no-store');
    }
}));

// Image upload endpoint (now checks content type and field name)
app.post('/upload', upload.any(), async (req: Request, res: Response) => {
    console.log(`[UPLOAD] Incoming request: ${req.method} ${req.originalUrl}`);
    const { content_type_id } = req.query;
    console.log(`[UPLOAD] content_type_id:`, content_type_id);
    if (!content_type_id || typeof content_type_id !== 'string') {
        console.log('[UPLOAD] Missing content_type_id');
        res.status(400).json({ error: 'Missing content_type_id' });
        return;
    }
    // Get content type definition
    const contentType = await queries.getContentTypeById(content_type_id);
    if (!contentType) {
        console.log('[UPLOAD] Invalid content_type_id');
        res.status(400).json({ error: 'Invalid content_type_id' });
        return;
    }
    // Find all media fields
    const mediaFields = contentType.fields.filter(f => f.type === 'media').map(f => f.name);
    console.log('[UPLOAD] Media fields for this content type:', mediaFields);
    const files = req.files as Express.Multer.File[];
    if (!files || !files.length) {
        console.log('[UPLOAD] No file uploaded');
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    // Only allow files whose fieldname matches a media field
    const allowedFiles = files.filter(file => mediaFields.includes(file.fieldname));
    console.log('[UPLOAD] Uploaded fields:', files.map(f => f.fieldname));
    console.log('[UPLOAD] Allowed files:', allowedFiles.map(f => f.fieldname));
    if (!allowedFiles.length) {
        console.log('[UPLOAD] No valid media field uploaded');
        res.status(400).json({ error: 'No valid media field uploaded' });
        return;
    }
    // Return URLs for all valid files
    const urls = allowedFiles.map(file => ({
        field: file.fieldname,
        url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
    }));
    console.log('[UPLOAD] Response URLs:', urls);
    res.json({ urls });
    return;
});

// Now register express.json() for all other routes
app.use(express.json());

// Minimal logging middleware: method, endpoint, request body, response body, and JWT token
app.use((req, res, next) => {
    // Log method, endpoint, request body, and JWT token (if present)
    const token = req.headers.authorization ? req.headers.authorization.replace(/^Bearer /, '') : null;
    console.log(`[${req.method}] ${req.originalUrl} [REQ BODY]`, req.body);
    if (token) {
        console.log(`[${req.method}] ${req.originalUrl} [JWT]`, token);
    }
    // Monkey-patch res.send to capture response body
    const originalSend = res.send;
    res.send = function (body) {
        try {
            const parsed = typeof body === 'string' ? JSON.parse(body) : body;
            console.log(`[${req.method}] ${req.originalUrl} [RES BODY]`, parsed);
        } catch (e) {
            console.log(`[${req.method}] ${req.originalUrl} [RES BODY]`, body);
        }
        return originalSend.call(this, body);
    };
    next();
});

// Error handling middleware
const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
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
    return;
};

// Helper to get user email by id
async function getUserEmail(userId: number | string | null) {
  if (!userId) return null;
  const result = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.email || null;
}

// Routes

// Create content type
app.post('/content-type/create', async (req: Request<{}, {}, CreateContentTypeInput>, res: Response<ContentTypeResponse>, next: NextFunction) => {
    try {
        const { name, fields } = req.body;
        // Validate fields
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
        const contentType = await queries.createContentType({ name, fields });
        // Log the full contentType object
        console.log('[CONTENT TYPE CREATED]', JSON.stringify(contentType, null, 2));
        return res.json({ success: true, contentType });
    } catch (error) {
        return next(error);
    }
});

// List content types
app.get('/content-type/list', async (_req: Request, res: Response<ListContentTypesResponse>, next: NextFunction) => {
    try {
        const contentTypes = await queries.listContentTypes();
        // Log the full contentTypes array with all fields
        console.log('[CONTENT TYPES]', JSON.stringify(contentTypes, null, 2));
        return res.json({ success: true, contentTypes });
    } catch (error) {
        return next(error);
    }
});

// Create content
app.post('/content/create', async (req: Request<{}, {}, CreateContentInput>, res: Response<ContentResponse>, next: NextFunction) => {
    try {
        const { content_type_id, data } = req.body;
        // Validate content type exists
        const contentType = await queries.getContentTypeById(content_type_id);
        if (!contentType) {
            return res.status(400).json({ success: false, error: 'Invalid content_type_id' });
        }
        // Validate data against content type fields
        const validatedData = validateContentDataForType(data, contentType.fields);
        // Get user id from auth (if present)
        let created_by = null;
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
                const userId = typeof decoded === 'object' && decoded.id ? decoded.id : null;
                created_by = userId;
            } catch {}
        }
        // Create content
        const content = await queries.createContent({
            content_type_id,
            data: validatedData,
            created_by
        });
        // Attach user info
        const userEmail = await getUserEmail(content.created_by ?? null);
        return res.json({ success: true, content: { ...content, created_by: userEmail } });
    } catch (error) {
        return next(error);
    }
});

// Read content
app.post('/content/read', async (req: Request<{}, {}, ReadContentInput>, res: Response<ContentResponse>, next: NextFunction) => {
    try {
        const { id } = req.body;
        
        // Validate UUID
        validateUUID(id);
        
        // Read content
        const content = await queries.readContent(id);
        
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        // Attach user info
        const createdByEmail = await getUserEmail(content.created_by ?? null);
        const updatedByEmail = await getUserEmail(content.updated_by ?? null);
        const fullContent = { ...content, created_by: createdByEmail, updated_by: updatedByEmail };
        // Log the full content object with all data fields
        console.log('[CONTENT]', JSON.stringify(fullContent, null, 2));
        return res.json({
            success: true,
            content: fullContent
        });
    } catch (error) {
        return next(error);
    }
});

// Update content
app.post('/content/update', async (req: Request<{}, {}, UpdateContentInput>, res: Response<ContentResponse>, next: NextFunction) => {
    try {
        const { id, data } = req.body;
        validateUUID(id);
        // Get existing content
        const existing = await queries.readContent(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Content not found' });
        }
        // Get content type
        const contentType = await queries.getContentTypeById(existing.content_type_id);
        if (!contentType) {
            return res.status(400).json({ success: false, error: 'Content type not found' });
        }
        // Validate data against content type fields
        const validatedData = validateContentDataForType(data, contentType.fields);
        // Get user id from auth (if present)
        let updated_by = null;
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
                const userId = typeof decoded === 'object' && decoded.id ? decoded.id : null;
                updated_by = userId;
            } catch {}
        }
        // Update content
        const content = await queries.updateContent({
            id,
            data: validatedData,
            updated_by
        });
        // Attach user info
        if (!content) {
            return res.status(404).json({ success: false, error: 'Content not found' });
        }
        const userEmail = await getUserEmail(content.updated_by ?? null);
        return res.json({ success: true, content: { ...content, updated_by: userEmail } });
    } catch (error) {
        return next(error);
    }
});

// Delete content
app.post('/content/delete', async (req: Request<{}, {}, DeleteContentInput>, res: Response<ContentResponse>, next: NextFunction) => {
    try {
        const { id } = req.body;
        
        // Validate UUID
        validateUUID(id);
        
        // Delete content
        const deleted = await queries.deleteContent(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        return res.json({
            success: true
        });
    } catch (error) {
        return next(error);
    }
});

// List contents
app.post('/content/list', async (req: Request<{}, {}, ListContentInput>, res: Response<ListResponse>, next: NextFunction) => {
    try {
        const { content_type_id } = req.body;
        const contents = await queries.listContents(content_type_id);
        // Attach user info for each content
        const withEmails = await Promise.all(contents.map(async c => {
            const createdByEmail = await getUserEmail(c.created_by ?? null);
            const updatedByEmail = await getUserEmail(c.updated_by ?? null);
            return { ...c, created_by: createdByEmail, updated_by: updatedByEmail };
        }));
        // Log the full contents array with all data fields
        console.log('[CONTENTS]', JSON.stringify(withEmails, null, 2));
        return res.json({ success: true, contents: withEmails });
    } catch (error) {
        return next(error);
    }
});

// Update content type
app.post('/content-type/update', async (req: Request<{}, {}, UpdateContentTypeInput>, res: Response<UpdateContentTypeResponse>, next: NextFunction) => {
    try {
        const { id, name, fields } = req.body;
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Content type id is required and must be a string');
        }
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
        const contentType = await queries.updateContentType(id, name, fields);
        if (!contentType) {
            return res.status(404).json({ success: false, error: 'Content type not found' });
        }
        // Log the full contentType object
        console.log('[CONTENT TYPE UPDATED]', JSON.stringify(contentType, null, 2));
        return res.json({ success: true, contentType });
    } catch (error) {
        return next(error);
    }
});

// Delete content type
app.delete('/content-type/delete/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Content type id is required' });
        }
        const deleted = await queries.deleteContentType(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Content type not found' });
        }
        return res.json({ success: true });
    } catch (error) {
        return next(error);
    }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register error handler middleware at the end
app.use(errorHandler);

// Register endpoint
app.post('/register', async (req, res) => {
  console.log('[REGISTER] Incoming request:', req.body);
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    console.log('[REGISTER] Missing fields');
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  if (!['admin', 'user'].includes(role)) {
    console.log('[REGISTER] Invalid role:', role);
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
      [email, hash, role]
    );
    console.log('[REGISTER] User created:', email, role);
    res.json({ success: true });
    return;
  } catch (e) {
    console.error('[REGISTER] Error:', e);
    res.status(400).json({ error: 'User exists' });
    return;
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  console.log('[LOGIN] Incoming request:', req.body);
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('[LOGIN] Query result:', result.rows);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('[LOGIN] Invalid credentials for:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('[LOGIN] Success for:', email, 'role:', user.role);
    res.json({ token, role: user.role });
    return;
  } catch (e) {
    console.error('[LOGIN] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Start server
async function start() {
    try {
        // Test database connection
        await testConnection();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log('\nAvailable endpoints (all POST):');
            console.log('  - /content/create');
            console.log('  - /content/read');
            console.log('  - /content/update');
            console.log('  - /content/delete');
            console.log('  - /content/list');
            console.log('\nHealth check (GET):');
            console.log('  - /health');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down gracefully...');
    process.exit(0);
});

start();
