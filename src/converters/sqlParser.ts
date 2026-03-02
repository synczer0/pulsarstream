// Shared SQL DDL parser — extracts table structure from CREATE TABLE statements

export interface SqlColumn {
    name: string;
    type: string;
    rawType: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isUnique: boolean;
    isAutoIncrement: boolean;
    defaultValue?: string;
    references?: { table: string; column: string };
}

export interface SqlTable {
    name: string;
    columns: SqlColumn[];
    primaryKeys: string[];
    foreignKeys: { column: string; refTable: string; refColumn: string }[];
}

export function parseSqlDDL(sql: string): SqlTable[] {
    const tables: SqlTable[] = [];
    // Match CREATE TABLE blocks
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"\[]?(\w+)[`"\]]?\s*\(([\s\S]*?)\)\s*;?/gi;
    let match: RegExpExecArray | null;

    while ((match = tableRegex.exec(sql)) !== null) {
        const tableName = match[1];
        const body = match[2];
        const table = parseTableBody(tableName, body);
        tables.push(table);
    }

    return tables;
}

function parseTableBody(tableName: string, body: string): SqlTable {
    const columns: SqlColumn[] = [];
    const primaryKeys: string[] = [];
    const foreignKeys: { column: string; refTable: string; refColumn: string }[] = [];

    // Split by commas but respect parentheses
    const lines = splitByTopLevelCommas(body);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for table-level constraints
        const pkMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
            const cols = pkMatch[1].split(',').map(c => c.trim().replace(/[`"\[\]]/g, ''));
            primaryKeys.push(...cols);
            continue;
        }

        const fkMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"\[]?(\w+)[`"\]]?\s*\(([^)]+)\)/i);
        if (fkMatch) {
            foreignKeys.push({
                column: fkMatch[1].trim().replace(/[`"\[\]]/g, ''),
                refTable: fkMatch[2],
                refColumn: fkMatch[3].trim().replace(/[`"\[\]]/g, ''),
            });
            continue;
        }

        // Skip UNIQUE, INDEX, CHECK constraints
        if (/^\s*(UNIQUE|INDEX|KEY|CHECK|CONSTRAINT)\s/i.test(trimmed)) continue;

        // Parse column definition
        const col = parseColumn(trimmed);
        if (col) columns.push(col);
    }

    // Apply table-level PK to columns
    for (const pk of primaryKeys) {
        const col = columns.find(c => c.name.toLowerCase() === pk.toLowerCase());
        if (col) col.isPrimaryKey = true;
    }

    // Apply FK references
    for (const fk of foreignKeys) {
        const col = columns.find(c => c.name.toLowerCase() === fk.column.toLowerCase());
        if (col) col.references = { table: fk.refTable, column: fk.refColumn };
    }

    // If no table-level PK was found, check for inline PKs
    const inlinePks = columns.filter(c => c.isPrimaryKey).map(c => c.name);
    const allPks = [...new Set([...primaryKeys, ...inlinePks])];

    return { name: tableName, columns, primaryKeys: allPks, foreignKeys };
}

function parseColumn(line: string): SqlColumn | null {
    // Column: name type [constraints...]
    const colRegex = /^[`"\[]?(\w+)[`"\]]?\s+(\w+(?:\s*\([^)]*\))?(?:\s+\w+)*)/i;
    const m = line.match(colRegex);
    if (!m) return null;

    const name = m[1];
    const rest = line.substring(name.length).trim();

    // Extract type (first word, possibly with parentheses)
    const typeMatch = rest.match(/^(\w+(?:\s*\([^)]*\))?(?:\s+(?:UNSIGNED|VARYING|PRECISION|WITH(?:\s+TIME)?\s+ZONE|WITHOUT\s+TIME\s+ZONE))*)/i);
    if (!typeMatch) return null;

    const rawType = typeMatch[1].trim();
    const type = rawType.toUpperCase().replace(/\s*\([^)]*\)/, '');
    const afterType = rest.substring(typeMatch[0].length).toUpperCase();

    const isPrimaryKey = /PRIMARY\s+KEY/i.test(afterType);
    const isAutoIncrement = /AUTO_INCREMENT|AUTOINCREMENT|SERIAL|GENERATED|IDENTITY/i.test(afterType) || /^(SMALL)?SERIAL|BIGSERIAL$/i.test(type);
    const nullable = !(/NOT\s+NULL/i.test(afterType)) && !isPrimaryKey;
    const isUnique = /UNIQUE/i.test(afterType);

    const defaultMatch = afterType.match(/DEFAULT\s+('(?:[^']*)'|[^\s,]+)/i);
    const defaultValue = defaultMatch ? defaultMatch[1].replace(/'/g, '') : undefined;

    const refMatch = afterType.match(/REFERENCES\s+[`"\[]?(\w+)[`"\]]?\s*\(([^)]+)\)/i);
    const references = refMatch ? { table: refMatch[1], column: refMatch[2].trim().replace(/[`"\[\]]/g, '') } : undefined;

    return { name, type, rawType, nullable, isPrimaryKey, isUnique, isAutoIncrement, defaultValue, references };
}

function splitByTopLevelCommas(text: string): string[] {
    const results: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of text) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (char === ',' && depth === 0) {
            results.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) results.push(current);
    return results;
}
