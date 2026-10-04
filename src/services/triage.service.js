const keywordGroups = [
	{
		points: 30,
		keywords: [
			'chest pain',
			'breathless',
			'difficulty breathing',
			'unconscious',
			'unresponsive',
			'severe bleeding',
			'seizure',
			'stroke',
			'paralysis',
		],
	},
	{
		points: 15,
		keywords: [
			'high fever',
			'severe pain',
			'blood in',
			'persistent vomiting',
			'dehydration',
		],
	},
	{
		points: 5,
		keywords: ['fever', 'vomiting', 'dizziness', 'infection'],
	},
];

function computeUrgency(structuredHistory) {
	const chiefComplaint = structuredHistory.chiefComplaint || '';
	const symptoms = Array.isArray(structuredHistory.symptoms) ? structuredHistory.symptoms : [];
	const searchableText = `${chiefComplaint} ${symptoms.join(' ')}`.toLowerCase();
	const reasons = [];
	let score = 0;

	for (const group of keywordGroups) {
		for (const keyword of group.keywords) {
			if (searchableText.includes(keyword)) {
				score += group.points;
				reasons.push(`Mentions '${keyword}'`);
			}
		}
	}

	const { durationDays } = structuredHistory;
	if (durationDays >= 7) {
		score += 10;
		reasons.push(`Symptom duration ${durationDays} days`);
	} else if (durationDays >= 3) {
		score += 5;
		reasons.push(`Symptom duration ${durationDays} days`);
	}

	let level = 'low';
	if (score >= 30) {
		level = 'critical';
	} else if (score >= 15) {
		level = 'high';
	} else if (score >= 5) {
		level = 'medium';
	}

	return { score, level, reasons };
}

module.exports = { computeUrgency };
