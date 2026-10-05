const keywordGroups = [
	{
		points: 30,
		keywords: [
			'chest pain',
			'chest pressure',
			'chest tightness',
			'severe chest pain',
			'breathless',
			'difficulty breathing',
			'trouble breathing',
			'shortness of breath',
			'severe breathlessness',
			'cannot breathe',
			'unable to breathe',
			'gasping for air',
			'unconscious',
			'unresponsive',
			'passed out',
			'loss of consciousness',
			'severe bleeding',
			'heavy bleeding',
			'uncontrolled bleeding',
			'bleeding that will not stop',
			'severe choking',
			'severe allergic reaction',
			'anaphylaxis',
			'blue lips',
			'blue face',
			'seizure',
			'convulsion',
			'stroke',
			'paralysis',
			'sudden paralysis',
			'facial drooping',
			'slurred speech',
			'sudden weakness',
			'sudden numbness',
		],
	},
	{
		points: 15,
		keywords: [
			'high fever',
			'very high fever',
			'persistent high fever',
			'fever above 103',
			'fever above 104',
			'severe pain',
			'intense pain',
			'unbearable pain',
			'excruciating pain',
			'severe abdominal pain',
			'severe headache',
			'severe back pain',
			'blood in stool',
			'blood in urine',
			'blood in vomit',
			'vomiting blood',
			'black stool',
			'bloody stool',
			'coughing blood',
			'blood in sputum',
			'persistent vomiting',
			'continuous vomiting',
			'repeated vomiting',
			'cannot keep fluids down',
			'unable to keep fluids down',
			'severe dehydration',
			'very little urine',
			'not urinating',
			'confusion',
			'severe dizziness',
			'fainting',
			'severe weakness',
			'rapid worsening',
			'worsening breathlessness',
		],
	},
	{
		points: 5,
		keywords: [
			'fever',
			'mild fever',
			'low grade fever',
			'chills',
			'infection',
			'sore throat',
			'runny nose',
			'blocked nose',
			'nasal congestion',
			'cough',
			'mild cough',
			'cold',
			'common cold',
			'vomiting',
			'nausea',
			'diarrhea',
			'loose stools',
			'stomach upset',
			'indigestion',
			'loss of appetite',
			'dizziness',
			'mild dizziness',
			'fatigue',
			'tiredness',
			'weakness',
			'body ache',
			'body aches',
			'headache',
			'mild headache',
			'muscle pain',
			'joint pain',
			'sneezing',
			'phlegm',
			'mucus',
			'back pain',
			'mild abdominal pain',
		],
	},
];

function computeUrgency(structuredHistory = {}) {
	structuredHistory = structuredHistory || {};
	const chiefComplaint = structuredHistory.chiefComplaint || '';
	const symptoms = Array.isArray(structuredHistory.symptoms) ? structuredHistory.symptoms : [];
	const searchableText = `${chiefComplaint} ${symptoms.join(' ')}`.toLowerCase();
	const reasons = [];
	let baseScore = 0;

	for (const group of keywordGroups) {
		for (const keyword of group.keywords) {
			if (searchableText.includes(keyword)) {
				baseScore = Math.max(baseScore, group.points);
				reasons.push(`Mentions '${keyword}'`);
			}
		}
	}

	const durationValue = structuredHistory.durationDays;
	const numericDuration = typeof durationValue === 'number'
		|| (typeof durationValue === 'string' && durationValue.trim() !== '')
		? Number(durationValue)
		: NaN;
	const durationDays = Number.isFinite(numericDuration) ? numericDuration : null;
	let durationModifier = 0;
	if (durationDays !== null && durationDays >= 7) {
		durationModifier = 10;
	} else if (durationDays !== null && durationDays >= 3) {
		durationModifier = 5;
	}
	if (durationModifier > 0) {
		reasons.push(`Symptom duration ${durationDays} days`);
	}

	const score = baseScore + durationModifier;
	const level = baseScore === 30 ? 'critical'
		: baseScore === 15 ? 'high'
			: baseScore === 5 ? 'medium' : 'low';

	return { score, level, reasons };
}

module.exports = { computeUrgency };
