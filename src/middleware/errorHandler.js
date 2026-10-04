const { fail } = require('../utils/response');

function errorHandler(err, req, res, next) {
	console.error('[error]', err.message);

	if (err.name === 'MulterError' || /Unsupported file type/.test(err.message)) {
		return fail(res, err.message, 400);
	}

	return fail(res, err.message || 'Internal server error', err.status || 500);
}

module.exports = errorHandler;
