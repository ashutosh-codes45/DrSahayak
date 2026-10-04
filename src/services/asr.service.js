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

const mockTranscripts = {
	en: 'I have had a fever and headache since yesterday.',
	hi: 'मुझे कल से बुखार और सिरदर्द है।',
	bn: 'গতকাল থেকে আমার জ্বর ও মাথাব্যথা হচ্ছে।',
	te: 'నిన్నటి నుంచి నాకు జ్వరం, తలనొప్పి ఉన్నాయి।',
	mr: 'मला कालपासून ताप आणि डोकेदुखी आहे.',
	ta: 'எனக்கு நேற்று முதல் காய்ச்சலும் தலைவலியும் உள்ளது.',
};

const mimeTypesByExtension = {
	'.mp3': 'audio/mpeg',
	'.mpeg': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.webm': 'audio/webm',
	'.ogg': 'audio/ogg',
	'.m4a': 'audio/mp4',
	'.mp4': 'audio/mp4',
};

async function transcribeAudio(filePath, language) {
	if (!config.geminiApiKey) {
		return {
			transcript: mockTranscripts[language] || mockTranscripts.en,
			language: language || 'en',
			mock: true,
		};
	}

	try {
		const base64Audio = (await fs.promises.readFile(filePath)).toString('base64');
		const extension = path.extname(filePath).toLowerCase();
		const mimeType = mimeTypesByExtension[extension] || 'audio/webm';
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;
		const response = await fetchWithTimeout(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{
					parts: [
						{ inline_data: { mime_type: mimeType, data: base64Audio } },
						{
							text: `Transcribe this audio exactly as spoken. The speaker is using one of: English, Hindi, Bengali, Telugu, Marathi, or Tamil (hint: ${language || 'unspecified'}), possibly code-switching between languages. Return ONLY the transcript text in its original script, no commentary, no markdown.`,
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
		const transcript = result?.candidates?.[0]?.content?.parts?.[0]?.text;
		if (typeof transcript !== 'string') {
			throw new Error('Gemini returned an unexpected response shape for transcription');
		}

		return { transcript, language: language || 'en', mock: false };
	} catch (error) {
		console.error('[asr]', error.message);
		return {
			transcript: '[Transcription unavailable — AI service error]',
			language: language || 'en',
			mock: false,
			degraded: true,
		};
	}
}

module.exports = { transcribeAudio };
