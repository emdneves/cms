import { Router } from 'express';
import { 
    createContent, 
    readContent, 
    updateContent, 
    deleteContent, 
    listContents 
} from '../controllers/contentController';

const router = Router();

/**
 * @swagger
 * /content/create:
 *   post:
 *     summary: Create new content
 *     description: Creates new content based on a content type
 *     tags: [Content]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContentInput'
 *     responses:
 *       200:
 *         description: Content created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentResponse'
 *       400:
 *         description: Validation error or invalid content type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/create', createContent);

/**
 * @swagger
 * /content/read:
 *   post:
 *     summary: Read content by ID
 *     description: Retrieves content by its unique ID
 *     tags: [Content]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReadContentInput'
 *     responses:
 *       200:
 *         description: Content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentResponse'
 *       404:
 *         description: Content not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/read', readContent);

/**
 * @swagger
 * /content/update:
 *   post:
 *     summary: Update content
 *     description: Updates existing content by ID
 *     tags: [Content]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateContentInput'
 *     responses:
 *       200:
 *         description: Content updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentResponse'
 *       404:
 *         description: Content not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/update', updateContent);

/**
 * @swagger
 * /content/delete:
 *   post:
 *     summary: Delete content
 *     description: Deletes content by ID
 *     tags: [Content]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteContentInput'
 *     responses:
 *       200:
 *         description: Content deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Content not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/delete', deleteContent);

/**
 * @swagger
 * /content/list:
 *   post:
 *     summary: List contents
 *     description: Lists all contents, optionally filtered by content type
 *     tags: [Content]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content_type_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional content type ID to filter results
 *                 example: "481a065c-8733-4e97-9adf-dc64acacf5fb"
 *     responses:
 *       200:
 *         description: List of contents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListResponse'
 *       400:
 *         description: Invalid JSON or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/list', listContents);

export default router; 