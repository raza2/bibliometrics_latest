// plot.js - Plot Distribution Module

class PlotModule {
    constructor() {
        this.plotData = [];
        this.searchTerm = '';
    }

    // Process files and create plot data
    async processFiles(files, searchTerm, minFrequency = 1) {
        this.plotData = [];
        this.searchTerm = searchTerm;
        let totalHits = 0;

        console.log('Plot: Processing files for term:', searchTerm);

        for (const file of files) {
            try {
                const content = await this.readFile(file);
                const distribution = this.calculateDistribution(content, searchTerm, file.name);
                
                if (distribution.hits > 0) {
                    this.plotData.push(distribution);
                    totalHits += distribution.hits;
                }
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        console.log('Plot data generated:', this.plotData);

        return {
            plotData: this.plotData,
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

    // Calculate distribution of search term in document
    calculateDistribution(content, searchTerm, fileName) {
        const positions = [];
        const regex = new RegExp(this.escapeRegex(searchTerm), 'gi');
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Calculate position as percentage of document
            const percentage = (match.index / content.length) * 100;
            positions.push({
                index: match.index,
                percentage: percentage
            });
        }

        return {
            fileName: fileName,
            hits: positions.length,
            positions: positions,
            documentLength: content.length
        };
    }

    // Escape special regex characters
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Render plot visualization
    render(containerElement, data) {
        const html = `
            <div class="plot-container">
                <div class="plot-header">
                    <h3>Distribution Plot</h3>
                    <div class="plot-stats">
                        <span class="stat-badge">Search Term: "${data.searchTerm}"</span>
                        <span class="stat-badge">Total Hits: ${data.totalHits}</span>
                        <span class="stat-badge">Files: ${this.plotData.length}</span>
                    </div>
                </div>

                <div class="plot-controls">
                    <button class="plot-btn" onclick="plotModule.exportPlot()">Export Image</button>
                    <button class="plot-btn" onclick="plotModule.exportData()">Export CSV</button>
                </div>

                <div class="plot-canvas-wrapper">
                    ${this.renderPlot()}
                </div>
            </div>

            <style>
                .plot-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .plot-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .plot-header h3 {
                    margin: 0;
                    font-size: 18px;
                }

                .plot-stats {
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

                .plot-controls {
                    padding: 16px 20px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #dee2e6;
                }

                .plot-btn {
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .plot-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .plot-canvas-wrapper {
                    padding: 24px;
                    background: white;
                    overflow-x: auto;
                }

                .plot-file-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 16px;
                    gap: 12px;
                }

                .plot-file-label {
                    width: 200px;
                    font-size: 13px;
                    color: #495057;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .plot-bar-container {
                    flex: 1;
                    height: 40px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    position: relative;
                    border: 1px solid #dee2e6;
                }

                .plot-hit-marker {
                    position: absolute;
                    top: 0;
                    width: 3px;
                    height: 100%;
                    background: #667eea;
                    opacity: 0.7;
                    transition: all 0.2s;
                }

                .plot-hit-marker:hover {
                    opacity: 1;
                    width: 4px;
                    background: #764ba2;
                }

                .plot-hit-count {
                    width: 60px;
                    text-align: right;
                    font-size: 13px;
                    color: #6c757d;
                    font-weight: 600;
                }

                .plot-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }

                .plot-legend {
                    margin-top: 24px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    font-size: 13px;
                    color: #495057;
                }

                .plot-legend-title {
                    font-weight: 600;
                    margin-bottom: 8px;
                }

                @media (max-width: 768px) {
                    .plot-file-label {
                        width: 120px;
                        font-size: 11px;
                    }

                    .plot-bar-container {
                        height: 30px;
                    }

                    .plot-hit-count {
                        width: 40px;
                        font-size: 11px;
                    }
                }
            </style>
        `;

        containerElement.innerHTML = html;
    }

    // Render the actual plot
    renderPlot() {
        if (this.plotData.length === 0) {
            return `
                <div class="plot-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No data to plot</div>
                    <div style="font-size: 14px; opacity: 0.7;">Search results will appear here as a distribution plot</div>
                </div>
            `;
        }

        const rows = this.plotData.map(fileData => {
            const markers = fileData.positions.map(pos => 
                `<div class="plot-hit-marker" 
                      style="left: ${pos.percentage}%" 
                      title="Position: ${Math.round(pos.percentage)}%"></div>`
            ).join('');

            return `
                <div class="plot-file-row">
                    <div class="plot-file-label" title="${this.escapeHtml(fileData.fileName)}">
                        ${this.escapeHtml(fileData.fileName)}
                    </div>
                    <div class="plot-bar-container">
                        ${markers}
                    </div>
                    <div class="plot-hit-count">${fileData.hits}</div>
                </div>
            `;
        }).join('');

        return `
            ${rows}
            <div class="plot-legend">
                <div class="plot-legend-title">How to read this plot:</div>
                <div>• Each row represents a file in your corpus</div>
                <div>• Blue vertical lines show where the search term appears</div>
                <div>• Position from left (0%) to right (100%) shows location in document</div>
                <div>• Number on the right shows total occurrences in that file</div>
            </div>
        `;
    }

    // Export plot as image
    exportPlot() {
        // For a simple implementation, we'll use html2canvas if available
        // Otherwise, show a message
        if (typeof html2canvas === 'undefined') {
            alert('Image export requires html2canvas library. For now, use screenshot or export CSV data.');
            return;
        }
        
        // Implementation would go here with html2canvas
        alert('Plot export feature - use browser screenshot for now, or export CSV data');
    }

    // Export data as CSV
    exportData() {
        if (this.plotData.length === 0) {
            alert('No data to export');
            return;
        }

        const rows = [
            ['File', 'Total Hits', 'Position (%)', 'Position (chars)'].join(',')
        ];

        this.plotData.forEach(fileData => {
            if (fileData.positions.length === 0) {
                rows.push([
                    `"${fileData.fileName.replace(/"/g, '""')}"`,
                    0,
                    '',
                    ''
                ].join(','));
            } else {
                fileData.positions.forEach(pos => {
                    rows.push([
                        `"${fileData.fileName.replace(/"/g, '""')}"`,
                        fileData.hits,
                        pos.percentage.toFixed(2),
                        pos.index
                    ].join(','));
                });
            }
        });

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plot_distribution_${this.searchTerm}_${new Date().toISOString().slice(0, 10)}.csv`;
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
const plotModule = new PlotModule();