import { Router } from 'express';
import { 
    createContentType, 
    listContentTypes, 
    updateContentType, 
    deleteContentType 
} from '../controllers/contentTypeController';

const router = Router();

/**
 * @swagger
 * /content-type/create:
 *   post:
 *     summary: Create a new content type
 *     description: Creates a new content type with defined fields
 *     tags: [Content Types]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContentTypeInput'
 *     responses:
 *       200:
 *         description: Content type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentTypeResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/create', createContentType);

/**
 * @swagger
 * /content-type/list:
 *   get:
 *     summary: List all content types
 *     description: Retrieves all available content types
 *     tags: [Content Types]
 *     responses:
 *       200:
 *         description: List of content types
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListContentTypesResponse'
 */
router.get('/list', listContentTypes);

/**
 * @swagger
 * /content-type/update:
 *   post:
 *     summary: Update content type
 *     description: Updates an existing content type
 *     tags: [Content Types]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateContentTypeInput'
 *     responses:
 *       200:
 *         description: Content type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateContentTypeResponse'
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/update', updateContentType);

/**
 * @swagger
 * /content-type/delete/{id}:
 *   delete:
 *     summary: Delete content type
 *     description: Deletes a content type by ID
 *     tags: [Content Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Content type ID
 *     responses:
 *       200:
 *         description: Content type deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Content type not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/delete/:id', deleteContentType);

export default router; 