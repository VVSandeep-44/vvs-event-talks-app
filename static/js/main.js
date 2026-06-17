// --- App State ---
let releases = [];
let filteredReleases = [];
let selectedIds = new Set();
let activeCategory = 'all';
let searchQuery = '';
let sortBy = 'newest';
let activeTemplate = 'standard';
let tempSingleTweetUpdate = null; // Stores update if single-tweeting without overriding selections

// Progress ring calculations
const MAX_TWEET_CHARS = 280;
const RING_DASHARRAY = 88; // 2 * PI * r = 2 * 3.14159 * 14 = ~87.96

// --- DOM Elements ---
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    categoryPills: document.getElementById('category-pills'),
    sortSelect: document.getElementById('sort-select'),
    resultsCount: document.getElementById('results-count'),
    notesGrid: document.getElementById('notes-grid'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    errorBanner: document.getElementById('error-banner'),
    errorMessage: document.getElementById('error-message'),
    errorCloseBtn: document.getElementById('error-close-btn'),
    feedLastUpdated: document.getElementById('feed-last-updated'),
    
    // Theme Switcher
    themeToggle: document.getElementById('theme-toggle'),
    themeIconMoon: document.getElementById('theme-icon-moon'),
    themeIconSun: document.getElementById('theme-icon-sun'),
    
    // Export CSV
    exportCsvBtn: document.getElementById('export-csv-btn'),
    
    // Selection Drawer
    selectionDrawer: document.getElementById('selection-drawer'),
    selectionCount: document.getElementById('selection-count'),
    clearSelectionBtn: document.getElementById('clear-selection-btn'),
    composeTweetBtn: document.getElementById('compose-tweet-btn'),
    
    // Tweet Modal
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    templatePills: document.querySelector('.template-pills'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    progressRingFill: document.getElementById('progress-ring-fill'),
    charCountText: document.getElementById('char-count-text'),
    submitTweetBtn: document.getElementById('submit-tweet-btn')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    fetchNotes(false);
});

// --- Event Listeners ---
function initEventListeners() {
    // Refresh Button
    elements.refreshBtn.addEventListener('click', () => {
        fetchNotes(true);
    });

    // Search Input
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
        filterAndRender();
    });

    // Clear Search Button
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.searchInput.focus();
        filterAndRender();
    });

    // Category Pills
    elements.categoryPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        // Remove active class from siblings
        elements.categoryPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        activeCategory = pill.dataset.category;
        filterAndRender();
    });

    // Sort Dropdown
    elements.sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        filterAndRender();
    });

    // Error Close Button
    elements.errorCloseBtn.addEventListener('click', () => {
        elements.errorBanner.style.display = 'none';
    });

    // Selection Drawer Actions
    elements.clearSelectionBtn.addEventListener('click', clearSelection);
    elements.composeTweetBtn.addEventListener('click', () => {
        tempSingleTweetUpdate = null; // Ensure we tweet the checked selections
        openTweetModal();
    });

    // Theme Toggle Actions
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Export CSV Actions
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Tweet Modal Actions
    elements.closeModalBtn.addEventListener('click', closeTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });

    // Template Pills Selection
    elements.templatePills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        
        elements.templatePills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        activeTemplate = pill.dataset.template;
        populateTweetText();
    });

    // Textarea character count listener
    elements.tweetTextarea.addEventListener('input', updateCharCount);

    // Share/Submit Tweet Button
    elements.submitTweetBtn.addEventListener('click', launchTwitterIntent);
}

// --- Data Fetching ---
async function fetchNotes(forceRefresh = false) {
    toggleLoading(true);
    elements.errorBanner.style.display = 'none';
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to parse releases.');
        }
        
        releases = data.updates;
        
        // Format last updated status text
        if (data.updated) {
            // Use local date string formatting if updated exists
            elements.feedLastUpdated.textContent = `Feed updated: ${data.updated}`;
        } else {
            elements.feedLastUpdated.textContent = `Feed checked: Just now`;
        }
        
        clearSelection();
        filterAndRender();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        elements.errorMessage.textContent = `Failed to fetch updates: ${error.message}`;
        elements.errorBanner.style.display = 'flex';
        toggleLoading(false);
    }
}

// --- Filtering & Sorting & Rendering ---
function filterAndRender() {
    // 1. Filter
    filteredReleases = releases.filter(note => {
        // Category Filter
        const matchesCategory = (activeCategory === 'all' || 
            note.category.toLowerCase() === activeCategory.toLowerCase());
        
        // Search Query Filter
        const matchesSearch = !searchQuery || 
            note.date.toLowerCase().includes(searchQuery) ||
            note.category.toLowerCase().includes(searchQuery) ||
            note.content_text.toLowerCase().includes(searchQuery);
            
        return matchesCategory && matchesSearch;
    });

    // 2. Sort
    filteredReleases.sort((a, b) => {
        const dateA = new Date(a.updated_iso || a.date);
        const dateB = new Date(b.updated_iso || b.date);
        
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // 3. Render
    renderGrid();
}

function renderGrid() {
    toggleLoading(false);
    
    if (filteredReleases.length === 0) {
        elements.notesGrid.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        elements.resultsCount.textContent = 'Showing 0 updates';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.notesGrid.style.display = 'grid';
    elements.resultsCount.textContent = `Showing ${filteredReleases.length} update${filteredReleases.length === 1 ? '' : 's'}`;
    
    elements.notesGrid.innerHTML = '';
    
    filteredReleases.forEach(note => {
        const isSelected = selectedIds.has(note.id);
        const categoryClass = getCategoryClass(note.category);
        
        const card = document.createElement('article');
        card.className = `note-card ${isSelected ? 'selected' : ''}`;
        card.dataset.id = note.id;
        
        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-meta">
                    <span class="badge badge-${categoryClass}">${note.category}</span>
                    <span class="note-date">${note.date}</span>
                </div>
                <label class="select-checkbox-container" title="Select this update">
                    <input type="checkbox" class="note-checkbox" data-id="${note.id}" ${isSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
            </div>
            <div class="note-card-body">
                ${note.content_html}
            </div>
            <div class="note-card-footer">
                <a href="${note.link}" class="source-link" target="_blank" rel="noopener noreferrer">
                    <span>Docs Source</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
                <div class="card-actions">
                    <button class="btn-card-copy" title="Copy text to clipboard">
                        <svg class="icon copy-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn-card-tweet" title="Tweet this update">
                        <svg class="icon twitter-svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            </div>
        `;
        
        // Attach Card Interaction Events
        // 1. Click anywhere on card (except links, buttons, checkbox wrappers) triggers selection toggle
        card.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('.btn-card-tweet') || e.target.closest('.btn-card-copy') || e.target.closest('.select-checkbox-container')) {
                return;
            }
            toggleCardSelection(note.id);
        });
        
        // 2. Direct Checkbox Toggle
        const checkbox = card.querySelector('.note-checkbox');
        checkbox.addEventListener('change', () => {
            toggleCardSelection(note.id);
        });
        
        // 3. Single Tweet Button Action
        const tweetBtn = card.querySelector('.btn-card-tweet');
        tweetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tempSingleTweetUpdate = note;
            openTweetModal(note);
        });

        // 4. Copy Button Action
        const copyBtn = card.querySelector('.btn-card-copy');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(note.content_text, copyBtn);
        });
        
        elements.notesGrid.appendChild(card);
    });
}

// --- Selection Management ---
function toggleCardSelection(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    
    // Update card DOM state directly instead of full re-render for smooth experience
    const card = elements.notesGrid.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
        const checkbox = card.querySelector('.note-checkbox');
        if (selectedIds.has(id)) {
            card.classList.add('selected');
            checkbox.checked = true;
        } else {
            card.classList.remove('selected');
            checkbox.checked = false;
        }
    }
    
    updateSelectionDrawer();
}

function updateSelectionDrawer() {
    const count = selectedIds.size;
    elements.selectionCount.textContent = `${count} Selected`;
    
    if (count > 0) {
        elements.selectionDrawer.classList.add('active');
    } else {
        elements.selectionDrawer.classList.remove('active');
    }
}

function clearSelection() {
    selectedIds.clear();
    // Uncheck all boxes
    elements.notesGrid.querySelectorAll('.note-card').forEach(card => {
        card.classList.remove('selected');
        const cb = card.querySelector('.note-checkbox');
        if (cb) cb.checked = false;
    });
    updateSelectionDrawer();
}

// --- Tweet Modal Logic ---
function openTweetModal(singleNote = null) {
    // Force active template to standard when opening
    activeTemplate = 'standard';
    elements.templatePills.querySelectorAll('.pill').forEach(pill => {
        if (pill.dataset.template === 'standard') pill.classList.add('active');
        else pill.classList.remove('active');
    });
    
    populateTweetText();
    elements.tweetModal.style.display = 'flex';
    // Small delay to trigger CSS transition
    setTimeout(() => {
        elements.tweetModal.classList.add('active');
    }, 10);
    elements.tweetTextarea.focus();
}

function closeTweetModal() {
    elements.tweetModal.classList.remove('active');
    setTimeout(() => {
        elements.tweetModal.style.display = 'none';
        tempSingleTweetUpdate = null; // Clear single reference
    }, 250);
}

function getSelectedNotes() {
    if (tempSingleTweetUpdate) {
        return [tempSingleTweetUpdate];
    }
    
    // Convert selectedIds set to notes objects
    return releases.filter(n => selectedIds.has(n.id));
}

function populateTweetText() {
    const selectedNotes = getSelectedNotes();
    if (selectedNotes.length === 0) {
        elements.tweetTextarea.value = '';
        updateCharCount();
        return;
    }
    
    let tweetText = '';
    
    if (selectedNotes.length === 1) {
        const note = selectedNotes[0];
        // Clean double spaces and restrict length
        const bodyText = note.content_text;
        
        if (activeTemplate === 'standard') {
            tweetText = `📢 BigQuery Release Note (${note.date})\n\n[${note.category}] ${bodyText}\n\nRead more: ${note.link} #BigQuery`;
        } else if (activeTemplate === 'minimal') {
            tweetText = `BigQuery Update [${note.category}]: ${bodyText} ${note.link} #BigQuery`;
        } else if (activeTemplate === 'bullet') {
            tweetText = `🚀 Google Cloud BigQuery Release Update\n📅 Date: ${note.date}\n🏷️ Type: ${note.category}\n\n📝 Details:\n• ${bodyText}\n\nDocumentation: ${note.link} #GoogleCloud`;
        }
    } else {
        // Multi-notes selected
        if (activeTemplate === 'standard') {
            tweetText = `📢 Latest BigQuery Releases (${selectedNotes.length} updates):\n\n`;
            selectedNotes.forEach((note, idx) => {
                // Short bullet format
                tweetText += `• [${note.category}] ${note.content_text}\n`;
            });
            // Append single link at the end (using link of the first selected item as reference)
            tweetText += `\nRead details: ${selectedNotes[0].link} #BigQuery`;
        } else if (activeTemplate === 'minimal') {
            tweetText = `BigQuery Updates: `;
            selectedNotes.forEach((note, idx) => {
                tweetText += `[${note.category}] ${note.date}; `;
            });
            tweetText += `More info: ${selectedNotes[0].link} #BigQuery`;
        } else if (activeTemplate === 'bullet') {
            tweetText = `🚀 BigQuery Updates Summary (${selectedNotes.length} new updates):\n\n`;
            selectedNotes.forEach((note) => {
                tweetText += `📅 ${note.date} | [${note.category}]\n• ${note.content_text}\n\n`;
            });
            tweetText += `Full Release Notes: ${selectedNotes[0].link} #GoogleCloud`;
        }
    }
    
    // Auto-truncate content_text if it exceeds the limit (smart padding)
    elements.tweetTextarea.value = truncateTweetSmartly(tweetText, selectedNotes);
    updateCharCount();
}

function truncateTweetSmartly(fullText, selectedNotes) {
    if (fullText.length <= MAX_TWEET_CHARS) return fullText;
    
    // If it's a single update, we can truncate the description text to make it fit
    if (selectedNotes.length === 1) {
        const note = selectedNotes[0];
        const bodyText = note.content_text;
        
        // Calculate overhead characters (tags, title, link, headers)
        let overhead = 0;
        if (activeTemplate === 'standard') {
            overhead = `📢 BigQuery Release Note (${note.date})\n\n[${note.category}] \n\nRead more: ${note.link} #BigQuery`.length + 5;
        } else if (activeTemplate === 'minimal') {
            overhead = `BigQuery Update [${note.category}]:  ${note.link} #BigQuery`.length + 5;
        } else if (activeTemplate === 'bullet') {
            overhead = `🚀 Google Cloud BigQuery Release Update\n📅 Date: ${note.date}\n🏷️ Type: ${note.category}\n\n📝 Details:\n• \n\nDocumentation: ${note.link} #GoogleCloud`.length + 5;
        }
        
        const maxBodyLen = MAX_TWEET_CHARS - overhead;
        if (maxBodyLen > 30) {
            const truncatedBody = bodyText.substring(0, maxBodyLen) + '...';
            if (activeTemplate === 'standard') {
                return `📢 BigQuery Release Note (${note.date})\n\n[${note.category}] ${truncatedBody}\n\nRead more: ${note.link} #BigQuery`;
            } else if (activeTemplate === 'minimal') {
                return `BigQuery Update [${note.category}]: ${truncatedBody} ${note.link} #BigQuery`;
            } else if (activeTemplate === 'bullet') {
                return `🚀 Google Cloud BigQuery Release Update\n📅 Date: ${note.date}\n🏷️ Type: ${note.category}\n\n📝 Details:\n• ${truncatedBody}\n\nDocumentation: ${note.link} #GoogleCloud`;
            }
        }
    } else {
        // Multi-updates truncation: list fewer bullet points or shorten bullet points
        let header = '';
        let footer = `\nRead details: ${selectedNotes[0].link} #BigQuery`;
        
        if (activeTemplate === 'standard') {
            header = `📢 Latest BigQuery Releases:\n\n`;
        } else if (activeTemplate === 'minimal') {
            header = `BigQuery Updates: `;
            footer = ` More info: ${selectedNotes[0].link} #BigQuery`;
        } else if (activeTemplate === 'bullet') {
            header = `🚀 BigQuery Updates Summary:\n\n`;
            footer = `\nFull Release Notes: ${selectedNotes[0].link} #GoogleCloud`;
        }
        
        let availableChars = MAX_TWEET_CHARS - header.length - footer.length;
        let bulletsText = '';
        
        for (let i = 0; i < selectedNotes.length; i++) {
            const note = selectedNotes[i];
            let itemText = '';
            
            if (activeTemplate === 'standard' || activeTemplate === 'bullet') {
                itemText = `• [${note.category}] ${note.content_text}\n`;
            } else {
                itemText = `[${note.category}] ${note.date}; `;
            }
            
            if (bulletsText.length + itemText.length > availableChars - 10) {
                // If it can't fit, add generic more indicators and stop
                bulletsText += `• ... and ${selectedNotes.length - i} more updates.\n`;
                break;
            }
            bulletsText += itemText;
        }
        
        return header + bulletsText + footer;
    }
    
    // Fallback: simple hard-truncation
    return fullText.substring(0, MAX_TWEET_CHARS - 3) + '...';
}

function updateCharCount() {
    const text = elements.tweetTextarea.value;
    const charCount = text.length;
    const remaining = MAX_TWEET_CHARS - charCount;
    
    // Update count text
    elements.charCountText.textContent = remaining;
    
    // Update Progress Ring Color & Thickness
    const percentage = Math.min(charCount / MAX_TWEET_CHARS, 1);
    const strokeDashoffset = RING_DASHARRAY * (1 - percentage);
    elements.progressRingFill.style.strokeDashoffset = strokeDashoffset;
    
    // Colors and warnings
    elements.charCountText.className = 'char-count-text';
    if (remaining < 0) {
        elements.charCountText.classList.add('danger');
        elements.progressRingFill.style.stroke = 'var(--color-issue)'; // Red
        elements.submitTweetBtn.disabled = true;
    } else if (remaining <= 20) {
        elements.charCountText.classList.add('warn');
        elements.progressRingFill.style.stroke = 'var(--color-deprecated)'; // Amber
        elements.submitTweetBtn.disabled = false;
    } else {
        elements.progressRingFill.style.stroke = 'var(--primary)'; // Cyan
        elements.submitTweetBtn.disabled = false;
    }
}

function launchTwitterIntent() {
    const text = elements.tweetTextarea.value;
    if (text.length > MAX_TWEET_CHARS) {
        alert('Tweet is too long! Please shorten it before posting.');
        return;
    }
    
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
}

// --- Helper Functions ---
function toggleLoading(isLoading) {
    if (isLoading) {
        elements.loadingState.style.display = 'flex';
        elements.notesGrid.style.display = 'none';
        elements.emptyState.style.display = 'none';
        elements.refreshIcon.classList.add('spinning');
        elements.refreshBtn.disabled = true;
    } else {
        elements.loadingState.style.display = 'none';
        elements.refreshIcon.classList.remove('spinning');
        elements.refreshBtn.disabled = false;
    }
}

function getCategoryClass(category) {
    const cat = category.toLowerCase();
    if (cat.includes('feature')) return 'feature';
    if (cat.includes('change') || cat.includes('improvement')) return 'change';
    if (cat.includes('issue') || cat.includes('bug')) return 'issue';
    if (cat.includes('fix')) return 'fix';
    if (cat.includes('announcement') || cat.includes('notice')) return 'announcement';
    if (cat.includes('deprecated') || cat.includes('deprecation')) return 'deprecated';
    return 'general';
}

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        if (elements.themeIconMoon) elements.themeIconMoon.style.display = 'none';
        if (elements.themeIconSun) elements.themeIconSun.style.display = 'block';
    } else {
        document.documentElement.classList.remove('light-theme');
        if (elements.themeIconMoon) elements.themeIconMoon.style.display = 'block';
        if (elements.themeIconSun) elements.themeIconSun.style.display = 'none';
    }
}

function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    if (isLight) {
        if (elements.themeIconMoon) elements.themeIconMoon.style.display = 'none';
        if (elements.themeIconSun) elements.themeIconSun.style.display = 'block';
    } else {
        if (elements.themeIconMoon) elements.themeIconMoon.style.display = 'block';
        if (elements.themeIconSun) elements.themeIconSun.style.display = 'none';
    }
}

// --- Copy to Clipboard ---
function copyToClipboard(text, buttonElement) {
    if (!navigator.clipboard) {
        // Fallback for older browsers or non-HTTPS
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            showCopyFeedback(buttonElement);
        } catch (err) {
            console.error('Fallback: Unable to copy', err);
        }
        document.body.removeChild(textarea);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback(buttonElement);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

function showCopyFeedback(btn) {
    const span = btn.querySelector('span');
    const originalText = span.textContent;
    
    span.textContent = 'Copied!';
    btn.style.color = 'var(--primary)';
    
    setTimeout(() => {
        span.textContent = originalText;
        btn.style.color = '';
    }, 1500);
}

// --- Export CSV ---
function exportToCSV() {
    if (filteredReleases.length === 0) {
        alert('No updates available to export.');
        return;
    }
    
    // Setup headers
    const headers = ['Date', 'Category', 'Update Link', 'Content'];
    
    // Parse rows
    const rows = filteredReleases.map(note => [
        note.date,
        note.category,
        note.link,
        note.content_text
    ]);
    
    // Construct CSV content
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(value => {
            // Escape double quotes and wrap in quotes
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(','))
    ].join('\r\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
