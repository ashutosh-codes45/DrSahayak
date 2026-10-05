const express = require('express');
const patientController = require('../controllers/patient.controller');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole('doctor'), patientController.list);
router.get('/:id', requireRole('doctor', 'patient'), patientController.getById);
router.post('/', requireRole('doctor'), patientController.create);
router.delete('/', requireRole('doctor'), patientController.deleteAll);
router.delete('/:id', requireRole('doctor'), patientController.remove);
router.patch('/:id/intake', requireRole('doctor'), patientController.updateIntake);

module.exports = router;
