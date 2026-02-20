document.getElementById('search-input').addEventListener('input', (e) => {
    handleSearch(e.target.value);
});

function initSearchView(hierarchyData) {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
}

function refreshSearchView(hierarchyData) {
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value && searchInput.value.length >= 2) {
        handleSearch(searchInput.value);
    } else {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }
}

window.initSearchView = initSearchView;
window.refreshSearchView = refreshSearchView;

function handleSearch(query) {
    const resultsContainer = document.getElementById('search-results');

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    const lowerQuery = query.toLowerCase();

    const results = searchIndex.filter(item => {
        if (item.name && item.name.toLowerCase().includes(lowerQuery)) return true;
        if (item.path && item.path.toLowerCase().includes(lowerQuery)) return true;
        return false;
    });

    renderSearchResults(results);
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    const displayResults = results.slice(0, 50);

    displayResults.forEach(item => {
        const div = document.createElement('div');

        let badgeColor = 'bg-gray-100 text-gray-800';
        if (item.level === 'L1') badgeColor = 'bg-blue-100 text-blue-800';
        if (item.level === 'L2') badgeColor = 'bg-green-100 text-green-800';
        if (item.level === 'L3') badgeColor = 'bg-orange-100 text-orange-800';
        if (item.level === 'L4') badgeColor = 'bg-purple-100 text-purple-800';

        let badges = `<span class="px-2 py-0.5 text-xs rounded-full ${badgeColor}">${item.level}</span>`;
        if (item.level === 'L4' && item.fuel_coverage) {
            badges += `<span class="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">${item.fuel_coverage}</span>`;
        }

        let content = `
            <div>
                <div class="flex items-center space-x-2">
                    <h4 class="font-medium text-gray-900">${item.name}</h4>
                    ${badges}
                </div>
                <div class="text-xs text-gray-500 mt-1">${item.path || item.name}</div>
            </div>
            <div class="ml-4 flex-shrink-0 self-center">
                <button onclick="event.stopPropagation(); locateProcess('${item.name.replace(/'/g, "\\'")}')" class="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Locate ${item.name.replace(/'/g, "\\'")} in hierarchy" title="Locate in Hierarchy">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                </button>
            </div>
        `;

        div.className = 'bg-white p-4 rounded-lg shadow border border-gray-200 hover:bg-gray-50 cursor-pointer flex justify-between items-start';
        div.innerHTML = content;

        const processData = {
            name: item.name,
            level: item.level,
            parent: item.parent,
            path: item.path
        };
        if (item.level === 'L4') {
            processData.id = item.id;
            processData.fuel_coverage = item.fuel_coverage || 'Both';
        }

        div.onclick = () => openDetails(processData);

        container.appendChild(div);
    });

    if (displayResults.length === 0) {
        container.innerHTML = '<div class="text-gray-500 italic">No matching processes found.</div>';
    }
}
