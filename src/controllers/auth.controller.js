const bcrypt = require('bcryptjs');
const { ok, fail } = require('../utils/response');
const userStore = require('../db/userStore');
const { signToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

function publicUser(user) {
	const { passwordHash, ...safeUser } = user;
	return safeUser;
}

async function register(req, res, next) {
	try {
		const { name, email, password, role } = req.body;
		if (!name || !email || !password) {
			return fail(res, 'name, email and password are required', 400);
		}
		if (password.length < 8) {
			return fail(res, 'password must be at least 8 characters', 400);
		}
		if (userStore.findByEmail(email)) {
			return fail(res, 'An account with this email already exists', 409);
		}

		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
		const user = userStore.createUser({ name, email, passwordHash, role });
		const token = signToken(user);
		return ok(res, { user: publicUser(user), token }, 201);
	} catch (error) {
		return next(error);
	}
}

async function login(req, res, next) {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return fail(res, 'email and password are required', 400);
		}

		const user = userStore.findByEmail(email);
		if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
			return fail(res, 'Invalid email or password', 401);
		}

		const token = signToken(user);
		return ok(res, { user: publicUser(user), token });
	} catch (error) {
		return next(error);
	}
}

function me(req, res) {
	const user = userStore.findById(req.user.sub);
	if (!user) {
		return fail(res, 'User not found', 404);
	}
	return ok(res, publicUser(user));
}

module.exports = { register, login, me };
