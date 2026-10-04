const crypto = require('crypto');
const { ok, fail } = require('../utils/response');
const store = require('../db/store');
const vision = require('../services/vision.service');

async function scan(req, res, next) {
	try {
		if (!req.file) {
			return fail(res, 'No document uploaded (field name: "document")', 400);
		}

		const { patientId, patientName } = req.body;
		const extraction = await vision.extractDocument(req.file.path);
		let patient = patientId ? store.getPatient(patientId) : null;
		if (!patient) {
			patient = store.createPatient({ name: patientName });
		}

		const docRecord = {
			id: crypto.randomUUID(),
			fileName: req.file.originalname,
			documentType: extraction.documentType || 'unknown',
			extractedText: extraction.extractedText || '',
			extractedFields: extraction.fields || {},
			createdAt: new Date().toISOString(),
		};
		const updatedPatient = store.updatePatient(patient.id, (existingPatient) => ({
			...existingPatient,
			documents: [...existingPatient.documents, docRecord],
			status: existingPatient.voiceIntake ? 'intake_complete' : existingPatient.status,
		}));

		return ok(res, { patient: updatedPatient, document: docRecord, mock: extraction.mock });
	} catch (error) {
		return next(error);
	}
}

module.exports = { scan };
