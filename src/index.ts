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

// Helper to log activities
async function logActivity(userId: number | null, action: string, target: string, targetId?: string, metadata?: any) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, target, target_id, metadata) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, target, targetId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    console.error('[ACTIVITY LOG] Error logging activity:', error);
  }
}



// Middleware to require admin role
function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const token = auth.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
        return;
    } catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }
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
            if (field.type === 'enum') {
                if (!Array.isArray(field.options) || field.options.length === 0 || !field.options.every(opt => typeof opt === 'string')) {
                    throw new ValidationError(`Field '${field.name}' of type 'enum' must have a non-empty 'options' array of strings`);
                }
            }
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
        
        // Log the content creation
        await logActivity(created_by, 'create', 'content', content.id, { 
            content_type_id, 
            content_type_name: contentType.name,
            content_id: content.id 
        });
        
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
        
        // Log the content update
        await logActivity(updated_by, 'update', 'content', content.id, { 
            content_type_id: content.content_type_id, 
            content_type_name: contentType.name,
            content_id: content.id 
        });
        
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
        
        // Get existing content for logging
        const existing = await queries.readContent(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        // Get user id from auth (if present)
        let deleted_by = null;
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
                const userId = typeof decoded === 'object' && decoded.id ? decoded.id : null;
                deleted_by = userId;
            } catch {}
        }
        
        // Delete content
        const deleted = await queries.deleteContent(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        // Log the content deletion
        await logActivity(deleted_by, 'delete', 'content', id, { 
            content_type_id: existing.content_type_id,
            content_id: id 
        });
        
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
            if (field.type === 'enum') {
                if (!Array.isArray(field.options) || field.options.length === 0 || !field.options.every(opt => typeof opt === 'string')) {
                    throw new ValidationError(`Field '${field.name}' of type 'enum' must have a non-empty 'options' array of strings`);
                }
            }
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
  const { email, password, role, first_name, last_name } = req.body;
  if (!email || !password || !role || !first_name || !last_name) {
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
      'INSERT INTO users (email, password, role, first_name, last_name, is_active, created_at, updated_at, last_login) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW(), NOW())',
      [email, hash, role, first_name, last_name]
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
    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('[LOGIN] Success for:', email, 'role:', user.role);
    
    // Log the login activity
    await logActivity(user.id, 'login', 'user', user.id.toString(), { email: user.email, role: user.role });
    
    res.json({
      token,
      role: user.role,
      user: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: new Date().toISOString()
    });
    return;
  } catch (e) {
    console.error('[LOGIN] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// List all users (admin only)
app.get('/users', requireAdmin, async (_: any, res) => {
    const result = await pool.query('SELECT id, email, role, first_name, last_name, is_active, created_at, updated_at, last_login FROM users ORDER BY email ASC');
    res.json({ users: result.rows });
    return;
});

// Get user by ID (admin only)
app.get('/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT id, email, role, first_name, last_name, is_active, created_at, updated_at, last_login FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
    return;
});

// Update user (admin only, allow updating email, role, first_name, last_name, is_active)
app.put('/users/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, role, first_name, last_name, is_active } = req.body;
    if (!email || !role || !first_name || !last_name || typeof is_active === 'undefined') return res.status(400).json({ error: 'All fields are required' });
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    
    // Get user id from auth
    let updated_by = null;
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
            const userId = typeof decoded === 'object' && decoded.id ? decoded.id : null;
            updated_by = userId;
        } catch {}
    }
    
    try {
        const result = await pool.query(
            'UPDATE users SET email = $1, role = $2, first_name = $3, last_name = $4, is_active = $5, updated_at = NOW() WHERE id = $6 RETURNING id, email, role, first_name, last_name, is_active, created_at, updated_at, last_login',
            [email, role, first_name, last_name, is_active, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        // Log the user update
        await logActivity(updated_by, 'update', 'user', id, { 
            user_id: id,
            email: email,
            role: role,
            first_name: first_name,
            last_name: last_name,
            is_active: is_active
        });
        
        res.json({ user: result.rows[0] });
        return;
    } catch (e: any) {
        if (e.code === '23505') return res.status(400).json({ error: 'Email already exists' });
        throw e;
    }
});

// Delete user (admin only)
app.delete('/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    
    // Get user id from auth
    let deleted_by = null;
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
            const userId = typeof decoded === 'object' && decoded.id ? decoded.id : null;
            deleted_by = userId;
        } catch {}
    }
    
    // Get user info before deletion for logging
    const userResult = await pool.query('SELECT email, role, first_name, last_name FROM users WHERE id = $1', [id]);
    const userInfo = userResult.rows[0];
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    // Log the user deletion
    await logActivity(deleted_by, 'delete', 'user', id, { 
        user_id: id,
        email: userInfo?.email,
        role: userInfo?.role,
        first_name: userInfo?.first_name,
        last_name: userInfo?.last_name
    });
    
    res.json({ success: true });
    return;
});

// Activity Log Endpoints (Admin Only)

// Get activity logs with pagination and filtering
app.get('/activity-log', requireAdmin, async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const userId = req.query.userId as string;
        const actionType = req.query.actionType as string;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;
        
        if (userId) {
            whereConditions.push(`al.user_id = $${paramIndex}`);
            params.push(userId);
            paramIndex++;
        }
        
        if (actionType) {
            whereConditions.push(`al.action = $${paramIndex}`);
            params.push(actionType);
            paramIndex++;
        }
        
        if (startDate) {
            whereConditions.push(`al.timestamp >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereConditions.push(`al.timestamp <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }
        
        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
        const offset = (page - 1) * pageSize;
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM activity_logs al 
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);
        
        // Get paginated results
        const logsQuery = `
            SELECT 
                al.id,
                al.user_id,
                al.action,
                al.target,
                al.target_id,
                al.metadata,
                al.timestamp,
                u.email as user_email
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ${whereClause}
            ORDER BY al.timestamp DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const logsResult = await pool.query(logsQuery, [...params, pageSize, offset]);
        
        // Format the response
        const logs = logsResult.rows.map(row => ({
            id: row.id,
            user: row.user_id ? { id: row.user_id, email: row.user_email } : null,
            action: row.action,
            target: row.target,
            targetId: row.target_id,
            timestamp: row.timestamp,
            metadata: row.metadata
        }));
        
        res.json({
            success: true,
            logs,
            total,
            page,
            pageSize
        });
        return;
    } catch (error) {
        console.error('[ACTIVITY LOG] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});

// Get specific activity log entry
app.get('/activity-log/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                al.id,
                al.user_id,
                al.action,
                al.target,
                al.target_id,
                al.metadata,
                al.timestamp,
                u.email as user_email
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Activity log entry not found' });
        }
        
        const row = result.rows[0];
        const log = {
            id: row.id,
            user: row.user_id ? { id: row.user_id, email: row.user_email } : null,
            action: row.action,
            target: row.target,
            targetId: row.target_id,
            timestamp: row.timestamp,
            metadata: row.metadata
        };
        
        res.json({
            success: true,
            log
        });
        return;
    } catch (error) {
        console.error('[ACTIVITY LOG] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});

// Manual activity log entry (for custom events)
app.post('/activity-log', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { userId, action, target, targetId, metadata } = req.body;
        
        if (!action || !target) {
            return res.status(400).json({ error: 'Action and target are required' });
        }
        
        // Get user id from auth
        let logged_by = null;
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
                const authUserId = typeof decoded === 'object' && decoded.id ? decoded.id : null;
                logged_by = authUserId;
            } catch {}
        }
        
        await logActivity(userId || logged_by, action, target, targetId, metadata);
        
        res.json({ success: true });
        return;
    } catch (error) {
        console.error('[ACTIVITY LOG] Error:', error);
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
