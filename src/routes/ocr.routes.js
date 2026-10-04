const express = require('express');
const { uploadDocument } = require('../middleware/upload');
const ocrController = require('../controllers/ocr.controller');

const router = express.Router();

router.post('/scan', uploadDocument.single('document'), ocrController.scan);

module.exports = router;
