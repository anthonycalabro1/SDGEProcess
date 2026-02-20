let currentNavData = null;
let navHistory = [];
let originalNavData = null;

function initNavigationView(data, fuelFilter = null) {
    originalNavData = data;

    let filteredData = data;
    if (typeof filterHierarchy === 'function') {
        filteredData = filterHierarchy(data, fuelFilter);
    }

    navHistory = [{ name: "All Processes", data: filteredData }];
    renderNavigationView(filteredData);
    setupNavFilterListeners();
}

function setupNavFilterListeners() {
    const fuelFilter = document.getElementById('nav-fuel-filter');

    if (fuelFilter && fuelFilter.dataset.listenerSetup !== 'true') {
        fuelFilter.dataset.listenerSetup = 'true';
        fuelFilter.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            window.currentFuelFilter = selectedValue === 'All' ? null : selectedValue;

            const treeFuelFilter = document.getElementById('tree-fuel-filter');
            if (treeFuelFilter) treeFuelFilter.value = selectedValue;

            applyNavFilters();
        });
    }
}

function applyNavFilters() {
    if (originalNavData && typeof filterHierarchy === 'function') {
        const filteredData = filterHierarchy(originalNavData, window.currentFuelFilter);

        if (typeof updateProcessStatistics === 'function') {
            updateProcessStatistics(filteredData);
        }

        navHistory = [{ name: "All Processes", data: filteredData }];
        renderNavigationView(filteredData);
    }
}

function renderNavigationView(nodeData) {
    currentNavData = nodeData;
    const container = document.getElementById('nav-list');
    const breadcrumbs = document.getElementById('breadcrumbs');

    if (!container) return;

    container.innerHTML = '';
    renderBreadcrumbs();

    if (!nodeData) {
        container.innerHTML = '<div class="p-4 text-gray-500">No data available.</div>';
        return;
    }

    if (!nodeData.children) {
        container.innerHTML = '<div class="p-4 text-gray-500">No child processes found.</div>';
        return;
    }

    const visibleChildren = nodeData.children || [];

    if (visibleChildren.length === 0) {
        let filterMessage = 'No child processes found.';
        if (window.currentFuelFilter) {
            filterMessage = `No processes found with Fuel Coverage: ${window.currentFuelFilter}`;
        }
        container.innerHTML = `<div class="p-4 text-gray-500">${filterMessage}</div>`;
        return;
    }

    visibleChildren.forEach(child => {
        const card = document.createElement('div');

        let levelClass = '';
        let levelLabel = '';

        if (child.level === 'L1') {
            levelClass = 'border-l-4 border-blue-500';
            levelLabel = 'Level 1';
        } else if (child.level === 'L2') {
            levelClass = 'border-l-4 border-green-500';
            levelLabel = 'Level 2';
        } else if (child.level === 'L3') {
            levelClass = 'border-l-4 border-orange-500';
            levelLabel = 'Level 3';
        } else if (child.level === 'L4') {
            levelClass = 'border-l-4 border-purple-500';
            levelLabel = 'Level 4';
        }

        let badges = `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${levelLabel}</span>`;
        if (child.level === 'L4' && child.fuel_coverage) {
            badges += `<span class="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">${child.fuel_coverage}</span>`;
        }

        card.className = `bg-white p-4 md:p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200 ${levelClass} min-h-[60px]`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${child.name}, ${levelLabel}`);

        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900">${child.name}</h3>
                <div class="flex items-center space-x-2">${badges}</div>
            </div>
        `;

        card.onclick = () => handleNavClick(child);
        card.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavClick(child);
            }
        };

        container.appendChild(card);
    });
}

function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    if (!container) return;

    container.innerHTML = '';
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Breadcrumb');

    navHistory.forEach((item, index) => {
        const isLast = index === navHistory.length - 1;

        if (isLast) {
            const span = document.createElement('span');
            span.className = 'font-bold text-gray-800';
            span.innerText = item.name;
            span.setAttribute('aria-current', 'page');
            container.appendChild(span);
        } else {
            const link = document.createElement('button');
            link.className = 'hover:text-blue-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded px-1 min-h-[44px]';
            link.innerText = item.name;
            link.onclick = () => navigateToHistory(index);
            link.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateToHistory(index);
                }
            };
            container.appendChild(link);

            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.innerText = '>';
            container.appendChild(separator);
        }
    });
}

function handleNavClick(childNode) {
    if (childNode.level === 'L4') {
        openDetails(childNode);
    } else {
        navHistory.push({ name: childNode.name, data: childNode });
        renderNavigationView(childNode);
    }
}

function navigateToHistory(index) {
    navHistory = navHistory.slice(0, index + 1);
    const targetItem = navHistory[index];
    renderNavigationView(targetItem.data);
}
