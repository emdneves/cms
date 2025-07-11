import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Minimal CMS API',
      version: '1.0.0',
      description: 'A minimal headless CMS API with Node.js, TypeScript and PostgreSQL',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Field: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Field name'
            },
            type: {
              type: 'string',
              enum: ['number', 'text', 'date', 'boolean', 'relation', 'media', 'enum', 'price'],
              description: 'Field type'
            },
            optional: {
              type: 'boolean',
              description: 'Whether the field is optional'
            },
            relation: {
              type: 'string',
              description: 'Related content type ID (for relation fields)'
            },
            options: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Available options (for enum fields)'
            }
          },
          required: ['name', 'type']
        },
        ContentType: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            fields: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Field'
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            created_by: {
              type: 'number',
              nullable: true
            },
            updated_by: {
              type: 'number',
              nullable: true
            }
          }
        },
        ContentRow: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            content_type_id: {
              type: 'string',
              format: 'uuid'
            },
            data: {
              type: 'object',
              description: 'Dynamic content data based on content type fields'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            },
            created_by: {
              type: 'number',
              nullable: true
            },
            updated_by: {
              type: 'number',
              nullable: true
            }
          }
        },
        CreateContentTypeInput: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Content type name'
            },
            fields: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Field'
              },
              description: 'Array of field definitions'
            }
          },
          required: ['name', 'fields']
        },
        CreateContentInput: {
          type: 'object',
          properties: {
            content_type_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the content type'
            },
            data: {
              type: 'object',
              description: 'Content data matching the content type fields'
            }
          },
          required: ['content_type_id', 'data']
        },
        UpdateContentInput: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Content ID to update'
            },
            data: {
              type: 'object',
              description: 'Updated content data'
            }
          },
          required: ['id', 'data']
        },
        ListContentInput: {
          type: 'object',
          properties: {
            content_type_id: {
              type: 'string',
              format: 'uuid',
              description: 'Optional content type ID to filter results'
            }
          }
        },
        ContentResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            content: {
              $ref: '#/components/schemas/ContentRow'
            },
            error: {
              type: 'string'
            }
          }
        },
        ListResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            contents: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ContentRow'
              }
            },
            error: {
              type: 'string'
            }
          }
        },
        ContentTypeResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            contentType: {
              $ref: '#/components/schemas/ContentType'
            },
            error: {
              type: 'string'
            }
          }
        },
        ListContentTypesResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            contentTypes: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ContentType'
              }
            },
            error: {
              type: 'string'
            }
          }
        },
        UpdateContentTypeInput: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Content type ID to update'
            },
            name: {
              type: 'string',
              description: 'Content type name'
            },
            fields: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Field'
              },
              description: 'Array of field definitions'
            }
          },
          required: ['id', 'name', 'fields']
        },
        UploadResponse: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field name'
                  },
                  url: {
                    type: 'string',
                    description: 'Uploaded file URL'
                  }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  },
  apis: ['./src/index.ts'], // Path to the API docs
};

export const specs = swaggerJsdoc(options); 