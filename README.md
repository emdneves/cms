# Minimal Headless CMS

A minimal headless CMS built with Node.js, TypeScript, and PostgreSQL using raw SQL (no ORM).

## Features

- **POST-only endpoints** for all CRUD operations
- **No authentication** (for simplicity)
- Support for three field types: `number`, `text`, `date`
- Content stored as JSON objects
- TypeScript with strict mode enabled
- Raw SQL queries with parameterized statements
- Automatic `updated_at` timestamp updates via database trigger

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd minimal-cms
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Create the database and run the schema:
```bash
# Create database (if it doesn't exist)
createdb minimal_cms

# Run the schema
psql -U postgres -d minimal_cms -f schema.sql
```

## Running the Application

### Demo mode (no database required):
```bash
npm run demo
```
This runs an in-memory version perfect for testing the API without PostgreSQL.

### Development mode (requires PostgreSQL):
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

## API Endpoints

All endpoints use POST method and expect JSON payloads.

### Create Content Type
**POST** `/content-type/create`
```json
{
  "name": "Article",
  "fields": [
    { "name": "publishedDate", "type": "date" },
    { "name": "title", "type": "text" },
    { "name": "views", "type": "number" }
  ]
}
```

### List Content Types
**GET** `/content-type/list`

Response:
```json
{
  "success": true,
  "contentTypes": [
    {
      "id": "...",
      "name": "Article",
      "fields": [
        { "name": "publishedDate", "type": "date" },
        { "name": "title", "type": "text" },
        { "name": "views", "type": "number" }
      ],
      "created_at": "..."
    }
  ]
}
```

### Create Content
**POST** `/content/create`
```json
{
  "content_type_id": "<id from content-type/list>",
  "data": {
    "publishedDate": "2024-06-01",
    "title": "My First Article",
    "views": 100
  }
}
```

### Read Content
**POST** `/content/read`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Update Content
**POST** `/content/update`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "publishedDate": "2024-06-02",
    "title": "Updated Title",
    "views": 200
  }
}
```

### Delete Content
**POST** `/content/delete`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### List Contents
**POST** `/content/list`
```json
{
  "content_type_id": "<id from content-type/list>" // optional filter
}
```

## Examples

### Creating a Content Type
```bash
curl -X POST http://localhost:3000/content-type/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Article",
    "fields": [
      { "name": "publishedDate", "type": "date" },
      { "name": "title", "type": "text" },
      { "name": "views", "type": "number" }
    ]
  }'
```

### Creating Content for a Content Type
```bash
curl -X POST http://localhost:3000/content/create \
  -H "Content-Type: application/json" \
  -d '{
    "content_type_id": "<id from content-type/list>",
    "data": {
      "publishedDate": "2024-06-01",
      "title": "My First Article",
      "views": 100
    }
  }'
```

## Response Format

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "content": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "type": "text",
    "data": {
      "title": "Hello World"
    },
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Content not found"
}
```

## Adding New Field Types

To add a new field type:

1. Update the database CHECK constraint:
```sql
ALTER TABLE contents DROP CONSTRAINT contents_type_check;
ALTER TABLE contents ADD CONSTRAINT contents_type_check 
  CHECK (type IN ('number','text','date','newtype'));
```

2. Update the `FieldType` type in `src/types.ts`:
```typescript
export type FieldType = 'number' | 'text' | 'date' | 'newtype';
```

3. Add validation logic in `src/validation.ts` for the new type.

## Architecture Notes

- **No ORM**: Uses the native `pg` library for raw SQL queries
- **Type Safety**: All SQL queries return typed results
- **Validation**: Input validation before database operations
- **Error Handling**: Centralized error handling with appropriate HTTP status codes
- **Database Triggers**: Automatic `updated_at` timestamp updates

## Docker Support (Optional)

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Create a `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: minimal_cms
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
  
  app:
    build: .
    depends_on:
      - postgres
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: minimal_cms
      DB_USER: postgres
      DB_PASSWORD: postgres
      PORT: 3000
    ports:
      - "3000:3000"
```

## License

MIT
