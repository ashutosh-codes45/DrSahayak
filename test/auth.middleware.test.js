const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../src/middleware/auth');

function invokeRoleCheck(role, allowedRoles) {
	let statusCode = 200;
	let nextCalled = false;
	const response = {
		status(code) {
			statusCode = code;
			return this;
		},
		json() {
			return this;
		},
	};
	requireRole(...allowedRoles)({ user: { role } }, response, () => {
		nextCalled = true;
	});
	return { statusCode, nextCalled };
}

test('role middleware allows a patient to access patient-history routes', () => {
	assert.deepEqual(invokeRoleCheck('patient', ['doctor', 'patient']), {
		statusCode: 200,
		nextCalled: true,
	});
});

test('role middleware blocks a patient from doctor-only routes', () => {
	assert.deepEqual(invokeRoleCheck('patient', ['doctor']), {
		statusCode: 403,
		nextCalled: false,
	});
});