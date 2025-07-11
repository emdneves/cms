import { Request, Response, NextFunction } from 'express';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
}; 