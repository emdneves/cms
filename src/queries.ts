import { pool } from './db';
import { 
    ContentRow, 
    DatabaseRow, 
    CreateContentInput,
    UpdateContentInput,
    ContentType,
    CreateContentTypeInput,
    ContentTypeDatabaseRow,
    Field
} from './types';

// Helper to map database row to ContentRow
function mapDatabaseRow(row: DatabaseRow): ContentRow {
    return {
        id: row.id,
        content_type_id: row.content_type_id,
        data: row.data,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by ?? null,
        updated_by: row.updated_by ?? null
    };
}

// Helper to map database row to ContentType
function mapContentTypeDatabaseRow(row: ContentTypeDatabaseRow): ContentType {
    return {
        id: row.id,
        name: row.name,
        fields: row.fields,
        created_at: row.created_at
    };
}

export const queries = {
    // Create content type
    async createContentType(input: CreateContentTypeInput): Promise<ContentType> {
        const query = `
            INSERT INTO content_types (name, fields)
            VALUES ($1, $2)
            RETURNING id, name, fields, created_at
        `;
        const result = await pool.query<ContentTypeDatabaseRow>(query, [
            input.name,
            JSON.stringify(input.fields)
        ]);
        // Use fields directly (already parsed)
        const row = result.rows[0];
        return mapContentTypeDatabaseRow(row);
    },

    // List content types
    async listContentTypes(): Promise<ContentType[]> {
        const query = `
            SELECT id, name, fields, created_at
            FROM content_types
            ORDER BY created_at DESC
        `;
        const result = await pool.query<ContentTypeDatabaseRow>(query);
        return result.rows.map(mapContentTypeDatabaseRow);
    },

    // Get content type by id
    async getContentTypeById(id: string): Promise<ContentType | null> {
        const query = `
            SELECT id, name, fields, created_at
            FROM content_types
            WHERE id = $1
        `;
        const result = await pool.query<ContentTypeDatabaseRow>(query, [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return mapContentTypeDatabaseRow(row);
    },

    // Create content
    async createContent(input: CreateContentInput & { created_by?: number | null }): Promise<ContentRow> {
        const query = input.created_by != null
            ? `INSERT INTO contents (content_type_id, data, created_by) VALUES ($1, $2, $3) RETURNING id, content_type_id, data, created_at, updated_at, created_by, updated_by`
            : `INSERT INTO contents (content_type_id, data) VALUES ($1, $2) RETURNING id, content_type_id, data, created_at, updated_at, created_by, updated_by`;
        const params = input.created_by != null
            ? [input.content_type_id, JSON.stringify(input.data), input.created_by]
            : [input.content_type_id, JSON.stringify(input.data)];
        const result = await pool.query<DatabaseRow>(query, params);
        return mapDatabaseRow(result.rows[0]);
    },

    // Read content by ID
    async readContent(id: string): Promise<ContentRow | null> {
        const query = `
            SELECT id, content_type_id, data, created_at, updated_at, created_by, updated_by
            FROM contents
            WHERE id = $1
        `;
        const result = await pool.query<DatabaseRow>(query, [id]);
        if (result.rows.length === 0) {
            return null;
        }
        return mapDatabaseRow(result.rows[0]);
    },

    // Update content
    async updateContent(input: UpdateContentInput & { updated_by?: number | null }): Promise<ContentRow | null> {
        const query = input.updated_by != null
            ? `UPDATE contents SET data = $2, updated_by = $3 WHERE id = $1 RETURNING id, content_type_id, data, created_at, updated_at, created_by, updated_by`
            : `UPDATE contents SET data = $2 WHERE id = $1 RETURNING id, content_type_id, data, created_at, updated_at, created_by, updated_by`;
        const params = input.updated_by != null
            ? [input.id, JSON.stringify(input.data), input.updated_by]
            : [input.id, JSON.stringify(input.data)];
        const result = await pool.query<DatabaseRow>(query, params);
        if (result.rows.length === 0) {
            return null;
        }
        return mapDatabaseRow(result.rows[0]);
    },

    // Delete content
    async deleteContent(id: string): Promise<boolean> {
        const query = `
            DELETE FROM contents
            WHERE id = $1
            RETURNING id
        `;
        const result = await pool.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    },

    // List contents with optional content_type_id filter
    async listContents(content_type_id?: string): Promise<ContentRow[]> {
        let query = `
            SELECT id, content_type_id, data, created_at, updated_at, created_by, updated_by
            FROM contents
        `;
        const params: any[] = [];
        if (content_type_id) {
            query += ' WHERE content_type_id = $1';
            params.push(content_type_id);
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query<DatabaseRow>(query, params);
        return result.rows.map(mapDatabaseRow);
    },

    // Update content type (name and fields)
    async updateContentType(id: string, name: string, fields: Field[]): Promise<ContentType | null> {
        const query = `
            UPDATE content_types
            SET name = $2, fields = $3
            WHERE id = $1
            RETURNING id, name, fields, created_at
        `;
        const result = await pool.query<ContentTypeDatabaseRow>(query, [
            id,
            name,
            JSON.stringify(fields)
        ]);
        if (result.rows.length === 0) return null;
        return mapContentTypeDatabaseRow(result.rows[0]);
    },

    // Delete content type by id
    async deleteContentType(id: string): Promise<boolean> {
        const query = `
            DELETE FROM content_types
            WHERE id = $1
            RETURNING id
        `;
        const result = await pool.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
};
