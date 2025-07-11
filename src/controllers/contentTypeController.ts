import { Request, Response } from 'express';
import { queries } from '../queries';
import { 
    validateFieldType, 
    ValidationError
} from '../validation';
import {
    CreateContentTypeInput,
    UpdateContentTypeInput,
    ContentTypeResponse,
    ListContentTypesResponse,
    UpdateContentTypeResponse
} from '../types';

export const createContentType = async (req: Request<{}, {}, CreateContentTypeInput>, res: Response<ContentTypeResponse>) => {
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
        throw error;
    }
};

export const listContentTypes = async (_req: Request, res: Response<ListContentTypesResponse>) => {
    try {
        const contentTypes = await queries.listContentTypes();
        // Log the full contentTypes array with all fields
        console.log('[CONTENT TYPES]', JSON.stringify(contentTypes, null, 2));
        return res.json({ success: true, contentTypes });
    } catch (error) {
        throw error;
    }
};

export const updateContentType = async (req: Request<{}, {}, UpdateContentTypeInput>, res: Response<UpdateContentTypeResponse>) => {
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
        throw error;
    }
};

export const deleteContentType = async (req: Request, res: Response) => {
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
        throw error;
    }
}; 