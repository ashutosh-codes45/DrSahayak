const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

function ensureFile() {
	fs.mkdirSync(path.dirname(config.usersFile), { recursive: true });
	if (!fs.existsSync(config.usersFile)) {
		fs.writeFileSync(config.usersFile, '[]');
	}
}

function readAll() {
	ensureFile();
	try {
		return JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));
	} catch {
		return [];
	}
}

function writeAll(users) {
	ensureFile();
	fs.writeFileSync(config.usersFile, JSON.stringify(users, null, 2));
}

function findByEmail(email) {
	if (typeof email !== 'string') {
		return null;
	}
	const normalizedEmail = email.toLowerCase();
	return readAll().find((user) =>
		typeof user.email === 'string' && user.email.toLowerCase() === normalizedEmail,
	) || null;
}

function findById(id) {
	return readAll().find((user) => user.id === id) || null;
}

function createUser({ name, email, passwordHash, role = 'doctor' } = {}) {
	const user = {
		id: crypto.randomUUID(),
		name,
		email,
		passwordHash,
		role,
		createdAt: new Date().toISOString(),
	};
	const users = readAll();
	users.push(user);
	writeAll(users);
	return user;
}

module.exports = { findByEmail, findById, createUser };