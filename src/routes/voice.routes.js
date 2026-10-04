const express = require('express');
const { uploadAudio } = require('../middleware/upload');
const voiceController = require('../controllers/voice.controller');

const router = express.Router();

router.post('/intake', uploadAudio.single('audio'), voiceController.intake);

module.exports = router;
