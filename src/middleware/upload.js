const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');

fs.mkdirSync(config.uploadDir, { recursive: true });

const AUDIO_TYPES = new Set([
	'audio/mpeg',
	'audio/mp3',
	'audio/wav',
	'audio/x-wav',
	'audio/webm',
	'audio/ogg',
	'audio/mp4',
	'audio/m4a',
]);

const DOCUMENT_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'application/pdf',
]);

const storage = multer.diskStorage({
	destination: config.uploadDir,
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname);
		cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
	},
});

function fileFilterFor(allowedTypes) {
	return (req, file, cb) => {
		const mimeType = file.mimetype.split(';')[0].trim();
		if (allowedTypes.has(mimeType)) {
			return cb(null, true);
		}
		return cb(new Error(`Unsupported file type: ${file.mimetype}`));
	};
}

const uploadAudio = multer({
	storage,
	fileFilter: fileFilterFor(AUDIO_TYPES),
	limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadDocument = multer({
	storage,
	fileFilter: fileFilterFor(DOCUMENT_TYPES),
	limits: { fileSize: 15 * 1024 * 1024 },
});

module.exports = { uploadAudio, uploadDocument };
