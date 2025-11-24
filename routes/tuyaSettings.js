const express = require('express');
const router = express.Router();
const { authenticateUser, requireAdmin } = require("../middleware/auth");
const {
  getAllTuyaSettings,
  getTuyaSetting,
  updateTuyaSetting,
  updateMultipleTuyaSettings,
  testTuyaConnection
} = require('../controllers/tuyaSettingsController');

// Apply authentication and admin check to all routes
router.use(authenticateUser, requireAdmin);

/**
 * @swagger
 * /tuya-settings:
 *   get:
 *     summary: Get all Tuya settings
 *     description: Retrieve all active Tuya Smart Lock configuration settings
 *     tags: [Tuya Settings]
 *     responses:
 *       200:
 *         description: Successfully retrieved Tuya settings
 *       500:
 *         description: Server error
 */
router.get('/', getAllTuyaSettings);

/**
 * @swagger
 * /tuya-settings/{key}:
 *   get:
 *     summary: Get a single Tuya setting by key
 *     description: Retrieve a specific Tuya setting by its key
 *     tags: [Tuya Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The setting key (e.g., TUYA_CLIENT_ID)
 *     responses:
 *       200:
 *         description: Successfully retrieved setting
 *       404:
 *         description: Setting not found
 *       500:
 *         description: Server error
 */
router.get('/:key', getTuyaSetting);

/**
 * @swagger
 * /tuya-settings/{key}:
 *   put:
 *     summary: Update a Tuya setting
 *     description: Update a specific Tuya setting by its key
 *     tags: [Tuya Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The setting key (e.g., TUYA_CLIENT_ID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settingValue:
 *                 type: string
 *                 description: The new value for the setting
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.put('/:key', updateTuyaSetting);

/**
 * @swagger
 * /tuya-settings/bulk-update:
 *   post:
 *     summary: Update multiple Tuya settings
 *     description: Update multiple Tuya settings at once
 *     tags: [Tuya Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     settingKey:
 *                       type: string
 *                     settingValue:
 *                       type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/bulk-update', updateMultipleTuyaSettings);

/**
 * @swagger
 * /tuya-settings/test-connection:
 *   post:
 *     summary: Test Tuya API connection
 *     description: Test the connection to Tuya API with current settings
 *     tags: [Tuya Settings]
 *     responses:
 *       200:
 *         description: Connection successful
 *       500:
 *         description: Connection failed
 */
router.post('/test-connection', testTuyaConnection);

module.exports = router;

