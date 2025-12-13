require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const MOCO_DOMAIN = process.env.MOCO_DOMAIN;
const MOCO_API_KEY = process.env.MOCO_API_KEY;
const TIMING_API_KEY = process.env.TIMING_API_KEY;

if (!MOCO_DOMAIN || !MOCO_API_KEY || !TIMING_API_KEY) {
    console.error('Missing credentials in .env file');
    process.exit(1);
}

// --- Moco Client ---
const mocoClient = axios.create({
    baseURL: `https://${MOCO_DOMAIN}.mocoapp.com/api/v1`,
    headers: { 'Authorization': `Token token=${MOCO_API_KEY}` }
});

async function getMocoProjects() {
    try {
        const response = await mocoClient.get('/projects');
        return response.data;
    } catch (error) {
        console.error('Error fetching Moco projects:', error.message);
        throw error;
    }
}

// --- Timing Client ---
const timingClient = axios.create({
    baseURL: 'https://web.timingapp.com/api/v1',
    headers: { 
        'Authorization': `Bearer ${TIMING_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

async function getTimingHierarchy() {
    try {
        const response = await timingClient.get('/projects/hierarchy');
        return response.data; 
    } catch (error) {
        console.error('Error fetching Timing hierarchy:', error.message);
        throw error;
    }
}

// --- Logger Class ---
class Logger {
    constructor() {
        this.logs = [];
    }
    log(message) {
        console.log(message);
        this.logs.push({ type: 'info', message, timestamp: new Date().toISOString() });
    }
    error(message, details = null) {
        console.error(message, details || '');
        this.logs.push({ type: 'error', message, details, timestamp: new Date().toISOString() });
    }
    getLogs() {
        return this.logs;
    }
}

// --- Mappings ---
function loadMappings() {
    try {
        const mappingPath = path.join(__dirname, 'mappings.json');
        if (fs.existsSync(mappingPath)) {
            return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        }
    } catch (e) {
        console.error("Error loading mappings:", e.message);
    }
    return {};
}

// --- Sync Change Types ---
const CHANGE_TYPE = {
    CREATE: 'create',
    ARCHIVE: 'archive',
    LINK: 'link',       // New: Associate existing via ID
    RENAME: 'rename'    // New: Update name
};

// --- Main Logic: Scan ---
async function scanForChanges() {
    const changes = [];
    const mappings = loadMappings();
    
    // 1. Fetch Data
    const mocoProjects = await getMocoProjects();
    const timingHierarchy = await getTimingHierarchy();
    const timingFlat = flattenTimingProjects(timingHierarchy);

    // 2. Index Timing Projects
    const timingById = new Map();   // Key: MocoID (string) -> Node
    const timingByName = new Map(); // Key: Title (string) -> Node
    
    for (const t of timingFlat) {
        if (t.mocoId) timingById.set(String(t.mocoId), t);
        // Note: Timing allows duplicate names, we just take the first one or ignore?
        // Ideally unique names within parent scope. For flat map, we might clash.
        // Let's rely on FullPath/Self matching if needed, but here global name matching is our legacy fallback.
        // To be safe, let's map by "Customer/Project" key if possible?
        // Simplify: Map by Title. If duplicates, we might get false matches. limiting scope.
        timingByName.set(t.title, t); // simple map
    }

    // 3. Process Moco Projects
    const mocoProcessedIds = new Set();

    // Group Moco by Customer for easier iteration
    const mocoByCustomer = new Map();
    for (const p of mocoProjects) {
        let cName = p.customer.name.trim();
        if (mappings[cName]) cName = mappings[cName];
        if (!mocoByCustomer.has(cName)) mocoByCustomer.set(cName, []);
        mocoByCustomer.get(cName).push(p);
    }

    // A. Check Customers & Projects
    for (const [customerName, projects] of mocoByCustomer) {
        // Find Timing Customer Folder
        // We assume Customer Folders don't strictly need IDs (optional), but could have them.
        // Fallback to name matching for folders usually.
        let customerNode = timingFlat.find(t => t.title === customerName && t.parentSelf === null);

        if (!customerNode) {
             changes.push({
                id: `create-cust-${customerName}`,
                type: CHANGE_TYPE.CREATE,
                title: customerName,
                customer: customerName, 
                isCustomerFolder: true,
                reason: 'Customer folder missing',
                payload: { title: customerName, parentId: null }
            });
            // Mock for children
            customerNode = { id: 'pending', self: 'pending' };
        } else {
            // Customer exists. We *could* Link it if we wanted to track Customer IDs too inside notes.
            // But usually projects are the moving parts. 
        }

        for (const p of projects) {
            const pName = p.name.trim(); // Target Name
            const pId = String(p.id);    // Moco ID
            mocoProcessedIds.add(pId);

            // 1. Try finding by ID
            let match = timingById.get(pId);
            
            if (match) {
                // Found linked project. Check Name.
                if (match.title !== pName) {
                    changes.push({
                        id: `rename-${pId}`,
                        type: CHANGE_TYPE.RENAME,
                        title: `${match.title} ➔ ${pName}`,
                        customer: customerName,
                        reason: 'Name changed in Moco',
                        payload: { 
                            selfPath: match.self, 
                            title: pName,
                            oldTitle: match.title
                        }
                    });
                }
                // Also check if it's under correct customer? (Move logic) - defer.
            } else {
                // 2. Not found by ID. Try finding by Name (Legacy/Link mode)
                // We need to look for a project named 'pName' under 'customerNode'
                // But timingByName is global.
                // Let's search in flat list for correct parent.
                let nameMatch = null;
                if (customerNode.self !== 'pending') {
                    nameMatch = timingFlat.find(t => t.title === pName && t.parentSelf === customerNode.self);
                }

                if (nameMatch) {
                    // Found by name, but ID missing (or different? if different, we likely shouldn't touch it to avoid collisions, but here we assume missing)
                    if (!nameMatch.mocoId) {
                         changes.push({
                            id: `link-${pId}`,
                            type: CHANGE_TYPE.LINK,
                            title: pName,
                            customer: customerName,
                            reason: 'Link existing project (add Moco ID)',
                            payload: { 
                                selfPath: nameMatch.self, 
                                mocoId: pId,
                                currentNotes: nameMatch.original.notes || '' 
                            }
                        });
                    } else {
                        // Name matched, but it has A DIFFERENT ID?
                        // This implies Moco ID A renamed to 'Foo', and Timing 'Foo' is linked to ID B?
                        // Rare conflict. Treat as 'Create' (duplicate name warning?)
                        // For now, assume Create.
                         changes.push({
                            id: `create-proj-${pId}`,
                            type: CHANGE_TYPE.CREATE,
                            title: pName,
                            customer: customerName,
                            isCustomerFolder: false,
                            reason: 'Project missing (Name collision with other ID)',
                            payload: { title: pName, parentCustomerName: customerName, mocoId: pId }
                        });
                    }
                } else {
                    // 3. Not found by ID or Name -> Create
                    changes.push({
                        id: `create-proj-${customerName}-${pName}`,
                        type: CHANGE_TYPE.CREATE,
                        title: pName,
                        customer: customerName,
                        isCustomerFolder: false,
                        reason: 'New Project',
                        payload: { title: pName, parentCustomerName: customerName, mocoId: pId }
                    });
                }
            }
        }
    }

    // 4. Archives (Items in Timing with ID that are NOT in Moco Processed List)
    // We only archive if we are SURE it was synced (has ID).
    // If it has NO ID, we use the old logic (Unmapped/Name-based check) or ignore?
    // User wants "Archive". 
    // Hybrid approach:
    // If ID exists AND not in Moco -> Archive.
    // If ID missing: default to old logic (if under matched customer, and not in Moco list by name) -> Archive.
    
    for (const tNode of timingFlat) {
        if (tNode.parentSelf !== null && !tNode.original.is_archived) {
            
            // Case A: Has ID, but ID not in current Moco List
            if (tNode.mocoId && !mocoProcessedIds.has(String(tNode.mocoId))) {
                 changes.push({
                    id: `archive-id-${tNode.id}`,
                    type: CHANGE_TYPE.ARCHIVE,
                    title: tNode.title,
                    customer: 'Existing',
                    reason: 'Project removed from Moco',
                    payload: { selfPath: tNode.self, title: tNode.title }
                });
                continue;
            }

            // Case B: No ID. Check Name/Parent logic (Legacy Archive)
            if (!tNode.mocoId) {
                const parent = timingFlat.find(p => p.self === tNode.parentSelf);
                if (parent && parent.parentSelf === null) { // is project
                    const cName = parent.title; // Timing Customer Name
                    // Reverse Lookup? 
                    // This is hard because we mapped Moco->Timing names.
                    // We need to check if 'cName' corresponds to any Moco Customer.
                    // If so, does that Moco Customer contain 'tNode.title'?
                    // Simplified: Check if any Moco Customer (mapped) == cName.
                    
                    const mocoProjectsForCust = mocoByCustomer.get(cName);
                    // If we found a group for this customer name
                    if (mocoProjectsForCust) {
                        // Check if ANY project in this group has name == tNode.title
                        const hasNameMatch = mocoProjectsForCust.some(p => p.name.trim() === tNode.title);
                        if (!hasNameMatch) {
                             changes.push({
                                id: `archive-legacy-${tNode.id}`,
                                type: CHANGE_TYPE.ARCHIVE,
                                title: tNode.title,
                                customer: cName,
                                reason: 'Legacy Project not in Moco',
                                payload: { selfPath: tNode.self, title: tNode.title }
                            });
                        }
                    }
                }
            }
        }
    }

    return changes;
}

// --- Main Logic: Execute ---
async function executeChanges(changesToExecute) {
    const logger = new Logger();
    logger.log(`Starting Sync Execution... (${changesToExecute.length} items)`);

    let timingHierarchy = await getTimingHierarchy();
    let timingFlat = flattenTimingProjects(timingHierarchy);

    async function getCustomerId(name) {
        // Refresh flat list finding? Or just use current state?
        // Using scan state is safer if we create folders on the fly.
        // We push created folders to timingFlat.
        const node = timingFlat.find(t => t.title === name && t.parentSelf === null);
        return node ? node.id : null;
    }

    const sortedChanges = changesToExecute.sort((a, b) => {
        // Customer Folders first
        if (a.isCustomerFolder && !b.isCustomerFolder) return -1;
        if (!a.isCustomerFolder && b.isCustomerFolder) return 1;
        return 0;
    });

    for (const change of sortedChanges) {
        try {
            if (change.type === CHANGE_TYPE.CREATE) {
                if (change.isCustomerFolder) {
                    const existingId = await getCustomerId(change.title);
                    if (!existingId) {
                        logger.log(`Creating Customer Folder: ${change.title}`);
                        const newNode = await createTimingProject(change.title, null, null, false, logger);
                        if (newNode) {
                             const self = newNode.self || newNode.data?.self;
                             const id = self.split('/').pop();
                             timingFlat.push({ title: change.title, self: self, id: id, parentSelf: null });
                        }
                    }
                } else {
                    const customerName = change.customer;
                    let parentId = await getCustomerId(customerName);
                    if (!parentId) {
                        logger.error(`Skipping "${change.title}": Parent ${customerName} not found.`);
                        continue;
                    }
                    
                    logger.log(`Creating Project: ${change.title} (ID: ${change.payload.mocoId})`);
                    await createTimingProject(change.title, parentId, change.payload.mocoId, false, logger);
                }
            } 
            else if (change.type === CHANGE_TYPE.LINK) {
                logger.log(`Linking Project: ${change.title} => ID ${change.payload.mocoId}`);
                await updateTimingProject(change.payload.selfPath, { 
                    notes: (change.payload.currentNotes + `\nMOCO_ID:${change.payload.mocoId}`).trim() 
                }, false, logger);
            }
            else if (change.type === CHANGE_TYPE.RENAME) {
                logger.log(`Renaming: ${change.payload.oldTitle} -> ${change.payload.title}`);
                await updateTimingProject(change.payload.selfPath, { title: change.payload.title }, false, logger);
            }
            else if (change.type === CHANGE_TYPE.ARCHIVE) {
                logger.log(`Archiving: ${change.payload.title}`);
                await archiveTimingProject(change.payload.selfPath, change.payload.title, false, logger);
            }
        } catch (err) {
            logger.error(`Failed ${change.id}: ${err.message}`);
        }
    }
    
    logger.log("Execution Complete.");
    return logger.getLogs();
}

// --- Helper Functions ---

// Flatten & Extract IDs
function flattenTimingProjects(hierarchyData) {
    const nodes = hierarchyData.data || [];
    const flat = [];

    function recurse(list, parentSelf) {
        for (const node of list) {
            // Extract ID from notes
            let mocoId = null;
            if (node.notes) {
                const match = node.notes.match(/MOCO_ID:(\d+)/);
                if (match) mocoId = match[1];
            }

            flat.push({
                self: node.self, 
                id: node.self.split('/').pop(), 
                title: node.title.trim(),
                parentSelf: parentSelf,
                original: node,
                mocoId: mocoId
            });
            if (node.children && node.children.length > 0) {
                recurse(node.children, node.self);
            }
        }
    }
    recurse(nodes, null);
    return flat;
}

async function createTimingProject(title, parentShortId, mocoId, isDryRun, logger) {
    if (isDryRun) {
        logger.log(`[DRY RUN] Create "${title}"`);
        return { self: 'mock' };
    }
    try {
        const payload = { title: title, is_archived: false };
        if (parentShortId) payload.parent = `/projects/${parentShortId}`;
        if (mocoId) payload.notes = `MOCO_ID:${mocoId}`;

        const response = await timingClient.post('/projects', payload);
        return response.data;
    } catch (error) {
        logger.error(`Error create "${title}": ${error.message}`);
        return null;
    }
}

async function updateTimingProject(selfPath, data, isDryRun, logger) {
    if (isDryRun) {
        logger.log(`[DRY RUN] Update ${selfPath}: ${JSON.stringify(data)}`);
        return;
    }
    try {
        await timingClient.put(selfPath, data);
    } catch (error) {
        logger.error(`Error updating ${selfPath}: ${error.message}`);
    }
}

async function archiveTimingProject(selfPath, title, isDryRun, logger) {
    if (isDryRun) {
        logger.log(`[DRY RUN] Archive "${title}"`);
        return;
    }
    try {
        await timingClient.put(selfPath, { is_archived: true });
    } catch (error) {
        logger.error(`Error archiving project "${title}": ${error.message}`);
    }
}

// --- Inactive Cleanup Logic ---
async function scanForInactiveProjects(startDateStr, endDateStr) {
    const changes = [];
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    // 1. Fetch Data
    const timingHierarchy = await getTimingHierarchy();
    const timingFlat = flattenTimingProjects(timingHierarchy);
    const timeEntries = await getAllTimeEntries(startDate, endDate);

    // 2. Identify Active IDs (Projects that HAVE time logged)
    const activeProjectIds = new Set();
    timeEntries.forEach(entry => {
        if (entry.project && entry.project.self) {
            activeProjectIds.add(entry.project.self.split('/').pop());
        }
    });

    // 3. Find Inactive Projects
    for (const tNode of timingFlat) {
        if (tNode.parentSelf !== null && !tNode.original.is_archived) {
            // Check if this project uses ID
            if (!activeProjectIds.has(tNode.id)) {
                changes.push({
                    id: `inactive-${tNode.id}`,
                    type: CHANGE_TYPE.ARCHIVE,
                    title: tNode.title,
                    customer: 'Existing', 
                    reason: `No time logged between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}`,
                    payload: { selfPath: tNode.self, title: tNode.title }
                });
            }
        }
    }
    return changes;
}

async function getAllTimeEntries(startDate, endDate) {
    const entries = [];
    let url = '/time-entries';
    let params = {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        limit: 100
    };
    
    // Pagination loop
    while (true) {
        try {
            const res = await timingClient.get(url, { params });
            const data = res.data.data;
            entries.push(...data);
            
            if (res.data.links && res.data.links.next) {
                const nextUrl = res.data.links.next;
                if (!nextUrl) break;
                if (entries.length > 5000) break; // Safety Check
                
                const nextObj = new URL(nextUrl);
                url = nextObj.pathname.replace('/api/v1', '');
                params = Object.fromEntries(nextObj.searchParams);
            } else {
                break;
            }
        } catch (e) {
            console.error("Error fetching time entries:", e.message);
            break;
        }
    }
    return entries;
}

module.exports = { scanForChanges, executeChanges, scanForInactiveProjects };
