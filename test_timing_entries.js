require('dotenv').config();
const axios = require('axios');

const TIMING_API_KEY = process.env.TIMING_API_KEY;

const timingClient = axios.create({
    baseURL: 'https://web.timingapp.com/api/v1',
    headers: { 
        'Authorization': `Bearer ${TIMING_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

async function testFetch() {
    try {
        // Fetch 1 entry from last year to now to see structure
        const res = await timingClient.get('/time-entries', {
            params: {
                start: '2024-01-01T00:00:00Z',
                end: '2024-01-02T00:00:00Z',
                limit: 5
            }
        });
        console.log("Success! Found " + res.data.data.length + " entries.");
        if (res.data.data.length > 0) {
            console.log("Sample Entry:", JSON.stringify(res.data.data[0], null, 2));
        }
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error(e.response.data);
    }
}

testFetch();
