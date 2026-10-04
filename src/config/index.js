const path = require('path');

require('dotenv').config();

const projectRoot = path.resolve(__dirname, '..', '..');

function resolveProjectPath(value) {
	return path.isAbsolute(value) ? value : path.join(projectRoot, value);
}

module.exports = {
	port: Number(process.env.PORT || 4000),
	nodeEnv: process.env.NODE_ENV || 'development',
	geminiApiKey: process.env.GEMINI_API_KEY || '',
	jwtSecret: process.env.JWT_SECRET || '',
	jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
	uploadDir: resolveProjectPath(process.env.UPLOAD_DIR || 'uploads'),
	dataFile: resolveProjectPath(process.env.DATA_FILE || 'data/patients.json'),
	usersFile: resolveProjectPath(process.env.USERS_FILE || 'data/users.json'),
};
