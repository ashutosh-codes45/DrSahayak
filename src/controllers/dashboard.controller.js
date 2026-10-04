const { ok, fail } = require('../utils/response');
const store = require('../db/store');
const llm = require('../services/llm.service');

function overview(req, res) {
	const patients = store.listPatients()
		.map((patient) => ({
			id: patient.id,
			name: patient.name,
			language: patient.language,
			status: patient.status,
			hasVoiceIntake: Boolean(patient.voiceIntake),
			documentCount: patient.documents.length,
			hasSummary: Boolean(patient.summary),
			flags: patient.summary?.flags || [],
			urgency: patient.urgency || { score: 0, level: 'low', reasons: [] },
			createdAt: patient.createdAt,
		}))
		.sort((first, second) => second.urgency.score - first.urgency.score);

	return ok(res, patients);
}

async function generateSummary(req, res, next) {
	try {
		const patient = store.getPatient(req.params.id);
		if (!patient) {
			return fail(res, 'Patient not found', 404);
		}
		if (!patient.voiceIntake && patient.documents.length === 0) {
			return fail(res, 'Patient has no voice intake or documents to summarize yet', 400);
		}

		const summaryResult = await llm.generateSummary(
			patient.voiceIntake?.structuredHistory || null,
			patient.documents,
		);
		const updatedPatient = store.updatePatient(patient.id, (existingPatient) => ({
			...existingPatient,
			summary: {
				text: summaryResult.text,
				flags: summaryResult.flags || [],
				generatedAt: new Date().toISOString(),
			},
			status: 'summary_ready',
		}));

		return ok(res, {
			patient: updatedPatient,
			mock: summaryResult.mock,
			degraded: Boolean(summaryResult.degraded),
		});
	} catch (error) {
		return next(error);
	}
}

function markReviewed(req, res) {
	const patient = store.getPatient(req.params.id);
	if (!patient) {
		return fail(res, 'Patient not found', 404);
	}

	const updatedPatient = store.updatePatient(patient.id, (existingPatient) => ({
		...existingPatient,
		status: 'reviewed',
	}));
	return ok(res, updatedPatient);
}

module.exports = { overview, generateSummary, markReviewed };
