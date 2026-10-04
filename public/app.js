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
const summaryPanel = document.getElementById('summary-panel');
const generateSummaryButton = document.getElementById('generate-summary');
const summaryStatus = document.getElementById('summary-status');
const summaryResult = document.getElementById('summary-result');

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

async function saveIntakeChanges(changes, statusElement, button) {
	if (!currentPatientId) {
		statusElement.textContent = 'Create or select a patient before saving edits.';
		statusElement.className = 'intake-edit-status error';
		return;
	}

	const originalLabel = button.textContent;
	button.disabled = true;
	button.textContent = 'Saving…';
	statusElement.textContent = 'Saving changes…';
	statusElement.className = 'intake-edit-status';
	try {
		const token = localStorage.getItem('drsahayakToken');
		const response = await fetch(`/api/patients/${encodeURIComponent(currentPatientId)}/intake`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify(changes),
		});
		const data = await readApiData(response);
		setActivePatient(data.patient);
		statusElement.textContent = 'Changes saved. Regenerate the summary if needed.';
		statusElement.className = 'intake-edit-status success';
	} catch (error) {
		statusElement.textContent = error.message || 'Could not save changes.';
		statusElement.className = 'intake-edit-status error';
	} finally {
		button.disabled = false;
		button.textContent = originalLabel;
	}
}

function renderVoiceIntakeResult(data) {
	const intake = data.patient.voiceIntake;
	voiceResult.replaceChildren();
	voiceResult.hidden = false;
	voiceResult.classList.toggle('error', Boolean(data.transcriptionDegraded || data.historyDegraded));

	if (data.transcriptionDegraded || data.historyDegraded) {
		const warning = document.createElement('p');
		warning.className = 'intake-edit-warning';
		warning.textContent = data.transcriptionDegraded
			? 'Transcription may be incomplete. Review and edit it before using it clinically.'
			: 'Chief complaint extraction is unavailable. Review the transcript and enter the complaint manually.';
		voiceResult.append(warning);
	}

	const label = document.createElement('label');
	label.className = 'intake-edit-field';
	const labelText = document.createElement('span');
	labelText.textContent = data.mock ? 'Demo transcript' : 'Transcript';
	const transcriptInput = document.createElement('textarea');
	transcriptInput.className = 'intake-edit-input voice-transcript-input';
	transcriptInput.rows = 4;
	transcriptInput.value = intake.transcript || '';
	transcriptInput.setAttribute('aria-label', 'Voice transcript');
	label.append(labelText, transcriptInput);
	voiceResult.append(label);

	if (!data.historyDegraded && !data.transcriptionDegraded) {
		const complaint = document.createElement('p');
		complaint.className = 'voice-intake-complaint';
		complaint.textContent = `Chief Complaint: ${intake.structuredHistory?.chiefComplaint?.trim() || 'Not specified'}`;
		voiceResult.append(complaint);
	}

	const urgency = document.createElement('p');
	urgency.className = 'voice-intake-urgency';
	urgency.textContent = `Urgency: ${data.patient.urgency?.level || 'low'}`;
	voiceResult.append(urgency);

	const actions = document.createElement('div');
	actions.className = 'intake-edit-actions';
	const saveButton = document.createElement('button');
	saveButton.type = 'button';
	saveButton.className = 'btn-secondary';
	saveButton.textContent = 'Save Transcript';
	const status = document.createElement('p');
	status.className = 'intake-edit-status';
	status.hidden = true;
	saveButton.addEventListener('click', () => saveIntakeChanges({
		voiceTranscript: transcriptInput.value,
	}, status, saveButton));
	actions.append(saveButton, status);
	voiceResult.append(actions);
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
	const header = document.createElement('div');
	header.className = 'patient-detail-header';
	const heading = document.createElement('h2');
	heading.textContent = patient.name || 'Unnamed patient';
	header.append(heading);
	const urgencyLevel = patient.urgency?.level?.toLowerCase();
	if (urgencyLevel) {
		const urgencyBadge = document.createElement('span');
		urgencyBadge.className = `urgency-badge ${urgencyLevel}`;
		const urgencyScore = patient.urgency.score;
		urgencyBadge.textContent = `${urgencyLevel[0].toUpperCase()}${urgencyLevel.slice(1)}${urgencyScore == null ? '' : ` · ${urgencyScore}`}`;
		header.append(urgencyBadge);
	}
	detailContent.append(header);

	const overview = createDetailSection('Patient');
	appendDetailField(overview, 'Language', patient.language);
	appendDetailField(overview, 'Status', patient.status);
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

queueList.addEventListener('keydown', (event) => {
	if (event.key !== 'Enter' && event.key !== ' ') return;
	const card = event.target.closest?.('.queue-item');
	if (!card || !queueList.contains(card)) return;
	event.preventDefault();
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
			item.tabIndex = 0;
			item.setAttribute('role', 'button');
			item.setAttribute('aria-pressed', String(patient.id === selectedPatientId));
			const header = document.createElement('div');
			header.className = 'queue-item-header';
			const name = document.createElement('div');
			name.className = 'name';
			name.textContent = patient.name || 'Unnamed patient';
			header.append(name);
			const urgencyLevel = patient.urgency?.level?.toLowerCase();
			if (urgencyLevel) {
				const priority = document.createElement('span');
				priority.className = `queue-priority ${urgencyLevel}`;
				priority.textContent = `${urgencyLevel[0].toUpperCase()}${urgencyLevel.slice(1)}${patient.urgency.score == null ? '' : ` · ${patient.urgency.score}`}`;
				header.append(priority);
			}
			const meta = document.createElement('div');
			meta.className = 'meta';
			const status = (patient.status || 'new').replaceAll('_', ' ');
			const intakeType = patient.hasVoiceIntake ? 'Voice intake' : 'Document only';
			meta.textContent = `${status} · ${intakeType} · ${patient.documentCount || 0} docs`;
			item.append(header, meta);
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
		renderVoiceIntakeResult(data);
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

function createClinicalTable(headers, rows, listName, editableFields, flagColumnIndex = -1, confidenceColumnIndex = -1) {
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
	rows.forEach((values, rowIndex) => {
		const row = document.createElement('tr');
		values.forEach((value, index) => {
			const cell = document.createElement('td');
			const flag = String(value || '').toLowerCase();
			const input = document.createElement('input');
			input.type = 'text';
			input.className = 'clinical-cell-input';
			input.value = value == null ? '' : String(value);
			input.dataset.editList = listName;
			input.dataset.editRow = String(rowIndex);
			input.dataset.editField = editableFields[index];
			input.setAttribute('aria-label', `${headers[index]}, row ${rowIndex + 1}`);
			if (index === confidenceColumnIndex && ['high', 'medium', 'low'].includes(flag)) {
				input.dataset.confidence = flag;
			}
			if (index === flagColumnIndex && ['high', 'low', 'normal', 'abnormal'].includes(flag)) {
				input.dataset.flag = flag;
			}
			cell.append(input);
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

	const extractedTextSection = createDocumentSection('Extracted text');
	const extractedTextInput = document.createElement('textarea');
	extractedTextInput.className = 'intake-edit-input document-text-input';
	extractedTextInput.rows = 3;
	extractedTextInput.value = documentRecord.extractedText || '';
	extractedTextInput.setAttribute('aria-label', 'Extracted document text');
	extractedTextSection.append(extractedTextInput);
	card.append(extractedTextSection);

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
				'medications',
				['name', 'dosage', 'frequency', 'duration', 'confidence'],
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
				'labResults',
				['testName', 'result', 'unit', 'referenceRange', 'flag', 'confidence'],
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

	const editActions = document.createElement('div');
	editActions.className = 'intake-edit-actions';
	const saveButton = document.createElement('button');
	saveButton.type = 'button';
	saveButton.className = 'btn-secondary';
	saveButton.textContent = 'Save Document Edits';
	saveButton.disabled = !documentRecord.id;
	const editStatus = document.createElement('p');
	editStatus.className = 'intake-edit-status';
	editStatus.hidden = true;
	saveButton.addEventListener('click', () => {
		const updatedFields = JSON.parse(JSON.stringify(fields));
		card.querySelectorAll('.clinical-cell-input').forEach((input) => {
			const rows = updatedFields[input.dataset.editList];
			const row = rows?.[Number(input.dataset.editRow)];
			if (row && input.dataset.editField) {
				row[input.dataset.editField] = input.value;
			}
		});
		saveIntakeChanges({
			documents: [{
				id: documentRecord.id,
				extractedText: extractedTextInput.value,
				extractedFields: updatedFields,
			}],
		}, editStatus, saveButton);
	});
	editActions.append(saveButton, editStatus);
	card.append(editActions);

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
	summaryPanel.hidden = true;
	summaryResult.hidden = true;
	summaryResult.textContent = '';
	summaryStatus.hidden = true;
	summaryStatus.textContent = '';
	try {
		const response = await fetch('/api/ocr/scan', { method: 'POST', body: formData });
		const data = await readApiData(response);
		setActivePatient(data.patient);
		renderDocumentExtraction(data.document, data.patient);
		summaryPanel.hidden = false;
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

generateSummaryButton.addEventListener('click', async () => {
	if (!currentPatientId) {
		summaryStatus.textContent = 'Scan a document before generating a summary.';
		summaryStatus.hidden = false;
		return;
	}

	const token = localStorage.getItem('drsahayakToken');
	generateSummaryButton.disabled = true;
	generateSummaryButton.textContent = 'Generating Summary…';
	summaryStatus.textContent = 'Generating a brief summary…';
	summaryStatus.classList.remove('error', 'success');
	summaryStatus.hidden = false;
	summaryResult.hidden = true;
	try {
		const response = await fetch(`/api/dashboard/${encodeURIComponent(currentPatientId)}/summary`, {
			method: 'POST',
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		});
		const data = await readApiData(response);
		const summary = data.patient?.summary?.text;
		if (!summary) {
			throw new Error('The summary service returned no text.');
		}
		if (data.degraded || data.mock) {
			summaryStatus.textContent = summary;
			summaryStatus.classList.add('error');
			return;
		}
		summaryResult.textContent = summary;
		summaryResult.hidden = false;
		summaryStatus.textContent = 'Summary generated.';
		summaryStatus.classList.add('success');
	} catch (error) {
		summaryStatus.textContent = error.message || 'Could not generate the summary.';
		summaryStatus.classList.add('error');
		summaryStatus.hidden = false;
	} finally {
		generateSummaryButton.disabled = false;
		generateSummaryButton.textContent = 'Generate Summary';
	}
});

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
