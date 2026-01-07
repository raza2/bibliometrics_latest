const posModule = {
    apiEndpoint: 'http://lekhari.aiou.edu.pk/pos/analyze',
    apiToken: '024d89fb666a0af58fbaa05b95a175bc8f91e51e2c1be343e0d23db7ff1dad2f83bb6b019d506a31ff5daca0c0938b3a7e588942f51277a33a294c27c88c9196',

    async processFiles(files, container, options = {}) {
        const { query = '', minFreq = 1, posTag = 'all', posType = 'all' } = options;

        if (!files || files.length === 0) {
            if (container) container.innerHTML = `<div style="color:red;">Please upload files first.</div>`;
            return { success: false, message: 'Please upload files first', results: [] };
        }

        try {
            // 1️⃣ Extract text from all files
            const allText = await this.extractTextFromFiles(files);

            if (!allText || !allText.trim()) {
                if (container) container.innerHTML = `<div style="color:red;">No text found in uploaded files.</div>`;
                return { success: false, message: 'No text found in uploaded files', results: [] };
            }

            // 2️⃣ Call the POS API
            const apiResponse = await this.callPOSAPI(allText);

            // 3️⃣ Add filtering info to response
            apiResponse.query = query;
            apiResponse.minFreq = parseInt(minFreq) || 1;
            apiResponse.posTag = posTag;
            apiResponse.posType = posType;

            // 4️⃣ 🔥 Store globally for easy access
            window.POS_DATA = Array.isArray(apiResponse.results) ? apiResponse.results : [];

            // 5️⃣ Filter results
            const filteredResults = this.filterResults(window.POS_DATA, query, minFreq, posTag, posType);

            // 6️⃣ Render results automatically if container is provided
            if (container) {
                this.render(container, {
                    success: true,
                    results: filteredResults,
                    query,
                    minFreq,
                    posTag,
                    posType,
                    total_words: window.POS_DATA.length
                });
            }

            return {
                success: true,
                results: filteredResults,
                statistics: { totalWords: window.POS_DATA.length },
                query,
                minFreq,
                posTag,
                posType
            };

        } catch (error) {
            console.error('POS Module Error:', error);
            if (container) container.innerHTML = `<div style="color:red;">Error: ${error.message}</div>`;
            return { success: false, message: error.message, results: [] };
        }
    },


    async extractTextFromFiles(files) {
        let combinedText = '';

        for (const file of files) {
            try {
                const text = await this.readFile(file);
                combinedText += text + '\n';
            } catch (error) {
                console.error(`Error reading file ${file.name}:`, error);
            }
        }

        return combinedText.trim();
    },

    async readFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'txt') {
            return await this.readTextFile(file);
        } else if (extension === 'xlsx' || extension === 'xls') {
            return await this.readExcelFile(file);
        } else if (extension === 'csv') {
            return await this.readCSVFile(file);
        } else {
            throw new Error(`Unsupported file type: ${extension}`);
        }
    },

    readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read text file'));
            reader.readAsText(file);
        });
    },

    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let text = '';

                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const csv = XLSX.utils.sheet_to_csv(sheet);
                        text += csv + '\n';
                    });

                    resolve(text);
                } catch (error) {
                    reject(new Error('Failed to read Excel file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read Excel file'));
            reader.readAsArrayBuffer(file);
        });
    },

    readCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
        });
    },

    async callPOSAPI(text) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Authorization': this.apiToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Call Error:', error);
            throw new Error(`Failed to call POS API: ${error.message}`);
        }
    },

    filterResults(results, query, minFreq, posTag = 'all', posType = 'all') {
        if (!results || results.length === 0) return [];
        
        let filtered = results;
        
        // Filter by POS tag if not "all"
        if (posTag && posTag !== 'all') {
            filtered = filtered.filter(item => {
                const itemPos = (item.pos || '').toUpperCase();
                return itemPos === posTag.toUpperCase() || itemPos.startsWith(posTag.toUpperCase());
            });
        }
        
        // Filter by POS type if not "all"
        if (posType && posType !== 'all') {
            filtered = filtered.filter(item => {
                const itemType = item.pos_type || '';
                return itemType === posType;
            });
        }
        
        // Filter by search query if provided
        if (query && query.trim()) {
            const searchTerm = query.trim().toLowerCase();
            filtered = filtered.filter(item => {
                const word = (item.word || '').toLowerCase();
                const pos = (item.pos || '').toLowerCase();
                const posTypeStr = (item.pos_type || '').toLowerCase();
                
                return word.includes(searchTerm) || 
                       pos.includes(searchTerm) || 
                       posTypeStr.includes(searchTerm);
            });
        }
        
        // Filter by minimum frequency
        if (minFreq > 1) {
            filtered = filtered.filter(item => {
                const freq = parseInt(item.frequency) || 1;
                return freq >= minFreq;
            });
        }
        
        return filtered;
    },

    render(container, data) {
        if (!data.success) {
            container.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">❌</div>
                    <div class="placeholder-text">Error</div>
                    <div class="placeholder-subtext">${data.message || 'Failed to analyze text'}</div>
                </div>
            `;
            return;
        }

        const allResults = data.results || [];
        const query = data.query || '';
        const minFreq = data.minFreq || 1;
        const posTag = data.posTag || 'all';
        const posType = data.posType || 'all';
        
        // Filter results based on query, frequency, POS tag, and POS type
        const filteredResults = this.filterResults(allResults, query, minFreq, posTag, posType);

        if (filteredResults.length === 0) {
            let filters = [];
            if (query) filters.push(`"${query}"`);
            if (posTag !== 'all') filters.push(`POS: ${posTag}`);
            if (posType !== 'all') filters.push(`Type: ${posType}`);
            if (minFreq > 1) filters.push(`frequency ≥ ${minFreq}`);
            
            const message = filters.length > 0 ? 
                `No results found for ${filters.join(', ')}` :
                'No POS tags found in the text';
                
            container.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">📝</div>
                    <div class="placeholder-text">No Results</div>
                    <div class="placeholder-subtext">${message}</div>
                    ${query ? '<div class="placeholder-subtext" style="margin-top: 8px;">Try a different search term or clear the search to see all results</div>' : ''}
                </div>
            `;
            return;
        }

        // Create the results table
        let html = `
            <style>
                .pos-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .pos-stats {
                    display: flex;
                    gap: 16px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                    flex-wrap: wrap;
                }
                
                .pos-stat {
                    background: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .pos-stat-label {
                    font-size: 12px;
                    color: #6c757d;
                    margin-bottom: 4px;
                }
                
                .pos-stat-value {
                    font-size: 20px;
                    font-weight: 600;
                    color: #667eea;
                }
                
                .pos-search-info {
                    padding: 12px 16px;
                    background: #e7f3ff;
                    border-left: 4px solid #0066cc;
                    margin: 16px;
                    border-radius: 4px;
                }
                
                .pos-search-text {
                    font-size: 14px;
                    color: #495057;
                }
                
                .pos-search-term {
                    font-weight: 600;
                    color: #0066cc;
                }
                
                .pos-table-container {
                    overflow-x: auto;
                    max-height: 600px;
                    overflow-y: auto;
                }
                
                .pos-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                
                .pos-table thead {
                    position: sticky;
                    top: 0;
                    background: #667eea;
                    color: white;
                    z-index: 10;
                }
                
                .pos-table th {
                    padding: 12px;
                    text-align: center;
                    font-weight: 600;
                    border-bottom: 2px solid #5568d3;
                }
                
                .pos-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #dee2e6;
                    text-align: center;
                }
                
                .pos-table td.rtl-text {
                    direction: rtl;
                    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif;
                    text-align: center;
                }
                
                .pos-table tbody tr:hover {
                    background: #f8f9fa;
                }
                
                .pos-table tbody tr:nth-child(even) {
                    background: #fafbfc;
                }
                
                .pos-word {
                    font-weight: 600;
                    color: #212529;
                    font-size: 16px;
                }
                
                .pos-word-highlight {
                    background: #fff3cd;
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                
                .pos-tag {
                    display: inline-block;
                    padding: 4px 8px;
                    background: #e7f3ff;
                    color: #0066cc;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .pos-type {
                    color: #6c757d;
                    font-size: 13px;
                }
                
                .pos-freq {
                    font-weight: 600;
                    color: #28a745;
                }
                
                .pos-percentage {
                    color: #667eea;
                    font-weight: 600;
                }
            </style>
            
            <div class="pos-container">
                <div class="pos-stats">
                    <div class="pos-stat">
                        <div class="pos-stat-label">Total Words (All)</div>
                        <div class="pos-stat-value">${data.total_words || allResults.length}</div>
                    </div>
                    <div class="pos-stat">
                        <div class="pos-stat-label">${query ? 'Filtered Results' : 'Results Shown'}</div>
                        <div class="pos-stat-value">${filteredResults.length}</div>
                    </div>
                    <div class="pos-stat">
                        <div class="pos-stat-label">Unique Words</div>
                        <div class="pos-stat-value">${new Set(filteredResults.map(r => r.word)).size}</div>
                    </div>
                    <div class="pos-stat">
                        <div class="pos-stat-label">POS Tags</div>
                        <div class="pos-stat-value">${new Set(filteredResults.map(r => r.pos)).size}</div>
                    </div>
                </div>
        `;

        // Add search info if query exists
        if (query || posTag !== 'all' || posType !== 'all') {
            html += `
                <div class="pos-search-info">
                    <span class="pos-search-text">
                        ${query ? `Search: <span class="pos-search-term">"${query}"</span>` : ''}
                        ${query && (posTag !== 'all' || posType !== 'all') ? ' | ' : ''}
                        ${posTag !== 'all' ? `POS Tag: <span class="pos-search-term">${posTag}</span>` : ''}
                        ${posTag !== 'all' && posType !== 'all' ? ' | ' : ''}
                        ${posType !== 'all' ? `POS Type: <span class="pos-search-term">${posType}</span>` : ''}
                        ${minFreq > 1 ? ` | Minimum frequency: <span class="pos-search-term">${minFreq}</span>` : ''}
                    </span>
                </div>
            `;
        }

        html += `
                <div class="pos-table-container">
                    <table class="pos-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Before</th>
                                <th>Word</th>
                                <th>After</th>
                                <th>POS</th>
                                <th>Type</th>
                                <th>Frequency</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        filteredResults.forEach((item, index) => {
            // Highlight search term if it matches
            const shouldHighlight = query && 
                (item.word.toLowerCase().includes(query.toLowerCase()) ||
                 (item.pos || '').toLowerCase().includes(query.toLowerCase()) ||
                 (item.pos_type || '').toLowerCase().includes(query.toLowerCase()));
            
            const wordClass = shouldHighlight ? 'pos-word pos-word-highlight' : 'pos-word';
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="${wordClass} rtl-text">${item.before || '-'}</td>
                    <td class="${wordClass} rtl-text">${item.word}</td>
                    <td class="${wordClass} rtl-text">${item.after || '-'}</td>
                    <td><span class="pos-tag">${item.pos}</span></td>
                    <td class="pos-type">${item.pos_type || '-'}</td>
                    <td class="pos-freq">${item.frequency || 1}</td>
                    <td class="pos-percentage">${item.percentage || '0%'}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
};

// Make it globally available
window.posModule = posModule;
