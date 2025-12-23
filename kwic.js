// kwic.js - KWIC (Keyword in Context) Module

class KWICModule {
    constructor() {
        this.fileResults = []; // Store results per file
        this.sortColumn = null;
        this.sortDirection = 'asc';
    }

    // Process files and search for keyword
    async processFiles(files, searchTerm, minFrequency = 1) {
        this.fileResults = [];
        let totalHits = 0;
        let totalTokens = 0;

        console.log('Processing files:', files.length);
        console.log('Search term:', searchTerm);

        for (const file of files) {
            try {
                console.log('Reading file:', file.name);
                const content = await this.readFile(file);
                console.log('File content length:', content.length);
                
                const matches = this.findMatches(content, searchTerm, file.name);
                console.log('Matches found:', matches.length);
                
                // Count tokens (words)
                const words = content.split(/\s+/).filter(word => word.length > 0);
                
                // Store results per file
                if (matches.length > 0) {
                    this.fileResults.push({
                        fileName: file.name,
                        results: matches,
                        hits: matches.length,
                        tokens: words.length
                    });
                    
                    totalHits += matches.length;
                }
                
                totalTokens += words.length;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        console.log('Total results:', totalHits);

        return {
            fileResults: this.fileResults,
            totalHits: totalHits,
            totalTokens: totalTokens
        };
    }

    // Read file content
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                let content = e.target.result;
                
                // Handle different file types
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    console.log('Excel file detected - basic text extraction');
                    resolve(content);
                } else if (file.name.endsWith('.csv')) {
                    resolve(content);
                } else {
                    resolve(content);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // Find all matches of search term in content
    findMatches(content, searchTerm, fileName) {
        const matches = [];
        const contextSize = 50; // characters on each side
        
        searchTerm = searchTerm.trim();
        
        if (!searchTerm || !content) {
            console.log('Empty search term or content');
            return matches;
        }
        
        const patterns = [
            new RegExp(`\\b${this.escapeRegex(searchTerm)}\\b`, 'gi'),
            new RegExp(this.escapeRegex(searchTerm), 'gi')
        ];
        
        let match;
        let foundMatches = false;
        
        for (const regex of patterns) {
            regex.lastIndex = 0;
            
            while ((match = regex.exec(content)) !== null) {
                foundMatches = true;
                const startPos = Math.max(0, match.index - contextSize);
                const endPos = Math.min(content.length, match.index + match[0].length + contextSize);
                
                let leftContext = content.substring(startPos, match.index);
                const keyword = content.substring(match.index, match.index + match[0].length);
                let rightContext = content.substring(match.index + match[0].length, endPos);
                
                leftContext = leftContext.replace(/\s+/g, ' ').trim();
                rightContext = rightContext.replace(/\s+/g, ' ').trim();
                
                if (startPos > 0) leftContext = '...' + leftContext;
                if (endPos < content.length) rightContext = rightContext + '...';

                matches.push({
                    file: fileName,
                    leftContext: leftContext,
                    keyword: keyword,
                    rightContext: rightContext,
                    position: match.index
                });
            }
            
            if (foundMatches) break;
        }

        return matches;
    }

    // Escape special regex characters
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Render KWIC tables (one per file)
    render(containerElement, data) {
        if (this.fileResults.length === 0) {
            containerElement.innerHTML = `
                <div class="kwic-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No results found</div>
                    <div style="font-size: 14px; opacity: 0.7;">Try a different search term or check your files</div>
                </div>
            `;
            return;
        }

        const tablesHtml = this.fileResults.map((fileData, fileIndex) => `
            <div class="kwic-file-section">
                <div class="kwic-file-header">
                    <div class="kwic-file-info">
                        <span class="kwic-file-icon">📄</span>
                        <span class="kwic-file-name">${this.escapeHtml(fileData.fileName)}</span>
                    </div>
                    <div class="kwic-file-stats">
                        <span class="stat-badge">Hits: ${fileData.hits}</span>
                        <span class="stat-badge">Tokens: ${fileData.tokens.toLocaleString()}</span>
                    </div>
                </div>

                <div class="kwic-controls">
                    <button class="kwic-btn" onclick="kwicModule.sortFileResults(${fileIndex}, 'left')">Sort Left</button>
                    <button class="kwic-btn" onclick="kwicModule.sortFileResults(${fileIndex}, 'keyword')">Sort Keyword</button>
                    <button class="kwic-btn" onclick="kwicModule.sortFileResults(${fileIndex}, 'right')">Sort Right</button>
                    <button class="kwic-btn" onclick="kwicModule.exportFileResults(${fileIndex})">Export</button>
                </div>

                <div class="kwic-table-wrapper">
                    <table class="kwic-table">
                        <thead>
                            <tr>
                                <th class="kwic-col-num">#</th>
                                <th class="kwic-col-left">Left Context</th>
                                <th class="kwic-col-keyword">Hit</th>
                                <th class="kwic-col-right">Right Context</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderFileRows(fileData)}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('');

        const html = `
            <div class="kwic-container">
                <div class="kwic-header">
                    <h3>KWIC Results - Multiple Files</h3>
                    <div class="kwic-stats">
                        <span class="stat-badge">Total Files: ${this.fileResults.length}</span>
                        <span class="stat-badge">Total Hits: ${data.totalHits}</span>
                        <span class="stat-badge">Total Tokens: ${data.totalTokens.toLocaleString()}</span>
                    </div>
                </div>

                <div class="kwic-global-controls">
                    <button class="kwic-btn-primary" onclick="kwicModule.exportAllResults()">📥 Export All Results</button>
                    <button class="kwic-btn-primary" onclick="kwicModule.collapseAll()">📁 Collapse All</button>
                    <button class="kwic-btn-primary" onclick="kwicModule.expandAll()">📂 Expand All</button>
                </div>

                ${tablesHtml}
            </div>

            <style>
                .kwic-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .kwic-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .kwic-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .kwic-stats {
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

                .kwic-global-controls {
                    padding: 16px 24px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 2px solid #dee2e6;
                }

                .kwic-btn-primary {
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s;
                }

                .kwic-btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                }

                .kwic-file-section {
                    margin: 24px;
                    border: 2px solid #e9ecef;
                    border-radius: 8px;
                    overflow: hidden;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }

                .kwic-file-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .kwic-file-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .kwic-file-icon {
                    font-size: 20px;
                }

                .kwic-file-name {
                    font-size: 15px;
                    font-weight: 600;
                    color: #495057;
                }

                .kwic-file-stats {
                    display: flex;
                    gap: 8px;
                }

                .kwic-file-stats .stat-badge {
                    background: #e7f3ff;
                    color: #0066cc;
                    font-size: 12px;
                }

                .kwic-controls {
                    padding: 12px 20px;
                    background: white;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #e9ecef;
                }

                .kwic-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .kwic-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .kwic-table-wrapper {
                    overflow-x: auto;
                    max-height: 500px;
                    overflow-y: auto;
                }

                .kwic-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }

                .kwic-table thead {
                    position: sticky;
                    top: 0;
                    background: #f8f9fa;
                    z-index: 10;
                }

                .kwic-table th {
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    color: #495057;
                    border-bottom: 2px solid #dee2e6;
                }

                .kwic-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #e9ecef;
                }

                .kwic-table tbody tr:hover {
                    background: #f8f9fa;
                }

                .kwic-table tbody tr:nth-child(even) {
                    background: #fafbfc;
                }

                .kwic-table tbody tr:nth-child(even):hover {
                    background: #f0f2f5;
                }

                .kwic-col-num {
                    width: 60px;
                    text-align: center;
                    color: #6c757d;
                    font-weight: 600;
                }

                .kwic-col-left {
                    text-align: right;
                    color: #495057;
                    max-width: 350px;
                    padding-right: 12px;
                    border-right: 2px solid #dee2e6;
                }

                .kwic-col-keyword {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    font-weight: 700;
                    color: #856404;
                    white-space: nowrap;
                    text-align: center;
                    padding: 12px 20px;
                    border-left: 2px solid #ffc107;
                    border-right: 2px solid #ffc107;
                }

                .kwic-col-right {
                    color: #495057;
                    max-width: 350px;
                    padding-left: 12px;
                    border-left: 2px solid #dee2e6;
                }

                .kwic-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                @media (max-width: 768px) {
                    .kwic-table {
                        font-size: 12px;
                    }

                    .kwic-table th,
                    .kwic-table td {
                        padding: 8px;
                    }

                    .kwic-col-left,
                    .kwic-col-right {
                        max-width: 150px;
                    }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

    // Render rows for a specific file
    renderFileRows(fileData) {
        return fileData.results.map((result, index) => `
            <tr>
                <td class="kwic-col-num">${index + 1}</td>
                <td class="kwic-col-left">${this.escapeHtml(result.leftContext)}</td>
                <td class="kwic-col-keyword">${this.escapeHtml(result.keyword)}</td>
                <td class="kwic-col-right">${this.escapeHtml(result.rightContext)}</td>
            </tr>
        `).join('');
    }

    // Sort results for a specific file
    sortFileResults(fileIndex, column) {
        const columnMap = {
            'left': 'leftContext',
            'keyword': 'keyword',
            'right': 'rightContext'
        };

        const field = columnMap[column];
        const fileData = this.fileResults[fileIndex];
        
        if (this.sortColumn === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = field;
            this.sortDirection = 'asc';
        }

        fileData.results.sort((a, b) => {
            const valA = a[field].toLowerCase();
            const valB = b[field].toLowerCase();
            
            if (this.sortDirection === 'asc') {
                return valA.localeCompare(valB);
            } else {
                return valB.localeCompare(valA);
            }
        });

        // Re-render
        const container = document.getElementById('resultsArea');
        if (container) {
            const totalHits = this.fileResults.reduce((sum, f) => sum + f.hits, 0);
            const totalTokens = this.fileResults.reduce((sum, f) => sum + f.tokens, 0);
            this.render(container, { totalHits, totalTokens });
        }
    }

    // Export results for a specific file
    exportFileResults(fileIndex) {
        const fileData = this.fileResults[fileIndex];
        
        const csvContent = [
            ['#', 'Left Context', 'Keyword', 'Right Context'].join(','),
            ...fileData.results.map((result, index) => 
                [
                    index + 1,
                    `"${result.leftContext.replace(/"/g, '""')}"`,
                    `"${result.keyword.replace(/"/g, '""')}"`,
                    `"${result.rightContext.replace(/"/g, '""')}"`
                ].join(',')
            )
        ].join('\n');

        this.downloadCSV(csvContent, `kwic_${fileData.fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    }

    // Export all results
    exportAllResults() {
        const csvContent = [
            ['File', '#', 'Left Context', 'Keyword', 'Right Context'].join(',')
        ];

        this.fileResults.forEach(fileData => {
            fileData.results.forEach((result, index) => {
                csvContent.push([
                    `"${fileData.fileName.replace(/"/g, '""')}"`,
                    index + 1,
                    `"${result.leftContext.replace(/"/g, '""')}"`,
                    `"${result.keyword.replace(/"/g, '""')}"`,
                    `"${result.rightContext.replace(/"/g, '""')}"`
                ].join(','));
            });
        });

        this.downloadCSV(csvContent.join('\n'), `kwic_all_results_${new Date().toISOString().slice(0, 10)}.csv`);
    }

    // Helper to download CSV
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

    // Collapse/Expand all sections
    collapseAll() {
        const sections = document.querySelectorAll('.kwic-table-wrapper');
        sections.forEach(section => section.style.display = 'none');
    }

    expandAll() {
        const sections = document.querySelectorAll('.kwic-table-wrapper');
        sections.forEach(section => section.style.display = 'block');
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main application
const kwicModule = new KWICModule();