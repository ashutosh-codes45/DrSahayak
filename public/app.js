const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const authName = document.getElementById('auth-name');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authRole = document.getElementById('auth-role');
const authNameField = authName.closest('.field');
const authRoleField = document.getElementById('auth-role-field');
const authSubmit = document.getElementById('auth-submit');
const authMessage = document.getElementById('auth-message');
const mainTabs = document.getElementById('main-tabs');
const userPill = document.getElementById('user-pill');
const logoutButton = document.getElementById('logout-btn');
const queueList = document.getElementById('queue-list');
const refreshQueueButton = document.getElementById('refresh-queue');
const detailEmpty = document.getElementById('detail-empty');
const detailContent = document.getElementById('detail-content');

let authMode = 'login';
let isInitializing = true;
let currentPatientId = null;
let selectedPatientId = null;
let audioStream = null;
let audioRecorder = null;
let audioChunks = [];
let selectedAudioFile = null;
let cameraStream = null;
let cameraFacingMode = 'environment';
let capturedDocumentFile = null;
let audioPreviewUrl = null;
let documentPreviewUrl = null;

const patientNameInput = document.getElementById('patient-name');
const patientLanguage = document.getElementById('patient-language');
const patientIdStatus = document.getElementById('patient-id-status');
const recordButton = document.getElementById('record-btn');
const recordStatus = document.getElementById('record-status');
const audioFileInput = document.getElementById('audio-file');
const submitVoiceButton = document.getElementById('submit-voice');
const voiceResult = document.getElementById('voice-result');
const recordPreview = document.getElementById('record-preview');
const openCameraButton = document.getElementById('btn-open-camera');
const useUploadButton = document.getElementById('btn-use-upload');
const cameraContainer = document.getElementById('camera-container');
const cameraVideo = document.getElementById('camera-video');
const cameraError = document.getElementById('camera-error');
const capturePhotoButton = document.getElementById('btn-capture-photo');
const switchCameraButton = document.getElementById('btn-switch-camera');
const closeCameraButton = document.getElementById('btn-close-camera');
const scanPreviewContainer = document.getElementById('scan-preview-container');
const scanPreviewImage = document.getElementById('scan-preview-img');
const retakePhotoButton = document.getElementById('btn-retake-photo');
const submitCameraDocumentButton = document.getElementById('btn-submit-camera-doc');
const uploadContainer = document.getElementById('upload-container');
const documentFileInput = document.getElementById('document-file');
const nativeCameraInput = document.getElementById('camera-native-input');
const submitDocumentButton = document.getElementById('submit-document');
const documentResult = document.getElementById('document-result');

function showAuthMessage(message, type = 'error') {
	authMessage.textContent = message;
	authMessage.classList.remove('error', 'success');
	if (message) {
		authMessage.classList.add(type);
	}
}

function setAuthMode(mode) {
	authMode = mode;
	const isRegister = mode === 'register';

	document.querySelectorAll('.auth-tab').forEach((button) => {
		const active = button.dataset.auth === mode;
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', String(active));
	});
	authNameField.classList.toggle('hidden', !isRegister);
	authRoleField.classList.toggle('hidden', !isRegister);
	authName.required = isRegister;
	authSubmit.textContent = isRegister ? 'Create account' : 'Login';
	showAuthMessage('');
}

function showView(viewName) {
	document.querySelectorAll('.view').forEach((view) => {
		const active = view.id === `view-${viewName}`;
		view.classList.toggle('active', active);
		view.classList.toggle('hidden-view', !active);
	});
	document.querySelectorAll('.tab-btn').forEach((button) => {
		button.classList.toggle('active', button.dataset.view === viewName);
	});
	if (viewName === 'dashboard' && !isInitializing) {
		loadQueue();
	}
}

function showAuthenticatedUser(user) {
	authScreen.classList.remove('active');
	mainTabs.classList.remove('hidden');
	const accountName = user.name || user.email || 'Signed in';
	userPill.textContent = user.role === 'doctor' && !/^dr\.?\s/i.test(accountName)
		? `Dr. ${accountName}`
		: accountName;
	userPill.classList.remove('hidden');
	logoutButton.classList.remove('hidden');
	showView('dashboard');
}

function showLoginScreen() {
	stopRecording();
	stopCamera();
	currentPatientId = null;
	localStorage.removeItem('drsahayakToken');
	mainTabs.classList.add('hidden');
	userPill.classList.add('hidden');
	logoutButton.classList.add('hidden');
	document.querySelectorAll('.view').forEach((view) => {
		view.classList.remove('active');
		view.classList.add('hidden-view');
	});
	authScreen.classList.add('active');
	setAuthMode('login');
}

document.querySelectorAll('.auth-tab').forEach((button) => {
	button.addEventListener('click', () => setAuthMode(button.dataset.auth));
});

document.querySelectorAll('.tab-btn').forEach((button) => {
	button.addEventListener('click', () => showView(button.dataset.view));
});

logoutButton.addEventListener('click', showLoginScreen);

authForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	showAuthMessage('');

	const name = authName.value.trim();
	const email = authEmail.value.trim();
	const password = authPassword.value;
	if (authMode === 'register' && (!name || !email || !password)) {
		showAuthMessage('name, email and password are required');
		return;
	}
	if (authMode === 'login' && (!email || !password)) {
		showAuthMessage('email and password are required');
		return;
	}
	if (!authEmail.validity.valid) {
		showAuthMessage('Please enter a valid email address.');
		return;
	}
	if (authMode === 'register' && password.length < 8) {
		showAuthMessage('password must be at least 8 characters');
		return;
	}

	const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
	const payload = authMode === 'register'
		? { name, email, password, role: authRole.value }
		: { email, password };
	authSubmit.disabled = true;
	authSubmit.textContent = authMode === 'register' ? 'Creating account...' : 'Signing in...';

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const result = await response.json();
		if (!response.ok) {
			showAuthMessage(result.error || 'Authentication failed. Please try again.');
			return;
		}
		if (!result.data?.token || !result.data?.user) {
			showAuthMessage('The server returned an incomplete sign-in response. Please try again.');
			return;
		}

		localStorage.setItem('drsahayakToken', result.data.token);
		authPassword.value = '';
		showAuthenticatedUser(result.data.user);
	} catch {
		showAuthMessage('Could not reach the server. Check your connection and try again.');
	} finally {
		authSubmit.disabled = false;
		authSubmit.textContent = authMode === 'register' ? 'Create account' : 'Login';
	}
});

async function restoreSession() {
	const token = localStorage.getItem('drsahayakToken');
	if (!token) {
		return;
	}

	try {
		const response = await fetch('/api/auth/me', {
			headers: { Authorization: `Bearer ${token}` },
		});
		const result = await response.json();
		if (response.ok && result.data?.id) {
			showAuthenticatedUser(result.data);
		} else {
			localStorage.removeItem('drsahayakToken');
		}
	} catch (error) {
		console.error(error);
		localStorage.removeItem('drsahayakToken');
	}
}

function setResult(element, message, isError = false) {
	element.textContent = message;
	element.hidden = !message;
	element.classList.toggle('error', isError);
}

function setCameraMessage(message) {
	cameraError.textContent = message;
	cameraError.classList.toggle('hidden', !message);
}

function stopAudioTracks() {
	if (audioStream) {
		audioStream.getTracks().forEach((track) => track.stop());
		audioStream = null;
	}
}

function stopRecording() {
	if (audioRecorder && audioRecorder.state === 'recording') {
		audioRecorder.stop();
	}
}

function stopCamera() {
	if (cameraStream) {
		cameraStream.getTracks().forEach((track) => track.stop());
		cameraStream = null;
	}
	if (cameraVideo) {
		cameraVideo.srcObject = null;
	}
	cameraContainer.classList.add('hidden');
}

function setActivePatient(patient) {
	if (!patient?.id) {
		return;
	}
	currentPatientId = patient.id;
	patientIdStatus.textContent = `Active patient: ${patient.name} · ${patient.id}`;
}

async function readApiData(response) {
	let result;
	try {
		result = await response.json();
	} catch {
		throw new Error('The server returned an unreadable response. Please try again.');
	}
	if (!response.ok) {
		throw new Error(result.error || 'The request could not be completed. Please try again.');
	}
	return result.data;
}

function createDetailSection(title) {
	const section = document.createElement('section');
	section.className = 'detail-section';
	const heading = document.createElement('h3');
	heading.textContent = title;
	section.append(heading);
	return section;
}

function appendDetailField(section, label, value) {
	const row = document.createElement('p');
	const labelElement = document.createElement('strong');
	labelElement.textContent = `${label}: `;
	const displayValue = Array.isArray(value) ? value.join(', ') : value;
	row.append(labelElement, document.createTextNode(displayValue || 'Not recorded'));
	section.append(row);
}

function renderPatientDetails(patient) {
	detailContent.replaceChildren();
	const heading = document.createElement('h2');
	heading.textContent = patient.name || 'Unnamed patient';
	detailContent.append(heading);

	const overview = createDetailSection('Patient');
	appendDetailField(overview, 'Language', patient.language);
	appendDetailField(overview, 'Status', patient.status);
	appendDetailField(overview, 'Urgency', patient.urgency?.level);
	detailContent.append(overview);

	const history = patient.voiceIntake?.structuredHistory;
	const historySection = createDetailSection('Structured history');
	appendDetailField(historySection, 'Chief complaint', history?.chiefComplaint);
	appendDetailField(historySection, 'Symptoms', history?.symptoms);
	appendDetailField(historySection, 'Duration (days)', history?.durationDays);
	appendDetailField(historySection, 'Past history', history?.pastHistory);
	appendDetailField(historySection, 'Medications mentioned', history?.medicationsMentioned);
	appendDetailField(historySection, 'Allergies', history?.allergies);
	if (patient.voiceIntake?.transcript) {
		const transcript = document.createElement('div');
		transcript.className = 'transcript-box';
		transcript.textContent = patient.voiceIntake.transcript;
		historySection.append(transcript);
	}
	detailContent.append(historySection);

	const documentsSection = createDetailSection('Documents');
	if (patient.documents?.length) {
		patient.documents.forEach((documentRecord) => {
			appendDetailField(documentsSection, documentRecord.documentType || 'Document', documentRecord.fileName);
			appendDetailField(documentsSection, 'Extracted text', documentRecord.extractedText);
			const medications = documentRecord.extractedFields?.medications || [];
			appendDetailField(documentsSection, 'Medications', medications.map((medication) =>
				[medication.name, medication.dosage, medication.frequency, medication.duration].filter(Boolean).join(' '),
			));
			if (documentRecord.extractedFields?.advice) {
				appendDetailField(documentsSection, 'Advice', documentRecord.extractedFields.advice);
			}
		});
	} else {
		appendDetailField(documentsSection, 'Documents', 'None uploaded');
	}
	detailContent.append(documentsSection);

	const summarySection = createDetailSection('Summary');
	appendDetailField(summarySection, 'Summary', patient.summary?.text);
	appendDetailField(summarySection, 'Flags', patient.summary?.flags);
	detailContent.append(summarySection);

	detailEmpty.hidden = true;
	detailContent.hidden = false;
}

async function selectPatient(patientId) {
	selectedPatientId = patientId;
	queueList.querySelectorAll('.queue-item').forEach((card) => {
		card.classList.toggle('selected', card.dataset.patientId === patientId);
	});
	detailEmpty.hidden = true;
	detailContent.hidden = false;
	detailContent.textContent = 'Loading patient details...';

	try {
		const token = localStorage.getItem('drsahayakToken');
		const headers = token ? { Authorization: `Bearer ${token}` } : {};
		const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`, { headers });
		const patient = await readApiData(response);
		renderPatientDetails(patient);
	} catch (error) {
		console.error(error);
		detailContent.hidden = true;
		detailEmpty.textContent = error.message || 'Could not load patient details.';
		detailEmpty.hidden = false;
	}
}

queueList.addEventListener('click', (event) => {
	const card = event.target.closest?.('.queue-item');
	if (!card || !queueList.contains(card)) {
		return;
	}
	const patientId = card.dataset.patientId;
	console.log('patient card clicked', patientId);
	selectPatient(patientId);
});

async function loadQueue() {
	console.log('loadQueue called');
	queueList.replaceChildren(Object.assign(document.createElement('li'), {
		className: 'queue-empty',
		textContent: 'Loading...',
	}));

	try {
		const token = localStorage.getItem('drsahayakToken');
		const headers = token ? { Authorization: `Bearer ${token}` } : {};
		const response = await fetch('/api/dashboard', { headers });
		const patients = await readApiData(response);
		if (!Array.isArray(patients) || patients.length === 0) {
			queueList.replaceChildren(Object.assign(document.createElement('li'), {
				className: 'queue-empty',
				textContent: 'No patients in the queue.',
			}));
			return;
		}

		queueList.replaceChildren(...patients.map((patient) => {
			const item = document.createElement('li');
			item.className = 'queue-item';
			item.dataset.patientId = patient.id;
			item.classList.toggle('selected', patient.id === selectedPatientId);
			const name = document.createElement('div');
			name.className = 'name';
			name.textContent = patient.name || 'Unnamed patient';
			const meta = document.createElement('div');
			meta.className = 'meta';
			meta.textContent = `${patient.status || 'new'} · ${patient.documentCount || 0} document(s)`;
			item.append(name, meta);
			return item;
		}));
	} catch (error) {
		console.error(error);
		queueList.replaceChildren(Object.assign(document.createElement('li'), {
			className: 'queue-empty',
			textContent: error.message || 'Could not load the patient queue.',
		}));
	}
}

refreshQueueButton.addEventListener('click', loadQueue);

function audioExtension(mimeType) {
	if (mimeType.includes('ogg')) return 'ogg';
	if (mimeType.includes('mp4')) return 'mp4';
	return 'webm';
}

async function beginRecording() {
	if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
		setResult(voiceResult, 'Live recording is not supported in this browser. Choose an audio file to continue.', true);
		audioFileInput.click();
		return;
	}

	try {
		audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const recorderTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
		const supportedType = typeof MediaRecorder.isTypeSupported === 'function'
			? recorderTypes.find((type) => MediaRecorder.isTypeSupported(type))
			: '';
		audioRecorder = supportedType
			? new MediaRecorder(audioStream, { mimeType: supportedType })
			: new MediaRecorder(audioStream);
		audioChunks = [];
		audioRecorder.addEventListener('dataavailable', (event) => {
			if (event.data?.size) {
				audioChunks.push(event.data);
			}
		});
		audioRecorder.addEventListener('stop', () => {
			const mimeType = audioRecorder?.mimeType || audioChunks[0]?.type || 'audio/webm';
			stopAudioTracks();
			recordButton.classList.remove('recording');
			recordButton.textContent = '● Record';
			recordStatus.textContent = 'Recording ready';
			if (!audioChunks.length) {
				setResult(voiceResult, 'No audio was captured. Please try recording again.', true);
				submitVoiceButton.disabled = !selectedAudioFile;
				audioRecorder = null;
				return;
			}

			const audioBlob = new Blob(audioChunks, { type: mimeType });
			selectedAudioFile = new File(
				[audioBlob],
				`voice-intake.${audioExtension(mimeType)}`,
				{ type: mimeType },
			);
			if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
			audioPreviewUrl = URL.createObjectURL(audioBlob);
			recordPreview.src = audioPreviewUrl;
			recordPreview.hidden = false;
			recordPreview.load();
			submitVoiceButton.disabled = false;
			audioRecorder = null;
		});
		audioRecorder.addEventListener('error', () => {
			stopAudioTracks();
			recordButton.classList.remove('recording');
			recordButton.textContent = '● Record';
			recordStatus.textContent = 'Recording failed';
			setResult(voiceResult, 'The recording could not be completed. Check microphone access or upload an audio file.', true);
		});
		audioRecorder.start(1000);
		recordButton.classList.add('recording');
		recordButton.textContent = 'Stop recording';
		recordStatus.textContent = 'Recording… select Stop recording when finished';
		submitVoiceButton.disabled = true;
		setResult(voiceResult, '');
	} catch (error) {
		stopAudioTracks();
		const message = error.name === 'NotAllowedError' || error.name === 'SecurityError'
			? 'Microphone access was blocked. Allow microphone permission in your browser, or upload an audio file.'
			: error.name === 'NotFoundError'
				? 'No microphone was found. Connect a microphone or upload an audio file.'
				: 'Could not start recording. Check microphone access or upload an audio file.';
		recordStatus.textContent = 'Not recording';
		setResult(voiceResult, message, true);
	}
}

recordButton.addEventListener('click', () => {
	if (audioRecorder?.state === 'recording') {
		recordButton.disabled = true;
		recordStatus.textContent = 'Finishing recording…';
		audioRecorder.stop();
		recordButton.disabled = false;
		return;
	}
	beginRecording();
});

audioFileInput.addEventListener('change', () => {
	selectedAudioFile = audioFileInput.files[0] || null;
	submitVoiceButton.disabled = !selectedAudioFile;
	if (selectedAudioFile) {
		recordStatus.textContent = `Selected: ${selectedAudioFile.name}`;
		if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
		audioPreviewUrl = URL.createObjectURL(selectedAudioFile);
		recordPreview.src = audioPreviewUrl;
		recordPreview.hidden = false;
		recordPreview.load();
		setResult(voiceResult, '');
	}
});

submitVoiceButton.addEventListener('click', async () => {
	if (!selectedAudioFile) {
		setResult(voiceResult, 'Record or choose an audio file first.', true);
		return;
	}

	const formData = new FormData();
	formData.append('audio', selectedAudioFile, selectedAudioFile.name);
	formData.append('language', patientLanguage.value);
	formData.append('patientName', patientNameInput.value.trim());
	if (currentPatientId) formData.append('patientId', currentPatientId);
	submitVoiceButton.disabled = true;
	submitVoiceButton.textContent = 'Processing audio…';
	setResult(voiceResult, '');
	try {
		const response = await fetch('/api/voice/intake', { method: 'POST', body: formData });
		const data = await readApiData(response);
		setActivePatient(data.patient);
		const intake = data.patient.voiceIntake;
		if (data.transcriptionDegraded) {
			setResult(voiceResult, `Transcription is unavailable. The saved transcript may be incomplete, so the urgency score needs manual review.\n\n${intake.transcript}`, true);
		} else if (data.historyDegraded) {
			setResult(voiceResult, `Transcript:\n${intake.transcript}\n\nAutomatic symptom extraction is temporarily unavailable. Review the transcript and urgency manually.`, true);
		} else {
			setResult(voiceResult, `${data.mock ? 'Demo transcript' : 'Transcript'}:\n${intake.transcript}\n\nUrgency: ${data.patient.urgency?.level || 'low'}`);
		}
	} catch (error) {
		setResult(voiceResult, error.message, true);
	} finally {
		submitVoiceButton.disabled = !selectedAudioFile;
		submitVoiceButton.textContent = 'Submit voice intake';
	}
});

async function startCamera() {
	setCameraMessage('');
	if (!navigator.mediaDevices?.getUserMedia) {
		setCameraMessage('Live camera access requires HTTPS. Opening your device camera or photo picker instead.');
		nativeCameraInput.click();
		return;
	}

	stopCamera();
	cameraContainer.classList.remove('hidden');
	try {
		cameraStream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: { ideal: cameraFacingMode } },
			audio: false,
		});
		cameraVideo.srcObject = cameraStream;
		await cameraVideo.play();
		switchCameraButton.hidden = false;
	} catch (error) {
		stopCamera();
		const message = error.name === 'NotAllowedError' || error.name === 'SecurityError'
			? 'Camera access was blocked. Allow camera permission or use Upload File.'
			: error.name === 'NotFoundError'
				? 'No camera was found. Use Upload File to select a document.'
				: 'Could not open the camera. Use Upload File to select a document.';
		setCameraMessage(message);
		cameraContainer.classList.remove('hidden');
	}
}

function showDocumentPreview(file) {
	if (!file) return;
	capturedDocumentFile = file;
	if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
	documentPreviewUrl = URL.createObjectURL(file);
	scanPreviewImage.src = documentPreviewUrl;
	scanPreviewContainer.classList.remove('hidden');
	uploadContainer.classList.add('hidden');
	stopCamera();
	setResult(documentResult, '');
}

openCameraButton.addEventListener('click', () => {
	uploadContainer.classList.add('hidden');
	scanPreviewContainer.classList.add('hidden');
	startCamera();
});

useUploadButton.addEventListener('click', () => {
	stopCamera();
	scanPreviewContainer.classList.add('hidden');
	uploadContainer.classList.remove('hidden');
	setCameraMessage('');
});

closeCameraButton.addEventListener('click', stopCamera);

switchCameraButton.addEventListener('click', () => {
	cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
	startCamera();
});

capturePhotoButton.addEventListener('click', () => {
	if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
		setCameraMessage('The camera is not ready yet. Wait a moment and try again.');
		return;
	}
	const canvas = document.createElement('canvas');
	canvas.width = cameraVideo.videoWidth;
	canvas.height = cameraVideo.videoHeight;
	canvas.getContext('2d').drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
	canvas.toBlob((blob) => {
		if (!blob) {
			setCameraMessage('The photo could not be captured. Please try again.');
			return;
		}
		showDocumentPreview(new File([blob], `clinical-document-${Date.now()}.jpg`, { type: 'image/jpeg' }));
	}, 'image/jpeg', 0.9);
});

retakePhotoButton.addEventListener('click', () => {
	scanPreviewContainer.classList.add('hidden');
	startCamera();
});

nativeCameraInput.addEventListener('change', () => {
	showDocumentPreview(nativeCameraInput.files[0]);
});

documentFileInput.addEventListener('change', () => {
	if (documentFileInput.files[0]) {
		setResult(documentResult, `Selected: ${documentFileInput.files[0].name}`);
	}
});

function createDocumentSection(title) {
	const section = document.createElement('section');
	section.className = 'doc-split-section';
	const heading = document.createElement('h5');
	heading.className = 'doc-section-heading';
	heading.textContent = title;
	section.append(heading);
	return section;
}

function createClinicalTable(headers, rows, flagColumnIndex = -1, confidenceColumnIndex = -1) {
	const wrapper = document.createElement('div');
	wrapper.className = 'clinical-table-wrapper';
	const table = document.createElement('table');
	table.className = 'clinical-table';
	const head = document.createElement('thead');
	const headerRow = document.createElement('tr');
	headers.forEach((label) => {
		const cell = document.createElement('th');
		cell.textContent = label;
		headerRow.append(cell);
	});
	head.append(headerRow);
	table.append(head);
	const body = document.createElement('tbody');
	rows.forEach((values) => {
		const row = document.createElement('tr');
		values.forEach((value, index) => {
			const cell = document.createElement('td');
			const flag = String(value || '').toLowerCase();
			if (index === confidenceColumnIndex && ['high', 'medium', 'low'].includes(flag)) {
				const confidence = document.createElement('span');
				confidence.className = `extraction-confidence ${flag}`;
				confidence.textContent = flag === 'low' ? 'Low - verify' : flag;
				cell.append(confidence);
			} else if (index === flagColumnIndex && ['high', 'low', 'normal', 'abnormal'].includes(flag)) {
				const flagBadge = document.createElement('span');
				flagBadge.className = `lab-flag ${flag}`;
				flagBadge.textContent = value;
				cell.append(flagBadge);
			} else {
				cell.textContent = value || 'Not stated';
			}
			row.append(cell);
		});
		body.append(row);
	});
	table.append(body);
	wrapper.append(table);
	return wrapper;
}

function renderDocumentExtraction(documentRecord, patient) {
	const fields = documentRecord.extractedFields || {};
	const readability = fields.readability || 'clear';
	const documentType = (documentRecord.documentType || 'unknown').toLowerCase();
	const hasMedications = Array.isArray(fields.medications) && fields.medications.length > 0;
	const hasLabResults = Array.isArray(fields.labResults) && fields.labResults.length > 0;
	const knownTypes = ['prescription', 'lab_report', 'radiology_scan', 'mixed'];
	const typeClass = hasMedications && hasLabResults
		? 'mixed'
		: knownTypes.includes(documentType) ? documentType : 'other';
	const displayType = hasMedications && hasLabResults
		? 'Prescription + Lab Report'
		: documentType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	const card = document.createElement('article');
	card.className = 'doc-card';
	const header = document.createElement('div');
	header.className = 'doc-header-row';
	const titleBlock = document.createElement('div');
	titleBlock.className = 'doc-title-block';
	const title = document.createElement('h4');
	title.textContent = 'Extracted document details';
	const fileName = document.createElement('div');
	fileName.className = 'doc-submeta';
	fileName.textContent = documentRecord.fileName || '';
	titleBlock.append(title, fileName);
	const typeBadge = document.createElement('span');
	typeBadge.className = `doc-pill ${typeClass}`;
	typeBadge.textContent = displayType;
	header.append(titleBlock, typeBadge);
	card.append(header);

	if (documentRecord.degraded || readability === 'unreadable' || documentRecord.extractedText?.startsWith('[Extraction unavailable')) {
		const message = document.createElement('p');
		message.className = 'doc-extraction-error';
		message.textContent = fields.readabilityNote || 'This attachment could not be read reliably. Please upload a clearer image or review it manually.';
		card.append(message);
	} else {
		if (readability === 'partially_readable') {
			const warning = document.createElement('p');
			warning.className = 'doc-readability-warning';
			warning.textContent = fields.readabilityNote || 'Some text is difficult to read. Verify extracted values against the original attachment.';
			card.append(warning);
		}

		const demographics = createDocumentSection('Patient and provider');
		const grid = document.createElement('div');
		grid.className = 'field-grid';
		const demographicFields = [
			["Doctor's name", fields.doctorName],
			["Patient's name", fields.patientName || patient?.name],
			["Patient's age", fields.patientAge],
			['Address', fields.address],
		];
		if (fields.weight) demographicFields.push(['Weight', fields.weight]);
		demographicFields.forEach(([label, value]) => {
			const item = document.createElement('div');
			item.className = 'field-item';
			const fieldLabel = document.createElement('span');
			fieldLabel.className = 'label';
			fieldLabel.textContent = label;
			const fieldValue = document.createElement('span');
			fieldValue.textContent = value || 'Not visible';
			item.append(fieldLabel, fieldValue);
			grid.append(item);
		});
		demographics.append(grid);
		card.append(demographics);

		const importantDetails = Array.isArray(fields.importantDetails)
			? fields.importantDetails.filter((detail) => typeof detail === 'string' && detail.trim())
			: [];
		if (importantDetails.length) {
			const importantSection = createDocumentSection('Important details');
			const list = document.createElement('ul');
			list.className = 'doc-detail-list';
			importantDetails.forEach((detail) => {
				const item = document.createElement('li');
				item.textContent = detail;
				list.append(item);
			});
			importantSection.append(list);
			card.append(importantSection);
		}
		if (fields.advice) {
			const adviceSection = createDocumentSection('Advice');
			const advice = document.createElement('blockquote');
			advice.className = 'advice-quote';
			advice.textContent = fields.advice;
			adviceSection.append(advice);
			card.append(adviceSection);
		}

		const medications = Array.isArray(fields.medications) ? fields.medications : [];
		if (medications.length) {
			const medicationSection = createDocumentSection('Medications');
			medicationSection.append(createClinicalTable(
				['Medication', 'Dosage', 'Frequency', 'Duration', 'Read confidence'],
				medications.map((medication) => [
					medication.name,
					medication.dosage,
					medication.frequency,
					medication.duration,
					medication.confidence,
				]),
				-1,
				4,
			));
			card.append(medicationSection);
		}

		const labResults = Array.isArray(fields.labResults) ? fields.labResults : [];
		if (labResults.length) {
			const labSection = createDocumentSection('Lab results');
			labSection.append(createClinicalTable(
				['Test', 'Result', 'Unit', 'Reference range', 'Flag', 'Read confidence'],
				labResults.map((result) => [
					result.testName,
					result.result,
					result.unit,
					result.referenceRange,
					result.flag,
					result.confidence,
				]),
				4,
				5,
			));
			card.append(labSection);
		} else if (documentType === 'lab_report') {
			const labSection = createDocumentSection('Lab results');
			const empty = document.createElement('p');
			empty.textContent = 'No test results were extracted.';
			labSection.append(empty);
			card.append(labSection);
		}
	}

	documentResult.replaceChildren(card);
	documentResult.classList.remove('error');
	documentResult.hidden = false;
}

async function submitDocument(file) {
	if (!file) {
		setResult(documentResult, 'Choose or capture a document first.', true);
		return;
	}
	const formData = new FormData();
	formData.append('document', file, file.name);
	formData.append('patientName', patientNameInput.value.trim());
	if (currentPatientId) formData.append('patientId', currentPatientId);
	submitDocumentButton.disabled = true;
	submitCameraDocumentButton.disabled = true;
	const submitButton = file === capturedDocumentFile ? submitCameraDocumentButton : submitDocumentButton;
	const originalLabel = submitButton.textContent;
	submitButton.textContent = 'Extracting document…';
	setResult(documentResult, '');
	try {
		const response = await fetch('/api/ocr/scan', { method: 'POST', body: formData });
		const data = await readApiData(response);
		setActivePatient(data.patient);
		renderDocumentExtraction(data.document, data.patient);
		scanPreviewContainer.classList.add('hidden');
		uploadContainer.classList.add('hidden');
		capturedDocumentFile = null;
		documentFileInput.value = '';
	} catch (error) {
		setResult(documentResult, error.message, true);
	} finally {
		submitDocumentButton.disabled = false;
		submitCameraDocumentButton.disabled = false;
		submitButton.textContent = originalLabel;
	}
}

submitDocumentButton.addEventListener('click', () => submitDocument(documentFileInput.files[0]));
submitCameraDocumentButton.addEventListener('click', () => submitDocument(capturedDocumentFile));

window.addEventListener('beforeunload', () => {
	stopRecording();
	stopCamera();
	if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
	if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
});

async function initializePage() {
	try {
		setAuthMode('login');
		await restoreSession();
	} catch (error) {
		console.error(error);
	} finally {
		isInitializing = false;
		const queueTab = document.querySelector('.tab-btn[data-view="dashboard"]');
		if (queueTab?.classList.contains('active')) {
			await loadQueue();
		}
	}
}

initializePage().catch((error) => console.error(error));
