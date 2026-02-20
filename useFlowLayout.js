/**
 * Flow Layout Engine using ELK (Eclipse Layout Kernel)
 * Configures ELK for Process Flow visualization with:
 * - Algorithm: layered
 * - Direction: RIGHT (Left-to-Right flow)
 * - Edge Routing: ORTHOGONAL (Right angles, circuit-board style)
 * - Increased node separation to prevent clutter
 */

// Import ELK (will be available via CDN or bundler)
let ELK;

// Initialize ELK - supports both browser (CDN) and Node.js (npm)
async function initializeELK() {
    if (typeof window !== 'undefined' && window.ELK) {
        // Browser with CDN - ELK is available as a class
        ELK = new window.ELK();
        return ELK;
    } else if (typeof require !== 'undefined') {
        // Node.js
        const elkjs = require('elkjs');
        ELK = new elkjs.default();
        return ELK;
    } else {
        // Wait a bit for CDN to load if not immediately available
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const checkELK = setInterval(() => {
                attempts++;
                if (typeof window !== 'undefined' && window.ELK) {
                    clearInterval(checkELK);
                    ELK = new window.ELK();
                    resolve(ELK);
                } else if (attempts > 50) { // 5 seconds max wait
                    clearInterval(checkELK);
                    reject(new Error('ELK not found. Please include elkjs via CDN or npm.'));
                }
            }, 100);
        });
    }
}

/**
 * Convert flow nodes and edges to ELK graph format
 * @param {Array} flowNodes - Array of flow nodes
 * @param {Array} flowEdges - Array of flow edges
 * @returns {Object} ELK graph structure
 */
function convertToELKGraph(flowNodes, flowEdges) {
    // Create node map for quick lookup
    const nodeMap = new Map();
    flowNodes.forEach(node => {
        nodeMap.set(node.id, node);
    });
    
    // Convert nodes to ELK format
    const elkNodes = flowNodes.map(node => ({
        id: node.id,
        width: 150,  // Default width - can be customized based on label length
        height: 60,  // Default height
        labels: [{
            text: node.label || node.id,
            width: 150,
            height: 60
        }],
        // Store original node data for later retrieval
        _original: node
    }));
    
    // Convert edges to ELK format
    const elkEdges = flowEdges.map(edge => ({
        id: edge.id || `${edge.source}->${edge.target}`,
        sources: [edge.source],
        targets: [edge.target],
        labels: edge.label ? [{
            text: edge.label,
            width: edge.label.length * 8, // Approximate width
            height: 20
        }] : [],
        // Store original edge data
        _original: edge
    }));
    
    return {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.spacing.nodeNode': '80',  // Increased horizontal spacing
            'elk.spacing.edgeNode': '40',  // Spacing between edges and nodes
            'elk.spacing.edgeEdge': '20',  // Spacing between parallel edges
            'elk.spacing.nodeNodeBetweenLayers': '100', // Increased vertical spacing between layers
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            'elk.layered.spacing.edgeNodeBetweenLayers': '40',
            'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
            'elk.layered.spacing.edgeNode': '40',
            'elk.layered.spacing.nodeNode': '80',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.layered.cycleBreaking.strategy': 'GREEDY',
            'elk.layered.direction': 'RIGHT',
            'elk.insideSelfLoops.activate': 'true',
            'elk.portAlignment.basic': 'JUSTIFIED'
        },
        children: elkNodes,
        edges: elkEdges
    };
}

/**
 * Calculate node dimensions based on label length
 * @param {Object} node - Flow node
 * @returns {Object} Width and height
 */
function calculateNodeDimensions(node) {
    const label = node.label || node.id;
    const minWidth = 120;
    const minHeight = 50;
    const charWidth = 8; // Approximate character width
    const lineHeight = 20;
    const padding = 20;
    
    // Estimate width based on label length
    const estimatedWidth = Math.max(minWidth, label.length * charWidth + padding);
    
    // Estimate height (assuming single line for now, can be extended for multi-line)
    const estimatedHeight = Math.max(minHeight, lineHeight + padding);
    
    return {
        width: estimatedWidth,
        height: estimatedHeight
    };
}

/**
 * Apply layout to flow nodes and edges using ELK
 * @param {Array} flowNodes - Array of flow nodes
 * @param {Array} flowEdges - Array of flow edges
 * @returns {Promise<{nodes: Array, edges: Array}>} Positioned nodes and edges
 */
async function useFlowLayout(flowNodes, flowEdges) {
    try {
        // Initialize ELK if not already done
        if (!ELK) {
            await initializeELK();
        }
        
        // Calculate node dimensions
        const nodesWithDimensions = flowNodes.map(node => {
            const dims = calculateNodeDimensions(node);
            return {
                ...node,
                width: dims.width,
                height: dims.height
            };
        });
        
        // Convert to ELK graph format
        const elkGraph = convertToELKGraph(nodesWithDimensions, flowEdges);
        
        // Run ELK layout
        const laidOutGraph = await ELK.layout(elkGraph);
        
        // Extract positioned nodes
        const positionedNodes = laidOutGraph.children.map(elkNode => {
            const originalNode = elkNode._original || flowNodes.find(n => n.id === elkNode.id);
            return {
                ...originalNode,
                x: elkNode.x || 0,
                y: elkNode.y || 0,
                width: elkNode.width,
                height: elkNode.height,
                // Store layout information
                _layout: {
                    x: elkNode.x,
                    y: elkNode.y,
                    width: elkNode.width,
                    height: elkNode.height
                }
            };
        });
        
        // Extract positioned edges with routing points
        const positionedEdges = laidOutGraph.edges.map(elkEdge => {
            // Find the original edge - try to match by ID first, then by source/target
            let originalEdge = elkEdge._original;
            if (!originalEdge) {
                // Try to find by matching source/target (in either direction to handle potential swaps)
                originalEdge = flowEdges.find(e => 
                    (e.source === elkEdge.sources[0] && e.target === elkEdge.targets[0]) ||
                    (e.source === elkEdge.targets[0] && e.target === elkEdge.sources[0])
                );
            }
            
            if (!originalEdge) {
                console.warn('Could not find original edge for ELK edge:', elkEdge);
                // Create a fallback edge
                originalEdge = {
                    source: elkEdge.sources[0],
                    target: elkEdge.targets[0],
                    label: '',
                    id: elkEdge.id
                };
            }
            
            // CRITICAL: Always use the original edge's source/target to preserve direction from Excel
            // ELK might swap them for layout purposes, but we need to maintain the original direction
            const preservedSource = originalEdge.source;
            const preservedTarget = originalEdge.target;
            
            // Verify ELK's source/target match our original (log warning if swapped)
            if (preservedSource !== elkEdge.sources[0] || preservedTarget !== elkEdge.targets[0]) {
                console.warn(`Edge direction mismatch detected for edge ${originalEdge.id || 'unknown'}:`, {
                    original: `${preservedSource} -> ${preservedTarget}`,
                    elk: `${elkEdge.sources[0]} -> ${elkEdge.targets[0]}`
                });
            }
            
            // Extract routing information from ELK sections
            // Each section has startPoint, endPoint, and optional bendPoints
            const sections = elkEdge.sections || [];
            const routingInfo = sections.map(section => ({
                startPoint: section.startPoint || null,
                endPoint: section.endPoint || null,
                bendPoints: section.bendPoints || []
            }));
            
            return {
                ...originalEdge,
                source: preservedSource, // ALWAYS use original source from Excel
                target: preservedTarget, // ALWAYS use original target from Excel
                // Store routing information for drawing
                _routing: {
                    sections: routingInfo,
                    // Flatten bend points for backward compatibility
                    points: routingInfo.flatMap(r => r.bendPoints || [])
                },
                // Store label position if available
                _labelPosition: elkEdge.labels?.[0] ? {
                    x: elkEdge.labels[0].x,
                    y: elkEdge.labels[0].y
                } : null
            };
        });
        
        return {
            nodes: positionedNodes,
            edges: positionedEdges,
            // Store graph bounds for viewport calculations
            bounds: {
                x: laidOutGraph.x || 0,
                y: laidOutGraph.y || 0,
                width: laidOutGraph.width || 0,
                height: laidOutGraph.height || 0
            }
        };
        
    } catch (error) {
        console.error('Error in flow layout:', error);
        throw error;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { useFlowLayout, initializeELK };
}

// Make available globally for browser use
window.useFlowLayout = useFlowLayout;
window.initializeELK = initializeELK;

