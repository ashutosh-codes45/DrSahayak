const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

function ensureFile() {
	fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
	if (!fs.existsSync(config.dataFile)) {
		fs.writeFileSync(config.dataFile, '[]');
	}
}

function readAll() {
	ensureFile();
	try {
		return JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
	} catch {
		return [];
	}
}

function writeAll(patients) {
	ensureFile();
	fs.writeFileSync(config.dataFile, JSON.stringify(patients, null, 2));
}

function listPatients() {
	return readAll();
}

function getPatient(id) {
	return readAll().find((patient) => patient.id === id) || null;
}

function createPatient({ name = 'Unnamed patient', language = 'unknown' } = {}) {
	const patient = {
		id: crypto.randomUUID(),
		name,
		language,
		createdAt: new Date().toISOString(),
		voiceIntake: null,
		documents: [],
		summary: null,
		urgency: null,
		status: 'new',
	};
	const patients = readAll();
	patients.push(patient);
	writeAll(patients);
	return patient;
}

function updatePatient(id, updaterFn) {
	const patients = readAll();
	const index = patients.findIndex((patient) => patient.id === id);
	if (index === -1) {
		return null;
	}

	const updatedPatient = updaterFn(patients[index]);
	patients[index] = updatedPatient;
	writeAll(patients);
	return updatedPatient;
}

module.exports = { listPatients, getPatient, createPatient, updatePatient };
