# Form Comparator

A web-based tool for comparing JSON form schemas and identifying differences between two configuration files. Built for internal use at Axon.

## Features

- **Deep JSON Comparison**: Recursively compares nested objects and arrays to find all differences
- **Smart Array Matching**: When arrays contain items with `id` or `dataRef` properties, items are matched by those keys rather than just index position
- **Three Difference Types**:
  - **Added** (green): Property exists in File B but not in File A
  - **Removed** (red): Property exists in File A but not in File B
  - **Changed** (yellow): Property exists in both but has different values
- **Human-Readable Descriptions**: Each difference includes a plain-language description of what changed
- **Full Path Tracking**: Shows the complete JSON path to each difference (e.g., `viewSchema.fields[0].options.COLLISION.deprecatedOn`)
- **Filtering**: Filter results by difference type (Added/Removed/Changed)
- **Search**: Search across paths and descriptions to find specific changes
- **Sortable Columns**: Click column headers to sort by Type, Path, or Description
- **Expandable Values**: Long values are truncated with a "See more" link that opens a popup with the full content
- **CSV Export**: Download filtered results as a CSV file
- **Dark/Light Mode**: Toggle between dark and light themes (preference saved locally)

## Usage

1. Open `index.html` in a web browser
2. Select **File A (Base)** - this is your reference/original file
3. Select **File B (Compare)** - this is the file to compare against File A
4. Click **Compare Files**
5. Review the differences in the results table

## Results Table

| Column | Description |
|--------|-------------|
| Type | The type of difference: Added, Removed, or Changed |
| Path | The JSON path to the property that differs |
| Description | A human-readable description of the change |
| Value in A | The value in File A (or "—" if not present) |
| Value in B | The value in File B (or "—" if not present) |

## Supported JSON Structures

The tool works with any valid JSON files. It is optimized for form schema JSON files that use:
- Nested `fields` arrays
- Objects with `id` or `dataRef` properties for identification
- Complex nested option objects

## Browser Compatibility

Works in all modern browsers:
- Chrome
- Firefox
- Edge
- Safari

## Notes

- All processing happens locally in the browser - no data is sent to any server
- Large files (50,000+ lines) may take a few seconds to process
- The comparison is case-sensitive and whitespace-sensitive

---

*For Internal Use Only*
