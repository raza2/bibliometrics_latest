// fileview.js - File View Module

class FileViewModule {
    constructor() {
        this.fileContents = [];
        this.searchTerm = '';
        this.currentFileIndex = 0;
    }

    // Process files and highlight search term
    async processFiles(files, searchTerm, minFrequency = 1) {
        this.fileContents = [];
        this.searchTerm = searchTerm;
        let totalHits = 0;

        console.log('FileView: Processing files for term:', searchTerm);

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const highlightedContent = this.highlightSearchTerm(content, searchTerm);
                const hits = this.countMatches(content, searchTerm);
                
                // Count lines and words
                const lines = content.split('\n').length;
                const words = content.split(/\s+/).filter(w => w.length > 0).length;

                this.fileContents.push({
                    fileName: file.name,
                    originalContent: content,
                    highlightedContent: highlightedContent,
                    hits: hits,
                    lines: lines,
                    words: words,
                    size: file.size
                });

                totalHits += hits;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        console.log('FileView data generated:', this.fileContents.length, 'files');

        return {
            fileContents: this.fileContents,
            totalHits: totalHits,
            searchTerm: searchTerm
        };
    }

    // Read file content
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // Count matches
    countMatches(content, searchTerm) {
        if (!searchTerm) return 0;
        const regex = new RegExp(this.escapeRegex(searchTerm), 'gi');
        const matches = content.match(regex);
        return matches ? matches.length : 0;
    }

    // Highlight search term in content
    highlightSearchTerm(content, searchTerm) {
        if (!searchTerm) return this.escapeHtml(content);
        
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        const escaped = this.escapeHtml(content);
        
        return escaped.replace(regex, '<mark class="highlight">$1</mark>');
    }

    // Escape special regex characters
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Render file view
    render(containerElement, data) {
        if (this.fileContents.length === 0) {
            containerElement.innerHTML = `
                <div class="fileview-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No files loaded</div>
                    <div style="font-size: 14px; opacity: 0.7;">Upload files to view their content</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="fileview-container">
                <div class="fileview-header">
                    <h3>File View</h3>
                    <div class="fileview-stats">
                        <span class="stat-badge">Files: ${this.fileContents.length}</span>
                        <span class="stat-badge">Search Term: "${data.searchTerm}"</span>
                        <span class="stat-badge">Total Hits: ${data.totalHits}</span>
                    </div>
                </div>

                <div class="fileview-controls">
                    <button class="fileview-btn" onclick="fileViewModule.prevFile()">◀ Previous</button>
                    <button class="fileview-btn" onclick="fileViewModule.nextFile()">Next ▶</button>
                    <button class="fileview-btn" onclick="fileViewModule.copyContent()">📋 Copy Text</button>
                    <button class="fileview-btn" onclick="fileViewModule.downloadFile()">💾 Download</button>
                    <button class="fileview-btn" onclick="fileViewModule.toggleLineNumbers()">🔢 Line Numbers</button>
                </div>

                <div class="fileview-tabs">
                    ${this.renderTabs()}
                </div>

                <div class="fileview-content-wrapper" id="fileViewContent">
                    ${this.renderCurrentFile()}
                </div>
            </div>

            <style>
                .fileview-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    height: 100%;
                }

                .fileview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .fileview-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .fileview-stats {
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

                .fileview-controls {
                    padding: 16px 24px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #dee2e6;
                }

                .fileview-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .fileview-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .fileview-tabs {
                    display: flex;
                    overflow-x: auto;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                    padding: 0 24px;
                    gap: 4px;
                }

                .fileview-tab {
                    padding: 12px 20px;
                    border: none;
                    background: transparent;
                    color: #495057;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    white-space: nowrap;
                    transition: all 0.2s;
                }

                .fileview-tab:hover {
                    background: #e9ecef;
                    color: #667eea;
                }

                .fileview-tab.active {
                    background: white;
                    color: #667eea;
                    border-bottom-color: #667eea;
                    font-weight: 600;
                }

                .fileview-content-wrapper {
                    padding: 24px;
                    background: #ffffff;
                    max-height: 600px;
                    overflow-y: auto;
                }

                .fileview-file-info {
                    background: #f8f9fa;
                    padding: 16px;
                    border-radius: 6px;
                    margin-bottom: 20px;
                    border-left: 4px solid #667eea;
                }

                .fileview-info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 12px;
                    margin-top: 12px;
                }

                .fileview-info-item {
                    display: flex;
                    flex-direction: column;
                }

                .fileview-info-label {
                    font-size: 11px;
                    color: #6c757d;
                    text-transform: uppercase;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .fileview-info-value {
                    font-size: 14px;
                    color: #495057;
                    font-weight: 600;
                }

                .fileview-text-content {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 20px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #2d3436;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .fileview-text-content.with-line-numbers {
                    padding-left: 60px;
                    position: relative;
                }

                .highlight {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-weight: 700;
                    color: #856404;
                    border: 1px solid #ffc107;
                }

                .fileview-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                .line-numbers {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 50px;
                    background: #e9ecef;
                    padding: 20px 8px;
                    border-right: 2px solid #dee2e6;
                    text-align: right;
                    color: #6c757d;
                    font-size: 12px;
                    line-height: 1.6;
                    user-select: none;
                }

                @media (max-width: 768px) {
                    .fileview-controls {
                        padding: 12px 16px;
                    }

                    .fileview-btn {
                        font-size: 11px;
                        padding: 6px 12px;
                    }

                    .fileview-text-content {
                        font-size: 11px;
                        padding: 12px;
                    }

                    .fileview-tabs {
                        padding: 0 12px;
                    }

                    .fileview-tab {
                        padding: 10px 16px;
                        font-size: 12px;
                    }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

    // Render tabs for file selection
    renderTabs() {
        return this.fileContents.map((file, index) => `
            <button 
                class="fileview-tab ${index === this.currentFileIndex ? 'active' : ''}" 
                onclick="fileViewModule.switchFile(${index})"
            >
                ${this.escapeHtml(file.fileName)} ${file.hits > 0 ? `(${file.hits})` : ''}
            </button>
        `).join('');
    }

    // Render current file content
    renderCurrentFile() {
        const file = this.fileContents[this.currentFileIndex];
        
        return `
            <div class="fileview-file-info">
                <h4 style="margin: 0 0 12px 0; color: #495057;">📄 ${this.escapeHtml(file.fileName)}</h4>
                <div class="fileview-info-grid">
                    <div class="fileview-info-item">
                        <span class="fileview-info-label">Lines</span>
                        <span class="fileview-info-value">${file.lines.toLocaleString()}</span>
                    </div>
                    <div class="fileview-info-item">
                        <span class="fileview-info-label">Words</span>
                        <span class="fileview-info-value">${file.words.toLocaleString()}</span>
                    </div>
                    <div class="fileview-info-item">
                        <span class="fileview-info-label">Hits</span>
                        <span class="fileview-info-value">${file.hits}</span>
                    </div>
                    <div class="fileview-info-item">
                        <span class="fileview-info-label">Size</span>
                        <span class="fileview-info-value">${this.formatBytes(file.size)}</span>
                    </div>
                </div>
            </div>
            <div class="fileview-text-content" id="fileTextContent">
                ${file.highlightedContent}
            </div>
        `;
    }

    // Switch to a different file
    switchFile(index) {
        this.currentFileIndex = index;
        const container = document.getElementById('fileViewContent');
        if (container) {
            container.innerHTML = this.renderCurrentFile();
        }
        
        // Update active tab
        document.querySelectorAll('.fileview-tab').forEach((tab, i) => {
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    // Navigate to previous file
    prevFile() {
        if (this.currentFileIndex > 0) {
            this.switchFile(this.currentFileIndex - 1);
        }
    }

    // Navigate to next file
    nextFile() {
        if (this.currentFileIndex < this.fileContents.length - 1) {
            this.switchFile(this.currentFileIndex + 1);
        }
    }

    // Copy content to clipboard
    copyContent() {
        const file = this.fileContents[this.currentFileIndex];
        navigator.clipboard.writeText(file.originalContent).then(() => {
            alert('Content copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy content');
        });
    }

    // Download current file
    downloadFile() {
        const file = this.fileContents[this.currentFileIndex];
        const blob = new Blob([file.originalContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Toggle line numbers
    toggleLineNumbers() {
        const content = document.getElementById('fileTextContent');
        if (!content) return;

        if (content.classList.contains('with-line-numbers')) {
            content.classList.remove('with-line-numbers');
            const lineNumbers = content.querySelector('.line-numbers');
            if (lineNumbers) lineNumbers.remove();
        } else {
            content.classList.add('with-line-numbers');
            const file = this.fileContents[this.currentFileIndex];
            const lines = file.originalContent.split('\n').length;
            const lineNumbersHtml = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
            const lineNumbersDiv = document.createElement('div');
            lineNumbersDiv.className = 'line-numbers';
            lineNumbersDiv.textContent = lineNumbersHtml;
            content.insertBefore(lineNumbersDiv, content.firstChild);
        }
    }

    // Format bytes to human readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main application
const fileViewModule = new FileViewModule();