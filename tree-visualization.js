function initTreeVisualization(data, fuelFilter = null) {
    const containerId = "#tree-container";
    const container = document.querySelector(containerId);

    originalTreeData = data;
    d3.select(containerId).selectAll("*").remove();

    if (!container) return;

    let filteredData = data;
    if (typeof filterHierarchy === 'function') {
        filteredData = filterHierarchy(data, fuelFilter);
    }

    if (!filteredData.children || filteredData.children.length === 0) {
        let message = 'No processes found.';
        if (fuelFilter) {
            message = `No processes found with Fuel Coverage: ${fuelFilter}`;
        }
        container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500">${message}</div>`;
        setupTreeFilterListeners();
        return;
    }

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 800;
    const margin = { top: 20, right: 90, bottom: 30, left: 120 };

    const svg = d3.select(containerId)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height]);

    const zoomGroup = svg.append("g");
    const g = zoomGroup.append("g")
        .attr("transform", `translate(${margin.left},${height / 2})`);

    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            zoomGroup.attr("transform", event.transform);
        });

    svg.call(zoom);

    let i = 0;
    const duration = 750;
    let root;

    const treeMap = d3.tree().nodeSize([30, 200]);

    root = d3.hierarchy(filteredData, d => d.children);
    root.x0 = 0;
    root.y0 = 0;

    let selectedNode = root;

    function updateSelection(d) {
        selectedNode = d;
        g.selectAll('circle.node')
            .style("stroke", n => n === d ? "#f59e0b" : "white")
            .style("stroke-width", n => n === d ? "4px" : "2px");
    }

    d3.select(window).on("keydown.tree", (event) => {
        if (document.getElementById("tree-view").classList.contains("hidden")) return;
        if (!selectedNode) selectedNode = root;

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.key) > -1) {
            event.preventDefault();
        }

        switch (event.key) {
            case "ArrowLeft":
                if (selectedNode.children) {
                    collapse(selectedNode);
                    update(selectedNode);
                } else if (selectedNode.parent) {
                    updateSelection(selectedNode.parent);
                }
                break;
            case "ArrowRight":
                if (selectedNode._children) {
                    selectedNode.children = selectedNode._children;
                    selectedNode._children = null;
                    update(selectedNode);
                } else if (selectedNode.children) {
                    updateSelection(selectedNode.children[0]);
                }
                break;
            case "ArrowUp":
                if (selectedNode.parent) {
                    const siblings = selectedNode.parent.children;
                    if (siblings) {
                        const idx = siblings.indexOf(selectedNode);
                        if (idx > 0) updateSelection(siblings[idx - 1]);
                    }
                }
                break;
            case "ArrowDown":
                if (selectedNode.parent) {
                    const siblings = selectedNode.parent.children;
                    if (siblings) {
                        const idx = siblings.indexOf(selectedNode);
                        if (idx < siblings.length - 1) updateSelection(siblings[idx + 1]);
                    }
                }
                break;
            case "Enter":
                openDetails(selectedNode.data);
                break;
        }
    });

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    if (root && root.children) {
        root.children.forEach(d => {
            if (d.children && d.children.length > 0) {
                collapse(d);
            }
        });
    }

    window.focusProcessNode = function (processName) {
        function findNode(node, name) {
            if (node.data.name === name) return node;
            if (node.children) {
                for (let child of node.children) {
                    const found = findNode(child, name);
                    if (found) return found;
                }
            }
            if (node._children) {
                for (let child of node._children) {
                    const found = findNode(child, name);
                    if (found) return found;
                }
            }
            return null;
        }

        let targetNode = findNode(root, processName);
        if (!targetNode) return;

        let current = targetNode;
        while (current.parent) {
            if (current.parent._children) {
                current.parent.children = current.parent._children;
                current.parent._children = null;
            }
            current = current.parent;
        }

        update(root);

        const center = [width / 2, height / 2];
        const scale = 1.5;
        const x = -targetNode.y * scale + center[0] - margin.left * scale;
        const y = (height / 2) * (1 - scale) - (targetNode.x * scale);

        const transform = d3.zoomIdentity.translate(x, y).scale(scale);
        svg.transition().duration(750).call(zoom.transform, transform);
        updateSelection(targetNode);

        const nodeSelection = g.selectAll('g.node').filter(d => d.data.name === processName);
        nodeSelection.select('circle')
            .transition().duration(500).style("fill", "#ff0").attr("r", 12)
            .transition().duration(500)
            .style("fill", d => getNodeColor(d))
            .attr("r", 8);
    };

    function getNodeColor(d) {
        if (d.data.level === 'L1') return d._children ? "#1d4ed8" : "#3b82f6";
        if (d.data.level === 'L2') return d._children ? "#15803d" : "#22c55e";
        if (d.data.level === 'L3') return "#f97316";
        if (d.data.level === 'L4') return "#a855f7";
        return "#555";
    }

    update(root);

    function update(source) {
        const treeData = treeMap(root);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        nodes.forEach(d => {
            if (d.depth === 0) d.y = 0;
            else if (d.depth === 1) d.y = 200;
            else if (d.depth === 2) d.y = 450;
            else if (d.depth === 3) d.y = 750;
            else if (d.depth === 4) d.y = 1050;
            else d.y = 1050 + (d.depth - 4) * 300;
        });

        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on('click', click);

        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style("fill", d => getNodeColor(d))
            .style("stroke", "white")
            .style("stroke-width", "2px");

        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", d => d.depth === 0 ? -13 : 13)
            .attr("text-anchor", d => d.depth === 0 ? "end" : "start")
            .text(d => d.data.name)
            .style("font-size", "12px")
            .style("fill-opacity", 1e-6)
            .style("cursor", "pointer")
            .style("fill", "#000")
            .clone(true).lower()
            .attr("stroke", "white")
            .attr("stroke-width", 3);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle.node')
            .attr('r', 8)
            .style("fill", d => getNodeColor(d))
            .style("stroke", "white")
            .style("stroke-width", "2px");

        nodeUpdate.selectAll('text')
            .style("fill-opacity", 1)
            .style("fill", "#000");

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        const link = g.selectAll('path.link').data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-width", "1.5px")
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => diagonal(d, d.parent));

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        function diagonal(s, d) {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        }

        function click(event, d) {
            updateSelection(d);

            const isLeaf = d.data.level === 'L4' || (!d.children && !d._children);
            if (isLeaf) {
                openDetails(d.data);
            } else {
                if (d.children) {
                    d._children = d.children;
                    d._children.forEach(collapse);
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
            }

            update(d);
            event.stopPropagation();

            if (!isLeaf) {
                const scale = d3.zoomTransform(svg.node()).k;
                const targetX = (width * 0.25) - (margin.left * scale) - (d.y * scale);
                const targetY = (height / 2) * (1 - scale) - (d.x * scale);
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(scale));
            }
        }
    }

    window.treeRoot = root;
    window.treeUpdate = update;
    setupTreeFilterListeners();
}

let originalTreeData = null;

function setupTreeFilterListeners() {
    const fuelFilter = document.getElementById('tree-fuel-filter');

    if (fuelFilter && fuelFilter.dataset.listenerSetup !== 'true') {
        fuelFilter.dataset.listenerSetup = 'true';
        fuelFilter.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            window.currentFuelFilter = selectedValue === 'All' ? null : selectedValue;

            const navFuelFilter = document.getElementById('nav-fuel-filter');
            if (navFuelFilter) navFuelFilter.value = selectedValue;

            applyTreeFilters();
        });
    }
}

function applyTreeFilters() {
    if (originalTreeData || window.hierarchyData) {
        const dataToUse = originalTreeData || window.hierarchyData;
        let filteredData = dataToUse;
        if (typeof filterHierarchy === 'function') {
            filteredData = filterHierarchy(dataToUse, window.currentFuelFilter);
        }
        if (typeof updateProcessStatistics === 'function') {
            updateProcessStatistics(filteredData);
        }
        initTreeVisualization(dataToUse, window.currentFuelFilter);
    }
}

window.expandAllTreeNodes = function () {
    if (!window.treeRoot || !window.treeUpdate) return;

    function expandNode(node) {
        if (node._children) {
            node.children = node._children;
            node._children = null;
        }
        if (node.children) {
            node.children.forEach(expandNode);
        }
    }

    if (window.treeRoot.children) {
        window.treeRoot.children.forEach(expandNode);
    }
    window.treeUpdate(window.treeRoot);
};

window.collapseAllTreeNodes = function () {
    if (!window.treeRoot || !window.treeUpdate) return;

    function collapseNode(node) {
        if (node.children) {
            node._children = node.children;
            node._children.forEach(collapseNode);
            node.children = null;
        }
    }

    if (window.treeRoot.children) {
        window.treeRoot.children.forEach(collapseNode);
    }
    window.treeUpdate(window.treeRoot);
};
