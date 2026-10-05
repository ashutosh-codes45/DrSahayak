const { fail } = require('../utils/response');
const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
	const authorization = req.headers.authorization || '';
	const [scheme, token] = authorization.split(' ');

	if (scheme !== 'Bearer' || !token) {
		return fail(res, 'Missing or malformed Authorization header', 401);
	}

	let user;
	try {
		user = verifyToken(token);
	} catch {
		return fail(res, 'Invalid or expired token', 401);
	}

	req.user = user;
	return next();
}

function requireRole(...allowedRoles) {
	return function authorizeRole(req, res, next) {
		if (!req.user || !allowedRoles.includes(req.user.role)) {
			return fail(res, 'You are not authorized to access this resource', 403);
		}
		return next();
	};
}

module.exports = { requireAuth, requireRole };
