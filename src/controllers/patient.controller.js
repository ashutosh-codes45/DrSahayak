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

function updateIntake(req, res) {
	const patient = store.getPatient(req.params.id);
	if (!patient) {
		return fail(res, 'Patient not found', 404);
	}

	const { voiceTranscript, documents } = req.body || {};
	if (voiceTranscript === undefined && documents === undefined) {
		return fail(res, 'No intake changes were provided', 400);
	}
	if (voiceTranscript !== undefined && (typeof voiceTranscript !== 'string' || voiceTranscript.length > 30000)) {
		return fail(res, 'Transcript must be text no longer than 30000 characters', 400);
	}
	if (documents !== undefined && (!Array.isArray(documents) || documents.length > patient.documents.length)) {
		return fail(res, 'Document changes must reference existing documents', 400);
	}
	if (voiceTranscript !== undefined && !patient.voiceIntake) {
		return fail(res, 'Patient has no voice transcript to update', 400);
	}

	const documentUpdates = new Map();
	for (const update of documents || []) {
		if (!update || typeof update.id !== 'string' || typeof update.extractedText !== 'string' || update.extractedText.length > 50000 || !update.extractedFields || typeof update.extractedFields !== 'object' || Array.isArray(update.extractedFields)) {
			return fail(res, 'Document changes contain invalid fields', 400);
		}
		if (!patient.documents.some((document) => document.id === update.id)) {
			return fail(res, 'Document not found for this patient', 404);
		}
		documentUpdates.set(update.id, update);
	}

	const updatedPatient = store.updatePatient(patient.id, (existingPatient) => ({
		...existingPatient,
		...(voiceTranscript !== undefined
			? { voiceIntake: { ...existingPatient.voiceIntake, transcript: voiceTranscript } }
			: {}),
		documents: existingPatient.documents.map((document) => {
			const update = documentUpdates.get(document.id);
			return update
				? { ...document, extractedText: update.extractedText, extractedFields: update.extractedFields, editedAt: new Date().toISOString() }
				: document;
		}),
		summary: null,
		status: existingPatient.summary ? 'intake_complete' : existingPatient.status,
	}));

	return ok(res, { patient: updatedPatient });
}

module.exports = { list, getById, create, updateIntake };
