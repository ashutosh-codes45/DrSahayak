const config = require('../config');

async function fetchWithTimeout(url, options, timeoutMs = 12000) {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(url, { ...options, signal: controller.signal });
			if (attempt === 0 && (response.status === 429 || response.status === 503)) {
				try {
					await response.body?.cancel();
				} catch {}
				await new Promise((resolve) => setTimeout(resolve, 400));
				continue;
			}
			return response;
		} catch (error) {
			if (error.name === 'AbortError') {
				throw new Error('AI service took too long to respond');
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}

async function callGemini(systemPrompt, userText) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${config.geminiApiKey}`;
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
			text: 'Gemini summary is unavailable because the AI service is not configured.',
			flags: [],
			mock: false,
			degraded: true,
		};
	}

	const systemPrompt = 'Write a brief clinical summary in 2-3 concise sentences for a doctor. Include the patient\'s current chief complaint and relevant symptom duration/history when provided, then the most important findings or medication details from the uploaded documents. Use ONLY facts present in the structured history and document extractions; never infer or invent information. If a detail is missing or marked low confidence, do not state it as fact and add a concise review flag when clinically relevant. Respond ONLY with strict JSON matching this shape: { "text": string, "flags": string[] }.';
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
