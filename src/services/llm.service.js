const config = require('../config');

function fetchWithTimeout(url, options, timeoutMs = 12000) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	return fetch(url, { ...options, signal: controller.signal })
		.catch((error) => {
			if (error.name === 'AbortError') {
				throw new Error('AI service took too long to respond');
			}
			throw error;
		})
		.finally(() => clearTimeout(timeout));
}

async function callGemini(systemPrompt, userText) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;
	const response = await fetchWithTimeout(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [{ parts: [{ text: `${systemPrompt}\n\n${userText}` }] }],
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Gemini API request failed (${response.status}): ${errorBody}`);
	}

	const result = await response.json();
	const modelText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (typeof modelText !== 'string') {
		throw new Error('Gemini returned an unexpected response shape');
	}

	return modelText.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '')
		.trim();
}

async function extractStructuredHistory(transcript, language) {
	if (!config.geminiApiKey) {
		return {
			chiefComplaint: 'Fever with headache',
			symptoms: ['fever', 'headache', 'mild cough'],
			durationDays: 3,
			pastHistory: [],
			medicationsMentioned: [],
			allergies: [],
			confidence: 'mock-data',
		};
	}

	const systemPrompt = 'Convert the patient transcript, which may be in English, Hindi, Bengali, Telugu, Marathi, or Tamil and may be code-switched, into strict JSON matching this shape: { "chiefComplaint": string, "symptoms": string[], "durationDays": number|null, "pastHistory": string[], "medicationsMentioned": string[], "allergies": string[] }. Do not invent details that are not present in the transcript.';
	try {
		const result = await callGemini(systemPrompt, `Language: ${language}\nTranscript: ${transcript}`);
		return { ...JSON.parse(result), confidence: 'model-generated' };
	} catch (error) {
		console.error('[llm]', error.message);
		return {
			chiefComplaint: transcript.slice(0, 100),
			symptoms: [],
			durationDays: null,
			pastHistory: [],
			medicationsMentioned: [],
			allergies: [],
			confidence: 'extraction-failed',
		};
	}
}

async function generateSummary(structuredHistory, documents) {
	if (!config.geminiApiKey) {
		return {
			text: 'The patient reports fever, headache, and mild cough for three days. The prescription lists Paracetamol 500mg three times daily for three days and Azithromycin 250mg once daily for five days; rest and follow-up were advised.',
			flags: ['duration_over_72h'],
			mock: true,
		};
	}

	const systemPrompt = 'Draft a concise clinical summary for a doctor to quickly review, based ONLY on the structured history and document extractions provided. Never invent facts. Flag anything needing attention, including symptom duration over 3 days, possible drug interactions between medicationsMentioned and newly extracted medications, missing data, and any extracted fields with low confidence that are worth double-checking. Respond ONLY with strict JSON matching this shape: { "text": string, "flags": string[] }.';
	try {
		const result = await callGemini(systemPrompt, JSON.stringify({ structuredHistory, documents }));
		return { ...JSON.parse(result), mock: false };
	} catch (error) {
		console.error('[llm]', error.message);
		return {
			text: 'Summary generation unavailable — please review the structured history and documents directly.',
			flags: ['summary_generation_failed'],
			mock: false,
			degraded: true,
		};
	}
}

module.exports = { extractStructuredHistory, generateSummary };
