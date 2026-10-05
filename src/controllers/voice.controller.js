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
		const translationResult = transcriptionDegraded
			? { translation: '', degraded: false }
			: await llm.translateTranscriptToEnglish(transcript, language);
		const englishTranslation = translationResult.translation;
		const extractionTranscript = englishTranslation || transcript;
		const extractionLanguage = englishTranslation ? 'en' : language;
		const structuredHistory = await llm.extractStructuredHistory(extractionTranscript, extractionLanguage);
		const historyDegraded = structuredHistory.confidence === 'extraction-failed';
		const translationDegraded = translationResult.degraded;
		const degraded = transcriptionDegraded || translationDegraded || historyDegraded;
		const urgency = triage.computeUrgency(structuredHistory);

		let patient = patientId ? store.getPatient(patientId) : null;
		if (!patient) {
			patient = store.createPatient({ name: patientName, language });
		}

		const updatedPatient = store.updatePatient(patient.id, (existingPatient) => ({
			...existingPatient,
			voiceIntake: {
				transcript,
				englishTranslation,
				structuredHistory,
				language: language || 'en',
				fileName: req.file.originalname,
				fileUrl: `/uploads/${encodeURIComponent(req.file.filename)}`,
				mimeType: req.file.mimetype,
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
			translationDegraded: Boolean(translationDegraded),
			historyDegraded,
		});
	} catch (error) {
		return next(error);
	}
}

module.exports = { intake };
