const fs = require('fs');
const path = require('path');
const config = require('../config');

async function fetchWithRetry(url, options, timeoutMs = 12000, maxRetries = 3) {
	let lastError;
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(url, { ...options, signal: controller.signal });
			clearTimeout(timeout);

			if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
				try {
					await response.body?.cancel();
				} catch {}
				const delay = 500 * 2 ** attempt + Math.random() * 300; // 500ms, 1s, 2s + jitter
				console.warn(`[vision] Gemini ${response.status}, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
			return response; // success, or out of retries — return whatever we got
		} catch (error) {
			clearTimeout(timeout);
			lastError = error.name === 'AbortError' ? new Error('AI service took too long to respond') : error;
			if (attempt === maxRetries) throw lastError;
		}
	}
	throw lastError;
}

const mimeTypesByExtension = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.pdf': 'application/pdf',
};

function unavailableDocument(reason) {
	return {
		documentType: 'unknown',
		extractedText: '',
		fields: {
			readability: 'unreadable',
			readabilityNote: reason,
			importantDetails: [],
			medications: [],
			labResults: [],
			advice: '',
		},
		mock: false,
		degraded: true,
		degradedReason: reason,
	};
}

async function extractDocument(filePath) {
	const extension = path.extname(filePath).toLowerCase();
	const mimeType = mimeTypesByExtension[extension];
	if (!mimeType) {
		return unavailableDocument('This file type cannot be analyzed. Upload a JPG, PNG, WEBP, or PDF document.');
	}
	if (!config.geminiApiKey) {
		return unavailableDocument('AI extraction is not configured. The document was not analyzed.');
	}

	try {
		const base64Image = (await fs.promises.readFile(filePath)).toString('base64');
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${config.geminiApiKey}`;
		const response = await fetchWithRetry(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{
					parts: [
						{ inline_data: { mime_type: mimeType, data: base64Image } },
						{
							text: `Extract only clinically important information from this image. It may contain a prescription, a lab report, or both on the same page. Inspect every visible section independently. Always extract clearly legible medications into fields.medications AND clearly legible lab tests into fields.labResults; both arrays must be populated when both kinds of content are present. Never skip lab results just because medication instructions are also present, and never skip medications just because lab results are present. For every lab result include its test name, measured result, unit, reference range, and flag when visible. Do not transcribe the whole page, boilerplate, or unrelated text. Never infer, guess, or complete unclear values. Assess readability as clear, partially_readable, or unreadable. If unreadable, return no patient details, medications, lab results, advice, or findings; explain why in readabilityNote. If partially readable, include only values that are clearly legible and explain what needs verification. Respond ONLY with strict JSON, no markdown, matching this shape: { "documentType": "prescription"|"lab_report"|"mixed"|"other"|"unknown", "extractedText": "one concise sentence with key information, or empty when unreadable", "fields": { "readability": "clear"|"partially_readable"|"unreadable", "readabilityNote": string, "doctorName": string, "patientName": string, "patientAge": string, "weight": string, "address": string, "importantDetails": string[], "medications": [{ "name": string, "dosage": string, "frequency": string, "duration": string, "confidence": "low"|"medium"|"high" }], "labResults": [{ "testName": string, "result": string, "unit": string, "referenceRange": string, "flag": "high"|"low"|"normal"|"abnormal"|"", "confidence": "low"|"medium"|"high" }], "advice": string }. For medications preserve the written frequency exactly (for example OD, BD, TDS); do not guess missing frequencies. Include every clearly legible test and medication, even when the other type is also present. Keep importantDetails to a short list of clearly supported findings and avoid repeating advice there. Set absent or uncertain fields to empty values.`,
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

		const fields = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {};
		const readability = ['clear', 'partially_readable', 'unreadable'].includes(fields.readability)
			? fields.readability
			: 'partially_readable';
		const normalizedFields = {
			...fields,
			readability,
			readabilityNote: fields.readabilityNote || (readability === 'unreadable'
				? 'The document is too unclear to extract safely.'
				: readability === 'partially_readable'
					? 'Some text is unclear. Verify extracted values against the original document.'
					: ''),
		};
		if (readability === 'unreadable') {
			return {
				documentType: 'unknown',
				extractedText: '',
				fields: {
					...normalizedFields,
					doctorName: '',
					patientName: '',
					patientAge: '',
					weight: '',
					address: '',
					importantDetails: [],
					medications: [],
					labResults: [],
					advice: '',
				},
				mock: false,
			};
		}
		return { ...parsed, fields: normalizedFields, mock: false };
	} catch (error) {
		console.error('[vision]', error.message);
		return {
			documentType: 'unknown',
			extractedText: '[Extraction unavailable — AI service error]',
			fields: {
				readability: 'unreadable',
				readabilityNote: 'The document could not be analyzed. Please try a clearer image.',
				doctorName: '',
				patientName: '',
				patientAge: '',
				weight: '',
				address: '',
				importantDetails: [],
				medications: [],
				labResults: [],
				advice: '',
			},
			mock: false,
			degraded: true,
			degradedReason: error.message, // NEW: real reason now travels with the result
		};
	}
}

module.exports = { extractDocument };