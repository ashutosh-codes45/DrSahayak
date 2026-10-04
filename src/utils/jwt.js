const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(user) {
	if (!config.jwtSecret) {
		throw new Error('JWT_SECRET is not set — add it to your .env file');
	}

	return jwt.sign(
		{ sub: user.id, email: user.email, role: user.role },
		config.jwtSecret,
		{ expiresIn: config.jwtExpiresIn },
	);
}

function verifyToken(token) {
	return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken };
