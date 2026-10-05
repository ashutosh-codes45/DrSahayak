const test = require('node:test');
const assert = require('node:assert/strict');
const { computeUrgency } = require('../src/services/triage.service');

const cases = [
	{
		name: 'chest pain is critical',
		structuredHistory: { chiefComplaint: 'chest pain', durationDays: 1 },
		expected: { level: 'critical', score: 30 },
	},
	{
		name: 'multiple critical matches do not stack',
		structuredHistory: { chiefComplaint: 'chest pain and difficulty breathing', durationDays: 1 },
		expected: { level: 'critical', score: 30 },
	},
	{
		name: 'critical urgency includes the duration modifier',
		structuredHistory: { chiefComplaint: 'chest pain', durationDays: 8 },
		expected: { level: 'critical', score: 40 },
	},
	{
		name: 'high matches do not stack',
		structuredHistory: { chiefComplaint: 'high fever and persistent vomiting', durationDays: 1 },
		expected: { level: 'high', score: 15 },
	},
	{
		name: 'high urgency includes the duration modifier',
		structuredHistory: { chiefComplaint: 'high fever', durationDays: 5 },
		expected: { level: 'high', score: 20 },
	},
	{
		name: 'multiple medium matches do not stack',
		structuredHistory: { chiefComplaint: 'fever, vomiting and dizziness', durationDays: 1 },
		expected: { level: 'medium', score: 5 },
	},
	{
		name: 'duration does not promote medium urgency',
		structuredHistory: { chiefComplaint: 'fever', durationDays: 8 },
		expected: { level: 'medium', score: 15 },
	},
	{
		name: 'runny nose is medium urgency',
		structuredHistory: { chiefComplaint: 'runny nose', durationDays: 1 },
		expected: { level: 'medium', score: 5 },
	},
	{
		name: 'unmatched complaints are low urgency',
		structuredHistory: { chiefComplaint: 'something not present in the keyword list', durationDays: 1 },
		expected: { level: 'low', score: 0 },
	},
];

for (const { name, structuredHistory, expected } of cases) {
	test(name, () => {
		const result = computeUrgency(structuredHistory);
		assert.equal(result.level, expected.level);
		assert.equal(result.score, expected.score);
		assert.ok(Array.isArray(result.reasons));
	});
}

test('missing and invalid durations never produce NaN or throw', () => {
	for (const durationDays of [undefined, null, NaN, 'invalid', '', Symbol('invalid')]) {
		const result = computeUrgency({ chiefComplaint: 'fever', durationDays });
		assert.equal(result.level, 'medium');
		assert.equal(result.score, 5);
		assert.equal(Number.isNaN(result.score), false);
	}
	assert.equal(computeUrgency().score, 0);
});