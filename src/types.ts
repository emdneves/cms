export type FieldType = 'number' | 'text' | 'date' | 'boolean' | 'relation' | 'media' | 'enum' | 'price';

export interface Field {
    name: string;
    type: FieldType;
    optional?: boolean;
    relation?: string;
    options?: string[];
}

export interface ContentType {
    id: string;
    name: string;
    fields: Field[];
    created_at: Date;
    created_by?: number | null;
    updated_by?: number | null;
}

export interface ContentRow {
    id: string;
    content_type_id: string;
    data: Record<string, number | string | boolean | Date | null>;
    created_at: Date;
    updated_at: Date;
    created_by?: number | null;
    updated_by?: number | null;
}

/* Request payloads */
export interface CreateContentTypeInput {
    name: string;
    fields: Field[];
}

export interface CreateContentInput {
    content_type_id: string;
    data: Record<string, number | string | boolean | Date | null>;
}

export interface ReadContentInput {
    id: string;
}

export interface UpdateContentInput {
    id: string;
    data: Record<string, unknown>;
}

export interface DeleteContentInput {
    id: string;
}

export interface ListContentInput {
    content_type_id?: string;
}

export interface UpdateContentTypeInput {
    id: string;
    name: string;
    fields: Field[];
}

/* Response shapes */
export interface ContentResponse {
    success: boolean;
    content?: ContentRow;
    error?: string;
}

export interface ListResponse {
    success: boolean;
    contents: ContentRow[];
    error?: string;
}

export interface ContentTypeResponse {
    success: boolean;
    contentType?: ContentType;
    error?: string;
}

export interface ListContentTypesResponse {
    success: boolean;
    contentTypes: ContentType[];
    error?: string;
}

export interface UpdateContentTypeResponse {
    success: boolean;
    contentType?: ContentType;
    error?: string;
}

/* Database result type */
export interface DatabaseRow {
    id: string;
    content_type_id: string;
    data: Record<string, number | string | boolean | Date | null>;
    created_at: Date;
    updated_at: Date;
    created_by?: number | null;
    updated_by?: number | null;
}

export interface ContentTypeDatabaseRow {
    id: string;
    name: string;
    fields: any;
    created_at: Date;
}
