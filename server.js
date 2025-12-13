require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { scanForChanges, executeChanges, scanForInactiveProjects } = require('./sync');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// POST /api/scan - Returns list of proposed changes
app.post('/api/scan', async (req, res) => {
    console.log("Received Scan Request");
    try {
        const changes = await scanForChanges();
        res.json({ success: true, changes });
    } catch (error) {
        console.error('Scan Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/scan-inactive
app.post('/api/scan-inactive', async (req, res) => {
    const { startDate, endDate } = req.body;
    console.log(`Received Inactive Scan Request for ${startDate} to ${endDate}`);
    try {
        const changes = await scanForInactiveProjects(startDate, endDate);
        res.json({ success: true, changes });
    } catch (error) {
        console.error('Inactive Scan Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/execute - Executes selected changes
app.post('/api/execute', async (req, res) => {
    const { changes } = req.body; // Array of change objects
    console.log(`Received Execute Request for ${changes?.length} items`);
    
    if (!changes || !Array.isArray(changes)) {
        return res.status(400).json({ success: false, error: "Invalid changes array" });
    }

    try {
        const logs = await executeChanges(changes);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Execute Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mapping Endpoints ---
const MAPPINGS_FILE = path.join(__dirname, 'mappings.json');

app.get('/api/mappings', (req, res) => {
    try {
        if (fs.existsSync(MAPPINGS_FILE)) {
            const data = fs.readFileSync(MAPPINGS_FILE, 'utf8');
            res.json({ success: true, mappings: JSON.parse(data) });
        } else {
            res.json({ success: true, mappings: {} });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/mappings', (req, res) => {
    const { mappings } = req.body;
    try {
        fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Moco-Timing Sync Server running at http://localhost:${PORT}`);
});
