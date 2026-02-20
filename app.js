// SDGE AMI 2.0 Process Hierarchy Viewer - Global State
window.hierarchyData = null;
window.searchIndex = null;
let currentView = 'navigation';
window.currentFuelFilter = null;

function showLoading() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) indicator.classList.remove('hidden');
}

function hideLoading() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) indicator.classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => closeError(), 5000);
    }
}

function closeError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.classList.add('hidden');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const button = document.getElementById('mobile-menu-btn');
    if (menu && button) {
        const isHidden = menu.classList.contains('hidden');
        menu.classList.toggle('hidden');
        button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    }
}

window.toggleMobileMenu = toggleMobileMenu;

// Fuel Coverage Filter - filters L4 leaf nodes by fuel_coverage
function filterHierarchyByFuelCoverage(data, fuelValue) {
    if (!fuelValue || fuelValue === 'All' || fuelValue === '') {
        return data;
    }

    function filterNode(node) {
        const filteredNode = { ...node };

        if (node.level === 'L4') {
            const fuel = node.fuel_coverage || 'Both';
            return fuel === fuelValue ? filteredNode : null;
        }

        if (node.children && node.children.length > 0) {
            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter(child => child !== null);

            if (filteredChildren.length > 0) {
                filteredNode.children = filteredChildren;
                return filteredNode;
            }
        }

        return null;
    }

    const filteredData = filterNode(data);
    if (!filteredData || !filteredData.children || filteredData.children.length === 0) {
        return { name: data.name || "Process Hierarchy", children: [] };
    }
    return filteredData;
}

function filterHierarchy(data, fuelValue) {
    return filterHierarchyByFuelCoverage(data, fuelValue);
}

function countProcesses(data) {
    let l1Count = 0, l2Count = 0, l3Count = 0, l4Count = 0;

    function countNode(node) {
        if (node.level === 'L1') {
            l1Count++;
            (node.children || []).forEach(countNode);
        } else if (node.level === 'L2') {
            l2Count++;
            (node.children || []).forEach(countNode);
        } else if (node.level === 'L3') {
            l3Count++;
            (node.children || []).forEach(countNode);
        } else if (node.level === 'L4') {
            l4Count++;
        }
    }

    if (data && data.children) {
        data.children.forEach(countNode);
    }
    return { l1Count, l2Count, l3Count, l4Count };
}

function updateProcessStatistics(data) {
    const counts = countProcesses(data);
    ['l1', 'l2', 'l3', 'l4'].forEach(level => {
        const el = document.getElementById(`${level}-count`);
        if (el && el.querySelector('span')) {
            el.querySelector('span').textContent = counts[`${level}Count`];
        }
    });
}

function getProcessId(processData) {
    if (processData.level === 'L4' && processData.id != null) {
        return `L4_${processData.id}`;
    }
    return `${processData.level}_${processData.name}`;
}

window.getProcessId = getProcessId;

function switchView(viewName) {
    currentView = viewName;

    document.querySelectorAll('header button[id$="-view-btn"]').forEach(btn => {
        if (btn.id === `${viewName}-view-btn`) {
            btn.classList.remove('text-gray-700', 'bg-gray-50', 'hover:bg-gray-50');
            btn.classList.add('text-white', 'bg-blue-600', 'hover:bg-blue-700');
        } else {
            btn.classList.remove('text-white', 'bg-blue-600', 'hover:bg-blue-700');
            btn.classList.add('text-gray-700', 'bg-gray-50', 'hover:bg-gray-50');
        }
    });

    document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));
    const viewEl = document.getElementById(`${viewName}-view`);
    if (viewEl) viewEl.classList.remove('hidden');

    const navFuelFilter = document.getElementById('nav-fuel-filter');
    const treeFuelFilter = document.getElementById('tree-fuel-filter');
    if (navFuelFilter) navFuelFilter.value = window.currentFuelFilter || 'All';
    if (treeFuelFilter) treeFuelFilter.value = window.currentFuelFilter || 'All';

    if (viewName === 'navigation' && hierarchyData) {
        initNavigationView(hierarchyData, window.currentFuelFilter);
        const filteredData = filterHierarchy(hierarchyData, window.currentFuelFilter);
        updateProcessStatistics(filteredData);
    } else if (viewName === 'tree' && hierarchyData) {
        initTreeVisualization(hierarchyData, window.currentFuelFilter);
        const filteredData = filterHierarchy(hierarchyData, window.currentFuelFilter);
        updateProcessStatistics(filteredData);
    } else if (viewName === 'search' && typeof initSearchView === 'function' && hierarchyData) {
        initSearchView(hierarchyData);
    }
}

window.switchView = switchView;

function getFullPath(processData) {
    const idx = searchIndex.findIndex(item => item.name === processData.name && item.level === processData.level);
    if (idx >= 0 && searchIndex[idx].path) {
        return searchIndex[idx].path;
    }
    return processData.name;
}

function openDetails(processData) {
    const panel = document.getElementById('details-panel');
    const content = document.getElementById('details-content');

    if (!panel || !content) return;

    const fullPath = getFullPath(processData);

    let levelClass = 'bg-gray-100 text-gray-800';
    if (processData.level === 'L1') levelClass = 'bg-blue-100 text-blue-800';
    else if (processData.level === 'L2') levelClass = 'bg-green-100 text-green-800';
    else if (processData.level === 'L3') levelClass = 'bg-orange-100 text-orange-800';
    else if (processData.level === 'L4') levelClass = 'bg-purple-100 text-purple-800';

    let html = `
        <div class="mb-4">
            <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full ${levelClass}">${processData.level || 'Process'}</span>
        </div>
        <h3 class="text-2xl font-bold text-gray-800 mb-4">${processData.name}</h3>
        <div class="space-y-4">
            <div>
                <h4 class="font-semibold text-gray-700">Full Path</h4>
                <p class="text-gray-600 mt-1">${fullPath}</p>
            </div>
    `;

    if (processData.level === 'L4') {
        html += `
            <div>
                <h4 class="font-semibold text-gray-700">ID</h4>
                <p class="text-gray-600 mt-1">${processData.id != null ? processData.id : 'N/A'}</p>
            </div>
            <div>
                <h4 class="font-semibold text-gray-700">Fuel Coverage</h4>
                <p class="text-gray-600 mt-1">${processData.fuel_coverage || 'Both'}</p>
            </div>
        `;
    }

    html += `
        </div>
        <div class="mt-6 pt-6 border-t border-gray-200">
            <button onclick="locateProcess('${String(processData.name).replace(/'/g, "\\'")}')" class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[44px]">
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                </svg>
                Locate in Hierarchy
            </button>
        </div>
    `;

    content.innerHTML = html;
    panel.classList.remove('translate-x-full', 'hidden');
    panel.classList.add('translate-x-0');
    panel.style.display = 'block';
}

window.openDetails = openDetails;

function closeDetails() {
    const panel = document.getElementById('details-panel');
    if (panel) {
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
    }
}

window.locateProcess = function(processName) {
    switchView('tree');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        toggleMobileMenu();
    }
    setTimeout(() => {
        if (window.focusProcessNode) {
            window.focusProcessNode(processName);
        }
    }, 200);
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading();

        const [hierarchyRes, searchRes] = await Promise.all([
            fetch('hierarchy-data.json'),
            fetch('search-index.json')
        ]);

        if (!hierarchyRes.ok || !searchRes.ok) {
            throw new Error('Failed to load data files');
        }

        hierarchyData = await hierarchyRes.json();
        searchIndex = await searchRes.json();

        updateProcessStatistics(hierarchyData);
        initNavigationView(hierarchyData, null);
        switchView('navigation');

        hideLoading();
    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showError('Error loading data. Please run the conversion script (python convert_sdge_excel.py) and ensure hierarchy-data.json and search-index.json exist.');
    }

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
});

window.showError = showError;
window.closeError = closeError;
window.filterHierarchyByFuelCoverage = filterHierarchyByFuelCoverage;
window.filterHierarchy = filterHierarchy;
