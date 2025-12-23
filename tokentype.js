// tokentype.js - Token Type Analysis Module for AntConc
// Compatible with the modular architecture

const tokenTypeModule = (function() {
    'use strict';

    // Token type categories
    const TOKEN_TYPES = {
        ALPHABETIC: 'alphabetic',
        NUMERIC: 'numeric',
        ALPHANUMERIC: 'alphanumeric',
        PUNCTUATION: 'punctuation',
        URDU: 'urdu',
        ENGLISH: 'english',
        MIXED: 'mixed',
        SPECIAL: 'special'
    };

    /**
     * Process files for token type analysis
     * @param {Array} files - Array of file objects with content
     * @param {string} query - Search query (optional)
     * @param {number} minFreq - Minimum frequency filter
     * @returns {Promise<object>} Processed token type data
     */
    async function processFiles(files, query = '', minFreq = 1) {
        let allText = '';
        let fileNames = [];

        // Combine all file contents
        for (const file of files) {
            allText += file.content + ' ';
            fileNames.push(file.name);
        }

        // Analyze token types
        const tokenData = analyzeTokenTypes(allText, query, minFreq);
        
        return {
            ...tokenData,
            files: fileNames,
            fileCount: files.length,
            totalHits: tokenData.statistics.totalTokens
        };
    }

    /**
     * Analyze token types in text
     * @param {string} text - Input text
     * @param {string} query - Filter query
     * @param {number} minFreq - Minimum frequency
     * @returns {object} Token type analysis data
     */
    function analyzeTokenTypes(text, query = '', minFreq = 1) {
        if (!text || text.trim().length === 0) {
            return null;
        }

        // Tokenize - keep all tokens including punctuation
        const allTokens = text.match(/[\u0600-\u06FF]+|[a-zA-Z]+|[0-9]+|[^\s\u0600-\u06FF a-zA-Z0-9]+/g) || [];
        
        // Count token frequencies
        const tokenFrequency = {};
        allTokens.forEach(token => {
            tokenFrequency[token] = (tokenFrequency[token] || 0) + 1;
        });

        // Filter by query if provided
        let filteredTokens = tokenFrequency;
        if (query) {
            filteredTokens = {};
            Object.keys(tokenFrequency).forEach(token => {
                if (token.toLowerCase().includes(query.toLowerCase())) {
                    filteredTokens[token] = tokenFrequency[token];
                }
            });
        }

        // Filter by minimum frequency
        Object.keys(filteredTokens).forEach(token => {
            if (filteredTokens[token] < minFreq) {
                delete filteredTokens[token];
            }
        });

        // Classify each token
        const tokenAnalysis = {};
        Object.keys(filteredTokens).forEach(token => {
            tokenAnalysis[token] = classifyToken(token);
            tokenAnalysis[token].frequency = filteredTokens[token];
        });

        // Group by type
        const typeGroups = groupByType(tokenAnalysis);

        // Calculate length distribution
        const lengthDistribution = calculateLengthDistribution(tokenAnalysis);

        // Calculate pattern statistics
        const patterns = extractTokenPatterns(tokenAnalysis);

        // Calculate statistics
        const statistics = calculateTokenStats(tokenAnalysis, typeGroups);

        return {
            tokens: Object.keys(filteredTokens),
            analysis: tokenAnalysis,
            typeGroups: typeGroups,
            lengthDistribution: lengthDistribution,
            patterns: patterns,
            statistics: statistics
        };
    }

    /**
     * Classify individual token
     * @param {string} token - Token to classify
     * @returns {object} Token classification
     */
    function classifyToken(token) {
        const classification = {
            token: token,
            length: token.length,
            type: null,
            subtype: null,
            hasUrdu: /[\u0600-\u06FF]/.test(token),
            hasEnglish: /[a-zA-Z]/.test(token),
            hasNumeric: /[0-9]/.test(token),
            hasPunctuation: /[^\w\s\u0600-\u06FF]/.test(token),
            isUpperCase: /^[A-Z]+$/.test(token),
            isLowerCase: /^[a-z]+$/.test(token),
            isMixedCase: /[a-z]/.test(token) && /[A-Z]/.test(token)
        };

        // Determine primary type
        if (/^[\u0600-\u06FF]+$/.test(token)) {
            classification.type = TOKEN_TYPES.URDU;
            classification.subtype = 'pure urdu';
        } else if (/^[a-zA-Z]+$/.test(token)) {
            classification.type = TOKEN_TYPES.ENGLISH;
            classification.subtype = classification.isUpperCase ? 'uppercase' : 
                                      classification.isLowerCase ? 'lowercase' : 'mixed case';
        } else if (/^[0-9]+$/.test(token)) {
            classification.type = TOKEN_TYPES.NUMERIC;
            classification.subtype = 'digits';
        } else if (/^[a-zA-Z0-9]+$/.test(token)) {
            classification.type = TOKEN_TYPES.ALPHANUMERIC;
            classification.subtype = 'mixed alphanumeric';
        } else if (/^[^\w\s\u0600-\u06FF]+$/.test(token)) {
            classification.type = TOKEN_TYPES.PUNCTUATION;
            classification.subtype = 'punctuation only';
        } else if (classification.hasUrdu && (classification.hasEnglish || classification.hasNumeric)) {
            classification.type = TOKEN_TYPES.MIXED;
            classification.subtype = 'multilingual';
        } else {
            classification.type = TOKEN_TYPES.SPECIAL;
            classification.subtype = 'special characters';
        }

        return classification;
    }

    /**
     * Group tokens by type
     */
    function groupByType(tokenAnalysis) {
        const groups = {};
        
        Object.values(tokenAnalysis).forEach(item => {
            const type = item.type;
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push({
                token: item.token,
                frequency: item.frequency,
                length: item.length,
                subtype: item.subtype
            });
        });

        // Sort each group by frequency
        Object.keys(groups).forEach(type => {
            groups[type].sort((a, b) => b.frequency - a.frequency);
        });

        return groups;
    }

    /**
     * Calculate length distribution
     */
    function calculateLengthDistribution(tokenAnalysis) {
        const distribution = {};
        
        Object.values(tokenAnalysis).forEach(item => {
            const len = item.length;
            if (!distribution[len]) {
                distribution[len] = {
                    length: len,
                    count: 0,
                    tokens: []
                };
            }
            distribution[len].count += item.frequency;
            distribution[len].tokens.push(item.token);
        });

        return Object.values(distribution).sort((a, b) => a.length - b.length);
    }

    /**
     * Extract token patterns
     */
    function extractTokenPatterns(tokenAnalysis) {
        const patterns = {
            byLength: {},
            byCase: {
                uppercase: 0,
                lowercase: 0,
                mixedcase: 0
            },
            byComposition: {
                pureUrdu: 0,
                pureEnglish: 0,
                numeric: 0,
                mixed: 0
            }
        };

        Object.values(tokenAnalysis).forEach(item => {
            // Length patterns
            const lengthCategory = item.length <= 3 ? 'short' : 
                                  item.length <= 7 ? 'medium' : 'long';
            patterns.byLength[lengthCategory] = (patterns.byLength[lengthCategory] || 0) + 1;

            // Case patterns
            if (item.isUpperCase) patterns.byCase.uppercase++;
            else if (item.isLowerCase) patterns.byCase.lowercase++;
            else if (item.isMixedCase) patterns.byCase.mixedcase++;

            // Composition patterns
            if (item.type === TOKEN_TYPES.URDU) patterns.byComposition.pureUrdu++;
            else if (item.type === TOKEN_TYPES.ENGLISH) patterns.byComposition.pureEnglish++;
            else if (item.type === TOKEN_TYPES.NUMERIC) patterns.byComposition.numeric++;
            else patterns.byComposition.mixed++;
        });

        return patterns;
    }

    /**
     * Calculate token statistics
     */
    function calculateTokenStats(tokenAnalysis, typeGroups) {
        const tokens = Object.values(tokenAnalysis);
        const totalTokens = tokens.reduce((sum, t) => sum + t.frequency, 0);
        const uniqueTokens = tokens.length;

        const avgLength = tokens.reduce((sum, t) => sum + (t.length * t.frequency), 0) / totalTokens;
        const maxLength = Math.max(...tokens.map(t => t.length));
        const minLength = Math.min(...tokens.map(t => t.length));

        const typeCounts = {};
        Object.keys(typeGroups).forEach(type => {
            typeCounts[type] = typeGroups[type].reduce((sum, t) => sum + t.frequency, 0);
        });

        return {
            totalTokens: totalTokens,
            uniqueTokens: uniqueTokens,
            typeTokenRatio: ((uniqueTokens / totalTokens) * 100).toFixed(2) + '%',
            averageLength: avgLength.toFixed(2),
            maxLength: maxLength,
            minLength: minLength,
            typeCounts: typeCounts,
            mostCommonType: Object.keys(typeCounts).reduce((a, b) => 
                typeCounts[a] > typeCounts[b] ? a : b, Object.keys(typeCounts)[0])
        };
    }

    /**
     * Render token type results
     */
    function render(container, data) {
        if (!data || !data.statistics) {
            container.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-icon">📊</div>
                    <div class="placeholder-text">No token type data available</div>
                    <div class="placeholder-subtext">Upload files and try again</div>
                </div>
            `;
            return;
        }

        const stats = data.statistics;

        container.innerHTML = `
            <div style="padding: 20px;">
                <!-- Statistics Cards -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #667eea;">Token Type Statistics</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Total Tokens</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.totalTokens.toLocaleString()}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #4daf4a 0%, #2e7d32 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(77, 175, 74, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Unique Tokens</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.uniqueTokens.toLocaleString()}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #ff7f00 0%, #d35400 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(255, 127, 0, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Type-Token Ratio</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.typeTokenRatio}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #e41a1c 0%, #b71c1c 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(228, 26, 28, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Average Length</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.averageLength}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #984ea3 0%, #6a1b9a 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(152, 78, 163, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Max Length</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.maxLength}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #377eb8 0%, #1565c0 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 15px rgba(55, 126, 184, 0.3);">
                            <div style="font-size: 12px; opacity: 0.9;">Min Length</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${stats.minLength}</div>
                        </div>
                    </div>
                </div>

                <!-- Type Distribution Chart -->
                <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 30px;">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #667eea;">Token Type Distribution</h3>
                    <div id="type-distribution-chart" style="width: 100%; height: 400px;"></div>
                </div>

                <!-- Length Distribution Chart -->
                <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 30px;">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #667eea;">Token Length Distribution</h3>
                    <div id="length-distribution-chart" style="width: 100%; height: 400px;"></div>
                </div>

                <!-- Token Type Tables -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    ${renderTypeGroupTables(data.typeGroups)}
                </div>

                <!-- Detailed Token Analysis Table -->
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">Detailed Token Analysis</h3>
                    <div style="overflow-x: auto;">
                        <table class="kwic-table">
                            <thead>
                                <tr>
                                    <th style="width: 8%;">#</th>
                                    <th style="width: 20%;">Token</th>
                                    <th style="width: 12%;">Type</th>
                                    <th style="width: 15%;">Subtype</th>
                                    <th style="width: 10%;">Length</th>
                                    <th style="width: 10%;">Frequency</th>
                                    <th style="width: 25%;">Properties</th>
                                </tr>
                            </thead>
                            <tbody id="token-analysis-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Render charts
        renderTypeDistributionChart(stats.typeCounts);
        renderLengthDistributionChart(data.lengthDistribution);

        // Display detailed analysis
        displayDetailedAnalysis(data.analysis);
    }

    /**
     * Render type group tables
     */
    function renderTypeGroupTables(typeGroups) {
        const typeColors = {
            'urdu': '#667eea',
            'english': '#4daf4a',
            'numeric': '#ff7f00',
            'alphanumeric': '#e41a1c',
            'punctuation': '#984ea3',
            'mixed': '#377eb8',
            'special': '#999999'
        };

        const typeIcons = {
            'urdu': '🔤',
            'english': '🔡',
            'numeric': '🔢',
            'alphanumeric': '🔣',
            'punctuation': '⁉️',
            'mixed': '🌐',
            'special': '✨'
        };

        return Object.entries(typeGroups).map(([type, tokens]) => `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 10px; color: ${typeColors[type] || '#667eea'};">
                    ${typeIcons[type] || '📝'} ${type.toUpperCase()} (${tokens.length})
                </h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    <table style="width: 100%; font-size: 13px;">
                        <thead style="position: sticky; top: 0; background: white;">
                            <tr style="border-bottom: 2px solid #e9ecef;">
                                <th style="text-align: left; padding: 5px;">Token</th>
                                <th style="text-align: center; padding: 5px;">Freq</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tokens.slice(0, 10).map(t => `
                                <tr style="border-bottom: 1px solid #f3f4f6;">
                                    <td style="padding: 5px; font-family: 'Jameel Noori Nastaleeq', Arial, sans-serif; direction: ${type === 'urdu' ? 'rtl' : 'ltr'};">${t.token}</td>
                                    <td style="text-align: center; padding: 5px; font-weight: 600; color: ${typeColors[type] || '#667eea'};">${t.frequency}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render type distribution chart
     */
    function renderTypeDistributionChart(typeCounts) {
        if (!window.d3) return;

        const container = document.getElementById('type-distribution-chart');
        if (!container) return;

        const data = Object.entries(typeCounts).map(([type, count]) => ({
            type: type,
            count: count
        }));

        const width = container.clientWidth;
        const height = 400;
        const margin = {top: 20, right: 30, bottom: 80, left: 60};

        d3.select('#type-distribution-chart').selectAll('*').remove();

        const svg = d3.select('#type-distribution-chart')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const x = d3.scaleBand()
            .domain(data.map(d => d.type))
            .range([margin.left, width - margin.right])
            .padding(0.3);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const colorScale = d3.scaleOrdinal()
            .domain(data.map(d => d.type))
            .range(['#667eea', '#4daf4a', '#ff7f00', '#e41a1c', '#984ea3', '#377eb8', '#999999']);

        // Bars
        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', d => x(d.type))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => height - margin.bottom - y(d.count))
            .attr('fill', d => colorScale(d.type))
            .attr('rx', 4);

        // X axis
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        // Y axis
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        // Labels
        svg.selectAll('.label')
            .data(data)
            .enter()
            .append('text')
            .attr('x', d => x(d.type) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(d => d.count);
    }

    /**
     * Render length distribution chart
     */
    function renderLengthDistributionChart(lengthDistribution) {
        if (!window.d3) return;

        const container = document.getElementById('length-distribution-chart');
        if (!container) return;

        const data = lengthDistribution.slice(0, 20);

        const width = container.clientWidth;
        const height = 400;
        const margin = {top: 20, right: 30, bottom: 60, left: 60};

        d3.select('#length-distribution-chart').selectAll('*').remove();

        const svg = d3.select('#length-distribution-chart')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const x = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.length)])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([height - margin.bottom, margin.top]);

        // Line
        const line = d3.line()
            .x(d => x(d.length))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#667eea')
            .attr('stroke-width', 3)
            .attr('d', line);

        // Points
        svg.selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.length))
            .attr('cy', d => y(d.count))
            .attr('r', 5)
            .attr('fill', '#764ba2');

        // X axis
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x));

        // Y axis
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        // Axis labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .style('text-anchor', 'middle')
            .style('font-size', '14px')
            .text('Token Length');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .style('text-anchor', 'middle')
            .style('font-size', '14px')
            .text('Frequency');
    }

    /**
     * Display detailed analysis
     */
    function displayDetailedAnalysis(analysis) {
        const tbody = document.getElementById('token-analysis-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        const tokens = Object.values(analysis)
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 100);

        tokens.forEach((token, index) => {
            const properties = [];
            if (token.hasUrdu) properties.push('Urdu');
            if (token.hasEnglish) properties.push('English');
            if (token.hasNumeric) properties.push('Numeric');
            if (token.hasPunctuation) properties.push('Punct');

            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="text-align: center;">${index + 1}</td>
                <td style="font-weight: bold; font-family: 'Jameel Noori Nastaleeq', Arial, sans-serif; direction: ${token.type === 'urdu' ? 'rtl' : 'ltr'};">${token.token}</td>
                <td style="text-align: center;"><span style="background: #667eea; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${token.type}</span></td>
                <td style="text-align: center; color: #6c757d; font-size: 12px;">${token.subtype}</td>
                <td style="text-align: center; font-weight: 600;">${token.length}</td>
                <td style="text-align: center; font-weight: 600; color: #667eea;">${token.frequency}</td>
                <td style="font-size: 11px; color: #6c757d;">${properties.join(', ')}</td>
            `;
        });
    }

    // Public API
    return {
        processFiles,
        render
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.tokenTypeModule = tokenTypeModule;
}