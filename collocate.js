// collocate.js - Collocate Analysis Module

class CollocateModule {
    constructor() {
        this.collocates = [];
        this.searchTerm = '';
        this.windowSize = 5; // default window size
    }

    // Process files and find collocates
    async processFiles(files, searchTerm, minFrequency = 2, windowSize = 5) {
        this.searchTerm = searchTerm;
        this.windowSize = windowSize;
        this.collocates = [];

        const leftCollocates = new Map();
        const rightCollocates = new Map();
        let totalMatches = 0;

        console.log('Collocate: Processing files for term:', searchTerm);

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const result = this.findCollocates(content, searchTerm, windowSize);
                
                // Merge left collocates
                result.leftCollocates.forEach((freq, word) => {
                    leftCollocates.set(word, (leftCollocates.get(word) || 0) + freq);
                });

                // Merge right collocates
                result.rightCollocates.forEach((freq, word) => {
                    rightCollocates.set(word, (rightCollocates.get(word) || 0) + freq);
                });

                totalMatches += result.totalMatches;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        // Convert to sorted arrays
        const leftArray = this.sortCollocates(leftCollocates, minFrequency);
        const rightArray = this.sortCollocates(rightCollocates, minFrequency);

        this.collocates = {
            left: leftArray,
            right: rightArray,
            totalMatches: totalMatches
        };

        console.log('Collocate data:', this.collocates);

        return {
            collocates: this.collocates,
            searchTerm: searchTerm,
            windowSize: windowSize,
            totalMatches: totalMatches
        };
    }

    // Read file content
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    // Find collocates in content
    findCollocates(content, searchTerm, windowSize) {
        const leftCollocates = new Map();
        const rightCollocates = new Map();
        let totalMatches = 0;

        // Tokenize content
        const words = content.toLowerCase()
            .split(/\s+/)
            .map(w => w.replace(/[^\w\u0600-\u06FF'-]/g, ''))
            .filter(w => w.length > 0);

        const searchLower = searchTerm.toLowerCase();

        // Find search term positions
        words.forEach((word, index) => {
            if (word === searchLower || word.includes(searchLower)) {
                totalMatches++;

                // Get left context (preceding words)
                for (let i = 1; i <= windowSize; i++) {
                    const leftIndex = index - i;
                    if (leftIndex >= 0) {
                        const leftWord = words[leftIndex];
                        if (leftWord && leftWord.length > 2) {
                            leftCollocates.set(leftWord, (leftCollocates.get(leftWord) || 0) + 1);
                        }
                    }
                }

                // Get right context (following words)
                for (let i = 1; i <= windowSize; i++) {
                    const rightIndex = index + i;
                    if (rightIndex < words.length) {
                        const rightWord = words[rightIndex];
                        if (rightWord && rightWord.length > 2) {
                            rightCollocates.set(rightWord, (rightCollocates.get(rightWord) || 0) + 1);
                        }
                    }
                }
            }
        });

        return {
            leftCollocates,
            rightCollocates,
            totalMatches
        };
    }

    // Sort collocates by frequency
    sortCollocates(collocateMap, minFrequency) {
        return Array.from(collocateMap.entries())
            .filter(([_, freq]) => freq >= minFrequency)
            .map(([word, freq]) => ({ word, frequency: freq }))
            .sort((a, b) => b.frequency - a.frequency);
    }

    // Render collocate view
    render(containerElement, data) {
        if (!this.collocates.left.length && !this.collocates.right.length) {
            containerElement.innerHTML = `
                <div class="collocate-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">🔗</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No collocates found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try a different search term or lower the minimum frequency</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="collocate-container">
                <div class="collocate-header">
                    <h3>Collocate Analysis</h3>
                    <div class="collocate-stats">
                        <span class="stat-badge">Search Term: "${data.searchTerm}"</span>
                        <span class="stat-badge">Window: ±${data.windowSize}</span>
                        <span class="stat-badge">Matches: ${data.totalMatches}</span>
                    </div>
                </div>

                <div class="collocate-controls">
                    <button class="collocate-btn" onclick="collocateModule.changeWindow(3)">Window ±3</button>
                    <button class="collocate-btn" onclick="collocateModule.changeWindow(5)">Window ±5</button>
                    <button class="collocate-btn" onclick="collocateModule.changeWindow(10)">Window ±10</button>
                    <button class="collocate-btn" onclick="collocateModule.exportData()">📥 Export CSV</button>
                </div>

                <div class="collocate-info">
                    <div class="collocate-legend">
                        <h4>Understanding Collocates:</h4>
                        <p><strong>Left collocates:</strong> Words that appear BEFORE "${data.searchTerm}" within the window</p>
                        <p><strong>Right collocates:</strong> Words that appear AFTER "${data.searchTerm}" within the window</p>
                        <p><strong>Window size (±${data.windowSize}):</strong> Number of words on each side to analyze</p>
                        <p><strong>Frequency:</strong> How many times the word appears in the context</p>
                    </div>
                </div>

                <div class="collocate-content">
                    ${this.renderCollocateTables()}
                </div>
            </div>

            <style>
                .collocate-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .collocate-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .collocate-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .collocate-stats {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .stat-badge {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .collocate-controls {
                    padding: 16px 24px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #dee2e6;
                }

                .collocate-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .collocate-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .collocate-info {
                    padding: 20px 24px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                }

                .collocate-legend {
                    background: white;
                    padding: 16px;
                    border-radius: 6px;
                    border-left: 4px solid #667eea;
                }

                .collocate-legend h4 {
                    margin: 0 0 12px 0;
                    color: #495057;
                    font-size: 15px;
                }

                .collocate-legend p {
                    margin: 6px 0;
                    font-size: 13px;
                    color: #6c757d;
                }

                .collocate-content {
                    padding: 24px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }

                .collocate-side {
                    background: white;
                }

                .collocate-side-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #495057;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #dee2e6;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .collocate-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .collocate-table thead {
                    background: #f8f9fa;
                }

                .collocate-table th {
                    padding: 10px 12px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: 600;
                    color: #6c757d;
                    text-transform: uppercase;
                    border-bottom: 2px solid #dee2e6;
                }

                .collocate-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 13px;
                }

                .collocate-table tbody tr:hover {
                    background: #f8f9fa;
                }

                .collocate-rank {
                    width: 50px;
                    text-align: center;
                    font-weight: 600;
                    color: #6c757d;
                }

                .collocate-word {
                    font-weight: 600;
                    color: #495057;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                    direction: rtl;
                    text-align: right;
                }

                .collocate-frequency {
                    width: 80px;
                    text-align: center;
                    font-weight: 600;
                    color: #28a745;
                }

                .collocate-bar {
                    width: 100px;
                }

                .bar-container {
                    background: #e9ecef;
                    height: 6px;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .collocate-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                @media (max-width: 768px) {
                    .collocate-content {
                        grid-template-columns: 1fr;
                    }

                    .collocate-table {
                        font-size: 11px;
                    }

                    .collocate-table th,
                    .collocate-table td {
                        padding: 8px;
                    }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

    // Render collocate tables
    renderCollocateTables() {
        const leftTable = this.renderTable(this.collocates.left, 'left');
        const rightTable = this.renderTable(this.collocates.right, 'right');

        return `
            <div class="collocate-side">
                <div class="collocate-side-title">
                    ⬅️ Left Collocates (Before "${this.escapeHtml(this.searchTerm)}")
                </div>
                ${leftTable}
            </div>
            <div class="collocate-side">
                <div class="collocate-side-title">
                    ➡️ Right Collocates (After "${this.escapeHtml(this.searchTerm)}")
                </div>
                ${rightTable}
            </div>
        `;
    }

    // Render individual table
    renderTable(collocates, side) {
        if (collocates.length === 0) {
            return `<p style="color: #6c757d; font-size: 13px; padding: 20px; text-align: center;">No collocates found</p>`;
        }

        const maxFreq = Math.max(...collocates.map(c => c.frequency));

        const rows = collocates.slice(0, 50).map((item, index) => {
            const barWidth = (item.frequency / maxFreq) * 100;
            return `
                <tr>
                    <td class="collocate-rank">${index + 1}</td>
                    <td class="collocate-word">${this.escapeHtml(item.word)}</td>
                    <td class="collocate-frequency">${item.frequency}</td>
                    <td class="collocate-bar">
                        <div class="bar-container">
                            <div class="bar-fill" style="width: ${barWidth}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <table class="collocate-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Word</th>
                        <th>Frequency</th>
                        <th>Distribution</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    // Change window size
    async changeWindow(windowSize) {
        const container = document.getElementById('resultsArea');
        const minFreq = document.getElementById('minFreq') ? parseInt(document.getElementById('minFreq').value) : 2;
        const query = document.getElementById('searchQuery') ? document.getElementById('searchQuery').value : '';

        if (window.selectedFiles && window.selectedFiles.length > 0 && query) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
                    <div style="font-size: 16px; font-weight: 600;">Analyzing collocates with window ±${windowSize}...</div>
                </div>
            `;

            const data = await this.processFiles(window.selectedFiles, query, minFreq, windowSize);
            this.render(container, data);
        }
    }

    // Export to CSV
    exportData() {
        const csvRows = [
            ['Side', 'Rank', 'Word', 'Frequency'].join(',')
        ];

        this.collocates.left.forEach((item, index) => {
            csvRows.push([
                'Left',
                index + 1,
                `"${item.word.replace(/"/g, '""')}"`,
                item.frequency
            ].join(','));
        });

        this.collocates.right.forEach((item, index) => {
            csvRows.push([
                'Right',
                index + 1,
                `"${item.word.replace(/"/g, '""')}"`,
                item.frequency
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collocates_${this.searchTerm}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main application
const collocateModule = new CollocateModule();