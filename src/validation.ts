import { FieldType } from './types';

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export function validateFieldType(type: string): FieldType {
    const validTypes: FieldType[] = ['number', 'text', 'date', 'boolean', 'relation', 'media'];
    if (!validTypes.includes(type as FieldType)) {
        throw new ValidationError(`Invalid field type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
    return type as FieldType;
}

export function validateData(data: Record<string, unknown>, type: FieldType): Record<string, number | string | Date> {
    const validated: Record<string, number | string | Date> = {};
    
    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
            throw new ValidationError(`Field '${key}' cannot be null or undefined`);
        }
        
        switch (type) {
            case 'number':
                if (typeof value !== 'number') {
                    throw new ValidationError(`Field '${key}' must be a number for type 'number'`);
                }
                validated[key] = value;
                break;
                
            case 'text':
                if (typeof value !== 'string') {
                    throw new ValidationError(`Field '${key}' must be a string for type 'text'`);
                }
                validated[key] = value;
                break;
                
            case 'date':
                // Accept string dates and convert to Date objects
                if (typeof value === 'string' || value instanceof Date) {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                        throw new ValidationError(`Field '${key}' must be a valid date for type 'date'`);
                    }
                    validated[key] = date.toISOString();
                } else {
                    throw new ValidationError(`Field '${key}' must be a date string or Date object for type 'date'`);
                }
                break;
            case 'media':
                if (typeof value !== 'string') {
                    throw new ValidationError(`Field '${key}' must be a base64-encoded string for type 'media'`);
                }
                // Check if base64 string is not too large (2MB = 2 * 1024 * 1024 bytes)
                // Remove data URL prefix if present
                let base64Data = value;
                const matches = value.match(/^data:(.+);base64,(.*)$/);
                if (matches) {
                    base64Data = matches[2];
                }
                // Calculate size in bytes
                const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
                if (sizeInBytes > 2 * 1024 * 1024) {
                    throw new ValidationError(`Field '${key}' exceeds 2MB size limit for type 'media'`);
                }
                validated[key] = value;
                break;
        }
    }
    
    return validated;
}

export function validateUUID(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        throw new ValidationError(`Invalid UUID format: ${id}`);
    }
}

// Validate content data against a content type's field definitions
export function validateContentDataForType(data: Record<string, unknown>, fields: { name: string; type: FieldType; optional?: boolean; relation?: string }[]): Record<string, number | string | Date | boolean> {
    const validated: Record<string, number | string | Date | boolean> = {};
    for (const field of fields) {
        const value = data[field.name];
        if ((value === null || value === undefined) && !field.optional) {
            throw new ValidationError(`Field '${field.name}' is required and cannot be null or undefined`);
        }
        if (value === null || value === undefined) {
            // If optional and not present, skip validation and assignment
            continue;
        }
        switch (field.type) {
            case 'number':
                if (typeof value !== 'number') {
                    throw new ValidationError(`Field '${field.name}' must be a number`);
                }
                validated[field.name] = value;
                break;
            case 'text':
                if (typeof value !== 'string') {
                    throw new ValidationError(`Field '${field.name}' must be a string`);
                }
                validated[field.name] = value;
                break;
            case 'date':
                if (typeof value === 'string' || value instanceof Date) {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) {
                        throw new ValidationError(`Field '${field.name}' must be a valid date`);
                    }
                    validated[field.name] = date.toISOString();
                } else {
                    throw new ValidationError(`Field '${field.name}' must be a date string or Date object`);
                }
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    throw new ValidationError(`Field '${field.name}' must be a boolean`);
                }
                validated[field.name] = value;
                break;
            case 'relation':
                if (typeof value !== 'string') {
                    throw new ValidationError(`Field '${field.name}' must be a string (relation id)`);
                }
                // Optionally, validate UUID format here
                validated[field.name] = value;
                break;
            case 'media':
                if (typeof value !== 'string') {
                    throw new ValidationError(`Field '${field.name}' must be a base64-encoded string for type 'media'`);
                }
                let base64Data = value;
                const matches = value.match(/^data:(.+);base64,(.*)$/);
                if (matches) {
                    base64Data = matches[2];
                }
                const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
                if (sizeInBytes > 2 * 1024 * 1024) {
                    throw new ValidationError(`Field '${field.name}' exceeds 2MB size limit for type 'media'`);
                }
                validated[field.name] = value;
                break;
        }
    }
    return validated;
}
