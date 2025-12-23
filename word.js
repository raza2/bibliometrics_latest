// word.js - Word List & Keyword Analysis Module

class WordModule {
    constructor() {
        this.wordList = [];
        this.keywords = [];
        this.currentMode = 'word'; // 'word' or 'keyword'
    }

    // Process files for word list
    async processFiles(files, searchTerm = '', minFrequency = 1) {
        const wordMap = new Map();
        let totalWords = 0;

        console.log('Word: Processing files for word list');

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const words = this.tokenize(content);
                
                words.forEach(word => {
                    const cleaned = this.cleanWord(word);
                    if (this.isValidWord(cleaned)) {
                        wordMap.set(cleaned, (wordMap.get(cleaned) || 0) + 1);
                        totalWords++;
                    }
                });
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        this.wordList = Array.from(wordMap.entries())
            .filter(([_, freq]) => freq >= minFrequency)
            .map(([word, freq]) => ({
                word: word,
                frequency: freq,
                percentage: ((freq / totalWords) * 100).toFixed(3)
            }))
            .sort((a, b) => b.frequency - a.frequency);

        console.log('Word: Generated', this.wordList.length, 'unique words');

        return {
            wordList: this.wordList,
            totalWords: totalWords,
            uniqueWords: this.wordList.length
        };
    }

    // Process files for keyword extraction (comparing target vs reference corpus)
    async processKeywords(targetFiles, referenceFiles, minFrequency = 2) {
        console.log('Keyword: Processing target and reference corpora');

        // Get word frequencies from target corpus
        const targetMap = await this.getWordFrequencies(targetFiles);
        const targetTotal = Array.from(targetMap.values()).reduce((sum, freq) => sum + freq, 0);

        // Get word frequencies from reference corpus
        const referenceMap = await this.getWordFrequencies(referenceFiles);
        const referenceTotal = Array.from(referenceMap.values()).reduce((sum, freq) => sum + freq, 0);

        // Calculate keyness scores
        this.keywords = [];
        const allWords = new Set([...targetMap.keys(), ...referenceMap.keys()]);

        allWords.forEach(word => {
            const targetFreq = targetMap.get(word) || 0;
            const refFreq = referenceMap.get(word) || 0;

            if (targetFreq >= minFrequency) {
                // Calculate relative frequency (per 1000 words)
                const targetRelFreq = (targetFreq / targetTotal) * 1000;
                const refRelFreq = (refFreq / referenceTotal) * 1000;

                // Simple keyness score (log-likelihood ratio approximation)
                const keyness = this.calculateKeyness(targetFreq, targetTotal, refFreq, referenceTotal);

                this.keywords.push({
                    word: word,
                    targetFreq: targetFreq,
                    refFreq: refFreq,
                    keyness: keyness,
                    targetRelFreq: targetRelFreq.toFixed(2),
                    refRelFreq: refRelFreq.toFixed(2)
                });
            }
        });

        // Sort by keyness score
        this.keywords.sort((a, b) => b.keyness - a.keyness);

        console.log('Keyword: Generated', this.keywords.length, 'keywords');

        return {
            keywords: this.keywords,
            targetTotal: targetTotal,
            referenceTotal: referenceTotal
        };
    }

    // Get word frequencies from files
    async getWordFrequencies(files) {
        const wordMap = new Map();

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const words = this.tokenize(content);
                
                words.forEach(word => {
                    const cleaned = this.cleanWord(word);
                    if (this.isValidWord(cleaned)) {
                        wordMap.set(cleaned, (wordMap.get(cleaned) || 0) + 1);
                    }
                });
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        return wordMap;
    }

    // Calculate keyness using log-likelihood
    calculateKeyness(o1, n1, o2, n2) {
        const e1 = n1 * (o1 + o2) / (n1 + n2);
        const e2 = n2 * (o1 + o2) / (n1 + n2);

        if (e1 === 0 || e2 === 0) return 0;

        const g2 = 2 * ((o1 * Math.log(o1 / e1)) + (o2 * Math.log(o2 / e2)));
        return isNaN(g2) ? 0 : g2;
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

    // Tokenize content
    tokenize(content) {
        return content.split(/\s+/).filter(w => w.length > 0);
    }

    // Clean word
    cleanWord(word) {
        return word.replace(/[^\w\u0600-\u06FF'-]/g, '').toLowerCase();
    }

    // Check if word is valid
    isValidWord(word) {
        if (!word || word.length < 2) return false;
        if (/^\d+$/.test(word)) return false;
        return true;
    }

    // Render word list view
    renderWordList(containerElement, data) {
        if (this.wordList.length === 0) {
            containerElement.innerHTML = `
                <div class="word-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">📝</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No words found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try adjusting the minimum frequency</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="word-container">
                <div class="word-header">
                    <h3>Word List</h3>
                    <div class="word-stats">
                        <span class="stat-badge">Unique Words: ${data.uniqueWords}</span>
                        <span class="stat-badge">Total Words: ${data.totalWords.toLocaleString()}</span>
                    </div>
                </div>

                <div class="word-controls">
                    <button class="word-btn" onclick="wordModule.exportWordList()">📥 Export CSV</button>
                    <button class="word-btn" onclick="wordModule.sortBy('alphabetical')">🔤 Sort A-Z</button>
                    <button class="word-btn" onclick="wordModule.sortBy('frequency')">🔢 Sort by Frequency</button>
                </div>

                <div class="word-table-wrapper">
                    ${this.renderWordTable()}
                </div>
            </div>

            ${this.getStyles()}
        `;

        containerElement.innerHTML = html;
    }

    // Render keyword view
    renderKeywordList(containerElement, data) {
        if (this.keywords.length === 0) {
            containerElement.innerHTML = `
                <div class="word-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">🔑</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No keywords found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Upload both target and reference corpus files</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="word-container">
                <div class="word-header">
                    <h3>Keyword Analysis</h3>
                    <div class="word-stats">
                        <span class="stat-badge">Keywords: ${this.keywords.length}</span>
                        <span class="stat-badge">Target: ${data.targetTotal.toLocaleString()} words</span>
                        <span class="stat-badge">Reference: ${data.referenceTotal.toLocaleString()} words</span>
                    </div>
                </div>

                <div class="word-controls">
                    <button class="word-btn" onclick="wordModule.exportKeywords()">📥 Export CSV</button>
                    <button class="word-btn" onclick="wordModule.filterPositive()">➕ Positive Keywords</button>
                    <button class="word-btn" onclick="wordModule.filterNegative()">➖ Negative Keywords</button>
                </div>

                <div class="word-info">
                    <div class="word-legend">
                        <h4>Understanding Keywords:</h4>
                        <p><strong>Keyness Score:</strong> Statistical measure of how characteristic a word is to the target corpus</p>
                        <p><strong>Positive Keywords:</strong> Words that appear more frequently in target corpus</p>
                        <p><strong>Negative Keywords:</strong> Words that appear more frequently in reference corpus</p>
                        <p><strong>Relative Frequency:</strong> Frequency per 1000 words (normalized)</p>
                    </div>
                </div>

                <div class="word-table-wrapper">
                    ${this.renderKeywordTable()}
                </div>
            </div>

            ${this.getStyles()}
        `;

        containerElement.innerHTML = html;
    }

    // Render word table
    renderWordTable() {
        const rows = this.wordList.slice(0, 500).map((item, index) => `
            <tr>
                <td class="word-rank">${index + 1}</td>
                <td class="word-text">${this.escapeHtml(item.word)}</td>
                <td class="word-frequency">${item.frequency}</td>
                <td class="word-percentage">${item.percentage}%</td>
            </tr>
        `).join('');

        return `
            <table class="word-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Word</th>
                        <th>Frequency</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    // Render keyword table
    renderKeywordTable() {
        const rows = this.keywords.slice(0, 200).map((item, index) => {
            const isPositive = item.targetRelFreq > item.refRelFreq;
            const keynessColor = isPositive ? '#28a745' : '#dc3545';
            
            return `
                <tr>
                    <td class="word-rank">${index + 1}</td>
                    <td class="word-text">${this.escapeHtml(item.word)}</td>
                    <td class="word-keyness" style="color: ${keynessColor}; font-weight: 700;">${item.keyness.toFixed(2)}</td>
                    <td class="word-frequency">${item.targetFreq}</td>
                    <td class="word-frequency">${item.refFreq}</td>
                    <td class="word-percentage">${item.targetRelFreq}</td>
                    <td class="word-percentage">${item.refRelFreq}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="word-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Word</th>
                        <th>Keyness</th>
                        <th>Target Freq</th>
                        <th>Ref Freq</th>
                        <th>Target/1000</th>
                        <th>Ref/1000</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    // Sort word list
    sortBy(method) {
        if (method === 'alphabetical') {
            this.wordList.sort((a, b) => a.word.localeCompare(b.word));
        } else if (method === 'frequency') {
            this.wordList.sort((a, b) => b.frequency - a.frequency);
        }
        
        const container = document.getElementById('resultsArea');
        this.renderWordList(container, {
            uniqueWords: this.wordList.length,
            totalWords: this.wordList.reduce((sum, w) => sum + w.frequency, 0)
        });
    }

    // Filter positive keywords
    filterPositive() {
        this.keywords = this.keywords.filter(k => k.targetRelFreq > k.refRelFreq);
        const container = document.getElementById('resultsArea');
        this.renderKeywordList(container, {
            targetTotal: 0,
            referenceTotal: 0
        });
    }

    // Filter negative keywords
    filterNegative() {
        this.keywords = this.keywords.filter(k => k.targetRelFreq < k.refRelFreq);
        const container = document.getElementById('resultsArea');
        this.renderKeywordList(container, {
            targetTotal: 0,
            referenceTotal: 0
        });
    }

    // Export word list
    exportWordList() {
        const csvRows = [
            ['Rank', 'Word', 'Frequency', 'Percentage'].join(',')
        ];

        this.wordList.forEach((item, index) => {
            csvRows.push([
                index + 1,
                `"${item.word.replace(/"/g, '""')}"`,
                item.frequency,
                item.percentage
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        this.downloadCSV(csvContent, `word_list_${new Date().toISOString().slice(0, 10)}.csv`);
    }

    // Export keywords
    exportKeywords() {
        const csvRows = [
            ['Rank', 'Word', 'Keyness', 'Target Freq', 'Ref Freq', 'Target/1000', 'Ref/1000'].join(',')
        ];

        this.keywords.forEach((item, index) => {
            csvRows.push([
                index + 1,
                `"${item.word.replace(/"/g, '""')}"`,
                item.keyness.toFixed(2),
                item.targetFreq,
                item.refFreq,
                item.targetRelFreq,
                item.refRelFreq
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        this.downloadCSV(csvContent, `keywords_${new Date().toISOString().slice(0, 10)}.csv`);
    }

    // Download CSV
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Get styles
    getStyles() {
        return `
            <style>
                .word-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .word-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .word-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .word-stats {
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

                .word-controls {
                    padding: 16px 24px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #dee2e6;
                }

                .word-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .word-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .word-info {
                    padding: 20px 24px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                }

                .word-legend {
                    background: white;
                    padding: 16px;
                    border-radius: 6px;
                    border-left: 4px solid #667eea;
                }

                .word-legend h4 {
                    margin: 0 0 12px 0;
                    color: #495057;
                    font-size: 15px;
                }

                .word-legend p {
                    margin: 6px 0;
                    font-size: 13px;
                    color: #6c757d;
                }

                .word-table-wrapper {
                    padding: 24px;
                    max-height: 600px;
                    overflow-y: auto;
                }

                .word-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .word-table thead {
                    position: sticky;
                    top: 0;
                    background: #f8f9fa;
                    z-index: 10;
                }

                .word-table th {
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    color: #495057;
                    border-bottom: 2px solid #dee2e6;
                    font-size: 13px;
                    text-transform: uppercase;
                }

                .word-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 14px;
                }

                .word-table tbody tr:hover {
                    background: #f8f9fa;
                }

                .word-table tbody tr:nth-child(even) {
                    background: #fafbfc;
                }

                .word-rank {
                    width: 80px;
                    text-align: center;
                    font-weight: 600;
                    color: #6c757d;
                }

                .word-text {
                    font-weight: 600;
                    color: #495057;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                    direction: rtl;
                    text-align: right;
                }

                .word-frequency {
                    width: 100px;
                    text-align: center;
                    font-weight: 600;
                    color: #495057;
                }

                .word-percentage {
                    width: 100px;
                    text-align: center;
                    color: #6c757d;
                }

                .word-keyness {
                    width: 100px;
                    text-align: center;
                    font-weight: 700;
                }

                .word-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                @media (max-width: 768px) {
                    .word-table {
                        font-size: 12px;
                    }

                    .word-table th,
                    .word-table td {
                        padding: 8px;
                    }
                }
            </style>
        `;
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main application
const wordModule = new WordModule();