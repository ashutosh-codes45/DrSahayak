const express = require('express');
const patientController = require('../controllers/patient.controller');

const router = express.Router();

router.get('/', patientController.list);
router.get('/:id', patientController.getById);
router.post('/', patientController.create);

module.exports = router;
