const fs = require('fs');
const path = require('path');
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

const mimeTypesByExtension = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
};

function mockDocument() {
	return {
		documentType: 'prescription',
		extractedText: 'Paracetamol 500mg TDS x3 days\nAzithromycin 250mg OD x5 days\nAdvice: Rest and follow up if symptoms persist.',
		fields: {
			medications: [
				{
					name: 'Paracetamol',
					dosage: '500mg',
					frequency: 'TDS',
					duration: '3 days',
					confidence: 'high',
				},
				{
					name: 'Azithromycin',
					dosage: '250mg',
					frequency: 'OD',
					duration: '5 days',
					confidence: 'medium',
				},
			],
			advice: 'Rest and follow up if symptoms persist.',
		},
		mock: true,
	};
}

async function extractDocument(filePath) {
	const extension = path.extname(filePath).toLowerCase();
	const mimeType = mimeTypesByExtension[extension];
	if (!config.geminiApiKey || !mimeType) {
		return mockDocument();
	}

	try {
		const base64Image = (await fs.promises.readFile(filePath)).toString('base64');
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;
		const response = await fetchWithTimeout(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{
					parts: [
						{ inline_data: { mime_type: mimeType, data: base64Image } },
						{
							text: 'You are extracting structured data from a clinical document photo (prescription or lab report), which may include handwriting. Respond ONLY with strict JSON, no markdown, no commentary, matching this exact shape: { "documentType": string, "extractedText": string, "fields": { "medications": [{ "name": string, "dosage": string, "frequency": string, "duration": string, "confidence": "low"|"medium"|"high" }], "advice": string } }. The confidence field reflects how certain you are about that specific medication\'s reading — use "low" for unclear handwriting or ambiguous dosages, "high" for clearly printed/legible text, "medium" otherwise. If a field is not present, use an empty string or empty array. Do not invent medications that aren\'t visibly present.',
						},
					],
				}],
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Gemini API request failed (${response.status}): ${errorBody}`);
		}

		const result = await response.json();
		const modelText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
		if (typeof modelText !== 'string') {
			throw new Error('Vision model returned non-JSON output');
		}

		const jsonText = modelText.trim()
			.replace(/^```(?:json)?\s*/i, '')
			.replace(/\s*```$/, '')
			.trim();
		let parsed;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			throw new Error('Vision model returned non-JSON output');
		}

		return { ...parsed, mock: false };
	} catch (error) {
		console.error('[vision]', error.message);
		return {
			documentType: 'unknown',
			extractedText: '[Extraction unavailable — AI service error]',
			fields: { medications: [], advice: '' },
			mock: false,
			degraded: true,
		};
	}
}

module.exports = { extractDocument };
