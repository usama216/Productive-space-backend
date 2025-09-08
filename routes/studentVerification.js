const express = require('express');
const router = express.Router();
const { 
  checkStudentVerification, 
  checkMultipleStudentVerifications, 
  getStudentVerificationStats 
} = require('../controllers/studentVerificationController');

/**
 * @swagger
 * /api/student/check-verification:
 *   post:
 *     summary: Check if an email is associated with a verified student account
 *     tags: [Student Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to check
 *     responses:
 *       200:
 *         description: Student verification status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isVerified:
 *                   type: boolean
 *                   description: Whether the email is verified as a student
 *                 user:
 *                   type: object
 *                   description: User information if verified
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/check-verification', checkStudentVerification);

/**
 * @swagger
 * /api/student/check-multiple:
 *   post:
 *     summary: Check student verification status for multiple emails
 *     tags: [Student Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emails
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: Array of email addresses to check
 *     responses:
 *       200:
 *         description: Student verification status for multiple emails
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       email:
 *                         type: string
 *                       isVerified:
 *                         type: boolean
 *                       user:
 *                         type: object
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/check-multiple', checkMultipleStudentVerifications);

/**
 * @swagger
 * /api/student/stats:
 *   get:
 *     summary: Get student verification statistics
 *     tags: [Student Verification]
 *     responses:
 *       200:
 *         description: Student verification statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalStudents:
 *                   type: integer
 *                   description: Total number of students
 *                 verifiedStudents:
 *                   type: integer
 *                   description: Number of verified students
 *                 pendingVerifications:
 *                   type: integer
 *                   description: Number of pending verifications
 *                 rejectedVerifications:
 *                   type: integer
 *                   description: Number of rejected verifications
 *                 verificationRate:
 *                   type: number
 *                   description: Verification success rate
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats', getStudentVerificationStats);

module.exports = router;
