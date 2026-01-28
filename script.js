// Theme toggle
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved theme preference on page load
(function() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
})();

// State
let files = { a: null, b: null };
let fileNames = { a: '', b: '' };
let differences = [];
let sortState = {};

function handleFileSelect(input, key) {
  const file = input.files[0];
  const group = document.getElementById(`group-${key}`);
  const nameEl = document.getElementById(`name-${key}`);
  
  if (file) {
    files[key] = file;
    fileNames[key] = file.name;
    nameEl.textContent = file.name;
    group.classList.add('has-file');
  } else {
    files[key] = null;
    fileNames[key] = '';
    nameEl.textContent = 'No file selected';
    group.classList.remove('has-file');
  }
  
  updateCompareButton();
}

function updateCompareButton() {
  const btn = document.getElementById('btn-compare');
  btn.disabled = !(files.a && files.b);
}

function showError(message) {
  const el = document.getElementById('error-msg');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(new Error(`Invalid JSON in ${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

// Deep comparison utilities
function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

const MAX_DISPLAY_LENGTH = 80;

function formatValue(value, maxLength = 500) {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  
  const type = getType(value);
  
  if (type === 'array') {
    if (value.length === 0) return '[]';
    const str = JSON.stringify(value, null, 2);
    return str;
  }
  
  if (type === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const str = JSON.stringify(value, null, 2);
    return str;
  }
  
  if (type === 'string') {
    return `"${value}"`;
  }
  
  return String(value);
}

function formatValueForDisplay(value) {
  const fullValue = formatValue(value);
  
  if (fullValue === '—') {
    return { display: '—', isTruncated: false, fullValue: fullValue };
  }
  
  if (fullValue.length > MAX_DISPLAY_LENGTH) {
    const truncated = fullValue.substring(0, MAX_DISPLAY_LENGTH) + '...';
    return { display: truncated, isTruncated: true, fullValue: fullValue };
  }
  
  return { display: fullValue, isTruncated: false, fullValue: fullValue };
}

function showPopup(title, content) {
  // Remove existing popup if any
  const existingPopup = document.querySelector('.popup-overlay');
  if (existingPopup) existingPopup.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="popup-close" onclick="closePopup()">&times;</button>
      </div>
      <div class="popup-body">${escapeHtml(content)}</div>
    </div>
  `;
  
  // Close when clicking overlay (but not popup content)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });
  
  document.body.appendChild(overlay);
  
  // Close on Escape key
  document.addEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') closePopup();
}

function closePopup() {
  const popup = document.querySelector('.popup-overlay');
  if (popup) popup.remove();
  document.removeEventListener('keydown', handleEscapeKey);
}

function generateDescription(type, path, valueA, valueB) {
  const pathParts = path.split('.');
  const lastPart = pathParts[pathParts.length - 1];
  const cleanLastPart = lastPart.replace(/\[\d+\]/g, '');
  
  if (type === 'added') {
    return `Property "${cleanLastPart}" was added`;
  }
  
  if (type === 'removed') {
    return `Property "${cleanLastPart}" was removed`;
  }
  
  if (type === 'changed') {
    const typeA = getType(valueA);
    const typeB = getType(valueB);
    
    if (typeA !== typeB) {
      return `Type changed from ${typeA} to ${typeB}`;
    }
    
    if (typeA === 'string' || typeA === 'number' || typeA === 'boolean') {
      return `Value changed from ${formatValue(valueA, 30)} to ${formatValue(valueB, 30)}`;
    }
    
    return `"${cleanLastPart}" was modified`;
  }
  
  return 'Unknown change';
}

function deepCompare(objA, objB, path = '', results = []) {
  const typeA = getType(objA);
  const typeB = getType(objB);
  
  // Different types
  if (typeA !== typeB) {
    results.push({
      type: 'changed',
      path: path || 'root',
      valueA: objA,
      valueB: objB,
      description: generateDescription('changed', path || 'root', objA, objB)
    });
    return results;
  }
  
  // Both are arrays
  if (typeA === 'array') {
    const hasIds = objA.some(item => item && (item.id || item.dataRef)) && 
                   objB.some(item => item && (item.id || item.dataRef));
    
    if (hasIds) {
      compareArraysByKey(objA, objB, path, results);
    } else {
      const maxLen = Math.max(objA.length, objB.length);
      for (let i = 0; i < maxLen; i++) {
        const itemPath = `${path}[${i}]`;
        if (i >= objA.length) {
          results.push({
            type: 'added',
            path: itemPath,
            valueA: undefined,
            valueB: objB[i],
            description: generateDescription('added', itemPath, undefined, objB[i])
          });
        } else if (i >= objB.length) {
          results.push({
            type: 'removed',
            path: itemPath,
            valueA: objA[i],
            valueB: undefined,
            description: generateDescription('removed', itemPath, objA[i], undefined)
          });
        } else {
          deepCompare(objA[i], objB[i], itemPath, results);
        }
      }
    }
    return results;
  }
  
  // Both are objects
  if (typeA === 'object') {
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      const hasA = key in objA;
      const hasB = key in objB;
      
      if (!hasA && hasB) {
        results.push({
          type: 'added',
          path: newPath,
          valueA: undefined,
          valueB: objB[key],
          description: generateDescription('added', newPath, undefined, objB[key])
        });
      } else if (hasA && !hasB) {
        results.push({
          type: 'removed',
          path: newPath,
          valueA: objA[key],
          valueB: undefined,
          description: generateDescription('removed', newPath, objA[key], undefined)
        });
      } else {
        deepCompare(objA[key], objB[key], newPath, results);
      }
    }
    return results;
  }
  
  // Primitives - direct comparison
  if (objA !== objB) {
    results.push({
      type: 'changed',
      path: path || 'root',
      valueA: objA,
      valueB: objB,
      description: generateDescription('changed', path || 'root', objA, objB)
    });
  }
  
  return results;
}

function compareArraysByKey(arrA, arrB, path, results) {
  const getKey = (item) => {
    if (!item || typeof item !== 'object') return null;
    return item.id || item.dataRef || null;
  };
  
  const mapA = new Map();
  const mapB = new Map();
  const indexMapA = new Map();
  const indexMapB = new Map();
  
  arrA.forEach((item, index) => {
    const key = getKey(item);
    if (key) {
      mapA.set(key, item);
      indexMapA.set(key, index);
    }
  });
  
  arrB.forEach((item, index) => {
    const key = getKey(item);
    if (key) {
      mapB.set(key, item);
      indexMapB.set(key, index);
    }
  });
  
  // Items only in A (removed)
  for (const [key, item] of mapA) {
    if (!mapB.has(key)) {
      const idx = indexMapA.get(key);
      const itemPath = `${path}[${idx}]`;
      const keyProp = item.id ? 'id' : 'dataRef';
      results.push({
        type: 'removed',
        path: itemPath,
        valueA: item,
        valueB: undefined,
        description: `Array item with ${keyProp}="${key}" was removed`
      });
    }
  }
  
  // Items only in B (added)
  for (const [key, item] of mapB) {
    if (!mapA.has(key)) {
      const idx = indexMapB.get(key);
      const itemPath = `${path}[${idx}]`;
      const keyProp = item.id ? 'id' : 'dataRef';
      results.push({
        type: 'added',
        path: itemPath,
        valueA: undefined,
        valueB: item,
        description: `Array item with ${keyProp}="${key}" was added`
      });
    }
  }
  
  // Items in both - compare deeply
  for (const [key, itemA] of mapA) {
    if (mapB.has(key)) {
      const itemB = mapB.get(key);
      const idxA = indexMapA.get(key);
      const itemPath = `${path}[${idxA}]`;
      deepCompare(itemA, itemB, itemPath, results);
    }
  }
  
  // Handle items without keys by index
  const unkeyed_A = arrA.filter((item) => !getKey(item));
  const unkeyed_B = arrB.filter((item) => !getKey(item));
  
  const maxUnkeyed = Math.max(unkeyed_A.length, unkeyed_B.length);
  for (let i = 0; i < maxUnkeyed; i++) {
    const itemPath = `${path}[unkeyed:${i}]`;
    if (i >= unkeyed_A.length) {
      results.push({
        type: 'added',
        path: itemPath,
        valueA: undefined,
        valueB: unkeyed_B[i],
        description: `Unkeyed array item was added`
      });
    } else if (i >= unkeyed_B.length) {
      results.push({
        type: 'removed',
        path: itemPath,
        valueA: unkeyed_A[i],
        valueB: undefined,
        description: `Unkeyed array item was removed`
      });
    } else {
      deepCompare(unkeyed_A[i], unkeyed_B[i], itemPath, results);
    }
  }
}

async function compareFiles() {
  const errorEl = document.getElementById('error-msg');
  errorEl.style.display = 'none';
  
  try {
    const [dataA, dataB] = await Promise.all([
      readFile(files.a),
      readFile(files.b)
    ]);
    
    // Perform deep comparison
    differences = deepCompare(dataA, dataB, '', []);
    
    // Count by type
    const counts = {
      added: differences.filter(d => d.type === 'added').length,
      removed: differences.filter(d => d.type === 'removed').length,
      changed: differences.filter(d => d.type === 'changed').length
    };
    
    // Update UI stats
    document.getElementById('stat-added').textContent = counts.added;
    document.getElementById('stat-removed').textContent = counts.removed;
    document.getElementById('stat-changed').textContent = counts.changed;
    
    // Update file name headers
    const thA = document.getElementById('th-a');
    const thB = document.getElementById('th-b');
    thA.textContent = `Value in A`;
    thA.title = fileNames.a;
    thB.textContent = `Value in B`;
    thB.title = fileNames.b;
    
    renderTable();
    
    document.getElementById('results').style.display = 'block';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    
  } catch (err) {
    showError(err.message);
  }
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  const searchText = document.getElementById('search').value.toLowerCase();
  const showAdded = document.getElementById('filter-added').checked;
  const showRemoved = document.getElementById('filter-removed').checked;
  const showChanged = document.getElementById('filter-changed').checked;
  
  let html = '';
  let visibleCount = 0;
  
  for (let i = 0; i < differences.length; i++) {
    const diff = differences[i];
    
    // Filter by type
    if (diff.type === 'added' && !showAdded) continue;
    if (diff.type === 'removed' && !showRemoved) continue;
    if (diff.type === 'changed' && !showChanged) continue;
    
    // Filter by search text
    const rowText = `${diff.path} ${diff.description}`.toLowerCase();
    if (searchText && !rowText.includes(searchText)) continue;
    
    visibleCount++;
    
    const typeLabel = diff.type.charAt(0).toUpperCase() + diff.type.slice(1);
    const valueAFormatted = formatValueForDisplay(diff.valueA);
    const valueBFormatted = formatValueForDisplay(diff.valueB);
    
    let valueAClass = 'value-cell';
    let valueBClass = 'value-cell';
    
    if (diff.type === 'removed') {
      valueBClass += ' value-na';
    } else if (diff.type === 'added') {
      valueAClass += ' value-na';
    }
    
    // Build value A cell content
    let valueACellContent;
    if (valueAFormatted.display === '—') {
      valueACellContent = `<span class="value-na">—</span>`;
    } else if (valueAFormatted.isTruncated) {
      valueACellContent = `
        <div class="value-truncated">
          <span class="value-preview">${escapeHtml(valueAFormatted.display)}</span>
          <span class="see-more-link" onclick="showPopup('Value in File A', differences[${i}].valueA !== undefined ? formatValue(differences[${i}].valueA) : '—')">See more</span>
        </div>
      `;
    } else {
      valueACellContent = escapeHtml(valueAFormatted.display);
    }
    
    // Build value B cell content
    let valueBCellContent;
    if (valueBFormatted.display === '—') {
      valueBCellContent = `<span class="value-na">—</span>`;
    } else if (valueBFormatted.isTruncated) {
      valueBCellContent = `
        <div class="value-truncated">
          <span class="value-preview">${escapeHtml(valueBFormatted.display)}</span>
          <span class="see-more-link" onclick="showPopup('Value in File B', differences[${i}].valueB !== undefined ? formatValue(differences[${i}].valueB) : '—')">See more</span>
        </div>
      `;
    } else {
      valueBCellContent = escapeHtml(valueBFormatted.display);
    }
    
    html += `
      <tr data-type="${diff.type}">
        <td class="status-${diff.type}">${typeLabel}</td>
        <td title="${escapeHtml(diff.path)}">${escapeHtml(diff.path)}</td>
        <td>${escapeHtml(diff.description)}</td>
        <td class="${valueAClass}">${valueACellContent}</td>
        <td class="${valueBClass}">${valueBCellContent}</td>
      </tr>
    `;
  }
  
  if (visibleCount === 0) {
    if (differences.length === 0) {
      html = `<tr><td colspan="5" class="no-results">No differences found - the files are identical!</td></tr>`;
    } else {
      html = `<tr><td colspan="5" class="no-results">No results match your filters</td></tr>`;
    }
  }
  
  tbody.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function applyFilters() {
  renderTable();
}

function sortTable(colIndex) {
  const key = colIndex;
  sortState[key] = !sortState[key];
  const ascending = sortState[key];
  
  const getVal = (row) => {
    switch(colIndex) {
      case 0: return row.type;
      case 1: return row.path;
      case 2: return row.description;
      default: return '';
    }
  };
  
  differences.sort((a, b) => {
    const av = getVal(a);
    const bv = getVal(b);
    return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  
  // Update header styling
  document.querySelectorAll('th').forEach((th) => {
    th.classList.remove('active');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.remove();
  });
  
  const headers = document.querySelectorAll('th');
  const targetHeader = headers[colIndex];
  if (targetHeader) {
    targetHeader.classList.add('active');
    
    const arrow = document.createElement('span');
    arrow.className = 'sort-arrow';
    arrow.textContent = ascending ? ' ▲' : ' ▼';
    targetHeader.appendChild(arrow);
  }
  
  renderTable();
}

function downloadCSV() {
  const searchText = document.getElementById('search').value.toLowerCase();
  const showAdded = document.getElementById('filter-added').checked;
  const showRemoved = document.getElementById('filter-removed').checked;
  const showChanged = document.getElementById('filter-changed').checked;
  
  const headers = ['Type', 'Path', 'Description', `Value in ${fileNames.a}`, `Value in ${fileNames.b}`];
  const rows = [headers];
  
  for (const diff of differences) {
    if (diff.type === 'added' && !showAdded) continue;
    if (diff.type === 'removed' && !showRemoved) continue;
    if (diff.type === 'changed' && !showChanged) continue;
    
    const rowText = `${diff.path} ${diff.description}`.toLowerCase();
    if (searchText && !rowText.includes(searchText)) continue;
    
    const typeLabel = diff.type.charAt(0).toUpperCase() + diff.type.slice(1);
    const valueAStr = formatValue(diff.valueA, 500);
    const valueBStr = formatValue(diff.valueB, 500);
    
    rows.push([typeLabel, diff.path, diff.description, valueAStr, valueBStr]);
  }
  
  const csv = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'form_comparison.csv';
  a.click();
  URL.revokeObjectURL(url);
}
