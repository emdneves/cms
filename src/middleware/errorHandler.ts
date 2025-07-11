import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../validation';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
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