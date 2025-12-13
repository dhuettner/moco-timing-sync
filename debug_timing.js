require('dotenv').config();
const axios = require('axios');

const TIMING_API_KEY = process.env.TIMING_API_KEY;

const timingClient = axios.create({
    baseURL: 'https://web.timingapp.com/api/v1',
    headers: { 
        'Authorization': `Bearer ${TIMING_API_KEY}`,
        'Accept': 'application/json'
    }
});

async function run() {
    console.log("Fetching Timing Hierarchy...");
    try {
        const res = await timingClient.get('/projects/hierarchy');
        const rootNodes = res.data.data;
        
        console.log(`Found ${rootNodes.length} root items.`);
        
        const targetName = "KAOS/Carbunus Werbeagentur GmbH";
        console.log(`Searching for: "${targetName}"`);

        // Recursive search
        function findNode(nodes, depth=0) {
            for (const node of nodes) {
                const prefix = "  ".repeat(depth);
                
                // Check match
                if (node.title === targetName) {
                    console.log(`${prefix}[MATCH FOUND] "${node.title}" (ID: ${node.self})`);
                    console.log(`${prefix}  -> Is Root? ${depth === 0}`);
                    console.log(`${prefix}  -> Archived? ${node.is_archived}`);
                }
                
                // Fuzzy check
                if (node.title.includes("KAOS") || node.title.includes("Carbunus")) {
                     console.log(`${prefix}[Partial Match] "${node.title}"`);
                }

                if (node.children?.length) {
                    findNode(node.children, depth + 1);
                }
            }
        }
        
        findNode(rootNodes);

    } catch (e) {
        console.error(e);
    }
}

run();
