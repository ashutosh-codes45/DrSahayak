const { ok, fail } = require('../utils/response');
const store = require('../db/store');
const asr = require('../services/asr.service');
const llm = require('../services/llm.service');
const triage = require('../services/triage.service');

async function intake(req, res, next) {
	try {
		if (!req.file) {
			return fail(res, 'No audio file uploaded (field name: "audio")', 400);
		}

		const { patientId, language, patientName } = req.body;
		const { transcript, mock, degraded: transcriptionDegraded } = await asr.transcribeAudio(req.file.path, language);
		const structuredHistory = await llm.extractStructuredHistory(transcript, language);
		const historyDegraded = structuredHistory.confidence === 'extraction-failed';
		const degraded = transcriptionDegraded || historyDegraded;
		const urgency = triage.computeUrgency(structuredHistory);

		let patient = patientId ? store.getPatient(patientId) : null;
		if (!patient) {
			patient = store.createPatient({ name: patientName, language });
		}

		const updatedPatient = store.updatePatient(patient.id, (existingPatient) => ({
			...existingPatient,
			voiceIntake: {
				transcript,
				structuredHistory,
				language: language || 'en',
				createdAt: new Date().toISOString(),
			},
			urgency,
			status: 'intake_complete',
		}));

		return ok(res, {
			patient: updatedPatient,
			mock,
			degraded,
			transcriptionDegraded: Boolean(transcriptionDegraded),
			historyDegraded,
		});
	} catch (error) {
		return next(error);
	}
}

module.exports = { intake };
