import { Request, Response } from 'express';
import { queries } from '../queries';
import { 
    validateUUID, 
    validateContentDataForType
} from '../validation';
import {
    CreateContentInput,
    ReadContentInput,
    UpdateContentInput,
    DeleteContentInput,
    ListContentInput,
    ContentResponse,
    ListResponse
} from '../types';
import { getUserFromToken } from '../middleware/auth';

// Helper to get user email by id
async function getUserEmail(userId: number | string | null) {
  if (!userId) return null;
  const { pool } = await import('../db');
  const result = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.email || null;
}

// Helper to log activities
async function logActivity(userId: number | null, action: string, target: string, targetId?: string, metadata?: any) {
  try {
    const { pool } = await import('../db');
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, target, target_id, metadata) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, target, targetId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    console.error('[ACTIVITY LOG] Error logging activity:', error);
  }
}

export const createContent = async (req: Request<{}, {}, CreateContentInput>, res: Response<ContentResponse>) => {
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
        const created_by = getUserFromToken(req);
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
        throw error;
    }
};

export const readContent = async (req: Request<{}, {}, ReadContentInput>, res: Response<ContentResponse>) => {
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
        throw error;
    }
};

export const updateContent = async (req: Request<{}, {}, UpdateContentInput>, res: Response<ContentResponse>) => {
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
        const updated_by = getUserFromToken(req);
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
        throw error;
    }
};

export const deleteContent = async (req: Request<{}, {}, DeleteContentInput>, res: Response<ContentResponse>) => {
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
        const deleted_by = getUserFromToken(req);
        
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
        throw error;
    }
};

export const listContents = async (req: Request<{}, {}, ListContentInput>, res: Response<ListResponse>) => {
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
        throw error;
    }
}; 