/**
 * Parse dependencies from Connections.xlsx file
 * Maps Excel columns to flow graph structure:
 * - Source Process (Output Creator) -> Source Node ID
 * - Target Process (Input Consumer) -> Target Node ID
 * - Object (The Interface) -> Edge Label
 * - Value Stream/Category -> Node Group/Color
 * 
 * Returns: { flowNodes, flowEdges } - separate from hierarchy data
 */

/**
 * Parse the Connections.xlsx file and extract flow nodes and edges
 * @param {File|string} fileInput - Excel file (File object or file path)
 * @param {Map<string, {objective: string, use_case: string, it_release: string}>} l3DetailsMap - Optional map of L3 process names to their details for enrichment
 * @returns {Promise<{flowNodes: Array, flowEdges: Array}>} Parsed flow data
 */
async function parseDependencies(fileInput, l3DetailsMap = null) {
    try {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded. Please ensure the SheetJS library is included in your HTML.');
        }
        
        let workbook;
        
        // Handle File object (from file input) or file path
        if (fileInput instanceof File) {
            const arrayBuffer = await fileInput.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } else if (typeof fileInput === 'string') {
            // If it's a file path, we need to fetch it
            // Add cache-busting query parameter to ensure we get the latest version
            const cacheBuster = `?t=${Date.now()}`;
            const fileUrl = fileInput.includes('?') ? `${fileInput}&t=${Date.now()}` : `${fileInput}${cacheBuster}`;
            
            console.log(`Fetching Excel file: ${fileUrl} (with cache-busting)`);
            
            try {
                const response = await fetch(fileUrl, {
                    cache: 'no-store', // Prevent caching
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                if (!response.ok) {
                    // Check if we got HTML instead of Excel file (common 404 issue)
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('text/html')) {
                        throw new Error(`File not found. The server returned an HTML page instead of the Excel file. Please ensure:\n1. Connections.xlsx exists in the project root folder\n2. You are running a local web server (e.g., "python -m http.server" or "npx http-server")\n3. The file name is exactly "Connections.xlsx" (case-sensitive)`);
                    }
                    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}. Make sure Connections.xlsx is in the project folder and the web server is running.`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    throw new Error('File is empty or could not be read.');
                }
                
                // Check if the response is actually an Excel file
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('text/html')) {
                    throw new Error('Server returned HTML instead of Excel file. Make sure Connections.xlsx exists and is accessible via the web server.');
                }
                
                try {
                    workbook = XLSX.read(arrayBuffer, { type: 'array' });
                } catch (parseError) {
                    // Check if XLSX threw an error about invalid format
                    if (parseError.message && (parseError.message.includes('Invalid') || parseError.message.includes('could not find'))) {
                        // Try to detect if we got HTML instead
                        const textDecoder = new TextDecoder();
                        const text = textDecoder.decode(arrayBuffer.slice(0, 100));
                        if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                            throw new Error('Server returned HTML instead of Excel file. This usually means:\n1. Connections.xlsx file is not found (404 error)\n2. You need to run a local web server\n3. The file name must be exactly "Connections.xlsx" (case-sensitive)\n\nTo fix: Run "python -m http.server" in the project folder and access via http://localhost:8000/index.html');
                        }
                        throw new Error(`Invalid Excel file format: ${parseError.message}`);
                    }
                    throw parseError;
                }
            } catch (fetchError) {
                if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
                    throw new Error(`Could not load Connections.xlsx. Please ensure:\n1. The file is named "Connections.xlsx" (case-sensitive)\n2. The file is in the project root folder\n3. You are running a local web server (e.g., "python -m http.server" or "npx http-server")\n4. Access the app via http://localhost:PORT/index.html (not file://)`);
                }
                throw fetchError;
            }
        } else {
            throw new Error('Invalid file input. Expected File object or file path string.');
        }
        
        // Validate workbook was created
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Excel file appears to be empty or invalid. No worksheets found.');
        }
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        if (!worksheet) {
            throw new Error(`Worksheet "${firstSheetName}" not found in Excel file.`);
        }
        
        // Convert to JSON with header row
        const data = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '', // Default value for empty cells
            raw: false  // Return formatted strings
        });
        
        if (!data || data.length === 0) {
            throw new Error('Excel file is empty or has no data rows.');
        }
        
        // Find column mappings (handle variations in column names)
        const findColumn = (possibleNames, dataRow) => {
            for (const name of possibleNames) {
                if (dataRow.hasOwnProperty(name)) {
                    return name;
                }
            }
            return null;
        };
        
        // Get column names from first row
        const firstRow = data[0];
        const sourceCol = findColumn([
            'Source Process (Output Creator)',
            'Source Process',
            'Source Process (Output Creator)'
        ], firstRow);
        
        const targetCol = findColumn([
            'Target Process (Input Consumer)',
            'Target Process',
            'Target Process (Input Consumer)'
        ], firstRow);
        
        const objectCol = findColumn([
            'Object (The Interface)',
            'Object',
            'The Interface',
            'Interface'
        ], firstRow);
        
        const categoryCol = findColumn([
            'Value Stream/Category',
            'Value Stream',
            'Category',
            'Value Stream Category'
        ], firstRow);
        
        if (!sourceCol || !targetCol) {
            const availableColumns = Object.keys(firstRow).join(', ');
            throw new Error(`Required columns not found. Looking for "Source Process (Output Creator)" and "Target Process (Input Consumer)". Found columns: ${availableColumns || 'none'}`);
        }
        
        // Build nodes and edges
        const nodeMap = new Map(); // Track unique nodes by ID
        const edges = [];
        
        // Helper function to enrich node with L3 details if available
        const enrichNode = (processName, baseNode) => {
            if (l3DetailsMap && processName) {
                const normalizedName = String(processName).trim();
                // Try exact match first
                let details = l3DetailsMap.get(normalizedName);
                // If not found, try lowercase match
                if (!details) {
                    details = l3DetailsMap.get(normalizedName.toLowerCase());
                }
                // If found, merge details into node
                if (details) {
                    return {
                        ...baseNode,
                        objective: details.objective || '',
                        use_case: details.use_case || '',
                        it_release: details.it_release || ''
                    };
                }
            }
            return baseNode;
        };
        
        // Helper function to create or update a node
        const createOrUpdateNode = (processName, category) => {
            if (!processName) return;
            
            if (!nodeMap.has(processName)) {
                const baseNode = {
                    id: processName,
                    label: processName,
                    group: category || 'default',
                    level: 'L3' // All processes in this file are L3
                };
                nodeMap.set(processName, enrichNode(processName, baseNode));
            } else {
                // Update group if category is provided and different
                const node = nodeMap.get(processName);
                if (category && (!node.group || node.group === 'default')) {
                    node.group = category;
                }
                // Re-enrich in case L3 details map was updated
                const enrichedNode = enrichNode(processName, node);
                if (enrichedNode !== node) {
                    nodeMap.set(processName, enrichedNode);
                }
            }
        };
        
        data.forEach((row, index) => {
            const sourceProcess = String(row[sourceCol] || '').trim();
            const targetProcess = String(row[targetCol] || '').trim();
            const edgeLabel = objectCol ? String(row[objectCol] || '').trim() : '';
            const category = categoryCol ? String(row[categoryCol] || '').trim() : '';
            
            // Skip rows where both source and target are empty
            if (!sourceProcess && !targetProcess) {
                return;
            }
            
            // Handle isolated nodes: if only source exists, create isolated source node
            if (sourceProcess && !targetProcess) {
                createOrUpdateNode(sourceProcess, category);
                // No edge created for isolated node
                return;
            }
            
            // Handle isolated nodes: if only target exists, create isolated target node
            if (!sourceProcess && targetProcess) {
                createOrUpdateNode(targetProcess, category);
                // No edge created for isolated node
                return;
            }
            
            // Both source and target exist - create nodes and edge
            createOrUpdateNode(sourceProcess, category);
            createOrUpdateNode(targetProcess, category);
            
            // Create edge
            edges.push({
                source: sourceProcess,
                target: targetProcess,
                label: edgeLabel,
                id: `${sourceProcess}->${targetProcess}${edgeLabel ? `:${edgeLabel}` : ''}`,
                category: category || null
            });
        });
        
        // Convert node map to array
        const flowNodes = Array.from(nodeMap.values());
        
        return {
            flowNodes,
            flowEdges: edges
        };
        
    } catch (error) {
        console.error('Error parsing dependencies:', error);
        throw error;
    }
}

/**
 * Load dependencies from Connections.xlsx file in the project
 * @returns {Promise<{flowNodes: Array, flowEdges: Array}>} Parsed flow data
 */
async function loadDependencies() {
    // Try both capital and lowercase versions
    const fileNames = ['Connections.xlsx', 'connections.xlsx'];
    
    // Use global L3 details map if available
    const l3DetailsMap = window.l3DetailsMap || null;
    
    // Check if we're running via file:// protocol (which won't work)
    if (window.location.protocol === 'file:') {
        throw new Error('Cannot load Connections.xlsx via file:// protocol. Please run a web server:\n1. Open terminal in project folder\n2. Run: python -m http.server 8001\n3. Access via: http://localhost:8001/index.html');
    }
    
    for (const fileName of fileNames) {
        try {
            console.log(`Attempting to load ${fileName} from ${window.location.origin}`);
            return await parseDependencies(fileName, l3DetailsMap);
        } catch (error) {
            // If this is the last file name to try, throw the error with more context
            if (fileName === fileNames[fileNames.length - 1]) {
                const currentUrl = window.location.href;
                const errorMsg = error.message || String(error);
                throw new Error(`${errorMsg}\n\nCurrent URL: ${currentUrl}\nMake sure you're accessing via http://localhost:8001/index.html`);
            }
            // Otherwise, try the next file name
            console.warn(`Failed to load ${fileName}, trying alternative...`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDependencies, loadDependencies };
}

// Make available globally for browser use
window.parseDependencies = parseDependencies;
window.loadDependencies = loadDependencies;

