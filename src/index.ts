import express from 'express';
import { testConnection } from './db';
import { corsMiddleware } from './middleware/cors';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger';

// Import routes
import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import contentTypeRoutes from './routes/contentType';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(loggingMiddleware);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/', authRoutes);
app.use('/content', contentRoutes);
app.use('/content-type', contentTypeRoutes);

// Health check
app.get('/health', (_req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
async function start() {
    try {
        // Test database connection
        await testConnection();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
            console.log('\nAvailable endpoints:');
            console.log('  - /register (POST)');
            console.log('  - /login (POST)');
            console.log('  - /content-type/create (POST)');
            console.log('  - /content-type/list (GET)');
            console.log('  - /content-type/update (POST)');
            console.log('  - /content-type/delete/:id (DELETE)');
            console.log('  - /content/create (POST)');
            console.log('  - /content/read (POST)');
            console.log('  - /content/update (POST)');
            console.log('  - /content/delete (POST)');
            console.log('  - /content/list (POST)');
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