const { ok, fail } = require('../utils/response');
const store = require('../db/store');

function list(req, res) {
	return ok(res, store.listPatients());
}

function getById(req, res) {
	const patient = store.getPatient(req.params.id);
	if (!patient) {
		return fail(res, 'Patient not found', 404);
	}
	return ok(res, patient);
}

function create(req, res) {
	const { name, language } = req.body;
	const patient = store.createPatient({ name, language });
	return ok(res, patient, 201);
}

module.exports = { list, getById, create };
