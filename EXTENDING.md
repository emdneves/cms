# Adding New Field Types

This guide shows how to add a new field type to the Minimal CMS. As an example, we'll add a `boolean` type.

## Step 1: Update the Database

Run this SQL to update the CHECK constraint:

```sql
-- Remove the old constraint
ALTER TABLE contents DROP CONSTRAINT contents_type_check;

-- Add the new constraint with boolean type
ALTER TABLE contents ADD CONSTRAINT contents_type_check 
  CHECK (type IN ('number', 'text', 'date', 'boolean'));
```

## Step 2: Update TypeScript Types

In `src/types.ts`, update the `FieldType` union:

```typescript
export type FieldType = 'number' | 'text' | 'date' | 'boolean';
```

## Step 3: Update Validation

In `src/validation.ts`, add validation for the new type in the `validateData` function:

```typescript
case 'boolean':
    if (typeof value !== 'boolean') {
        throw new ValidationError(`Field '${key}' must be a boolean for type 'boolean'`);
    }
    validated[key] = value;
    break;
```

## Step 4: Test the New Type

Create content with the new boolean type:

```bash
curl -X POST http://localhost:3000/content/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "boolean",
    "data": {
      "isActive": true,
      "isPublished": false,
      "requiresAuth": true
    }
  }'
```

## Adding More Complex Types

For more complex types like `array` or `object`, you would:

1. Update the CHECK constraint
2. Update the TypeScript types
3. Add appropriate validation logic
4. Consider if the JSONB storage format needs adjustment
5. Update any relevant documentation

## Best Practices

1. **Backward Compatibility**: When adding new types, ensure existing content still works
2. **Validation**: Add thorough validation for new types
3. **Testing**: Test edge cases for new types
4. **Documentation**: Update API documentation with examples of new types
