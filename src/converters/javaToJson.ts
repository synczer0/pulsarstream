// Java Class → JSON converter
import { javaTypeToJson } from './typeMapper';

export function javaToJson(javaStr: string): string {
    const classes = parseJavaClasses(javaStr);
    if (classes.length === 0) return '// Error: No Java classes found';

    // Generate JSON for the first/main class
    const main = classes[0];
    const obj = buildJsonObject(main, classes);
    return JSON.stringify(obj, null, 2);
}

interface JavaField {
    type: string;
    name: string;
    jsonPropertyName?: string;
}

interface JavaClass {
    name: string;
    fields: JavaField[];
}

function parseJavaClasses(code: string): JavaClass[] {
    const classes: JavaClass[] = [];
    // Match class/record declarations
    const classRegex = /(?:public\s+)?(?:class|record)\s+(\w+)\s*(?:extends\s+\w+\s*)?(?:implements\s+[\w\s,]+\s*)?\{/g;
    let classMatch: RegExpExecArray | null;

    while ((classMatch = classRegex.exec(code)) !== null) {
        const name = classMatch[1];
        const startIdx = classMatch.index + classMatch[0].length;
        const body = extractBody(code, startIdx);
        const fields = extractJavaFields(body);
        classes.push({ name, fields });
    }

    // Also handle record parameters
    const recordRegex = /(?:public\s+)?record\s+(\w+)\s*\(([^)]*)\)/g;
    let recordMatch: RegExpExecArray | null;
    while ((recordMatch = recordRegex.exec(code)) !== null) {
        const name = recordMatch[1];
        // Check if already parsed via class regex
        if (classes.find(c => c.name === name)) continue;
        const params = recordMatch[2];
        const fields = parseRecordParams(params);
        classes.push({ name, fields });
    }

    return classes;
}

function extractBody(code: string, startIdx: number): string {
    let depth = 1;
    let i = startIdx;
    while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        i++;
    }
    return code.substring(startIdx, i - 1);
}

function extractJavaFields(body: string): JavaField[] {
    const fields: JavaField[] = [];
    const lines = body.split('\n');
    let jsonPropertyName: string | undefined;

    for (const line of lines) {
        const trimmed = line.trim();

        // Check for @JsonProperty annotation
        const jpMatch = trimmed.match(/@JsonProperty\s*\(\s*"([^"]+)"\s*\)/);
        if (jpMatch) {
            jsonPropertyName = jpMatch[1];
            continue;
        }

        // Match field declaration: [modifiers] Type name;
        const fieldMatch = trimmed.match(/^(?:private|protected|public)?\s*(?:static\s+)?(?:final\s+)?([\w<>\[\]?,\s]+?)\s+(\w+)\s*[;=]/);
        if (fieldMatch) {
            const type = fieldMatch[1].trim();
            const name = fieldMatch[2];
            // Skip methods, constructors
            if (['void', 'class', 'interface', 'enum'].includes(type)) continue;
            fields.push({ type, name, jsonPropertyName });
            jsonPropertyName = undefined;
        } else {
            // Reset jsonPropertyName if line is not a field
            if (!trimmed.startsWith('@') && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && trimmed.length > 0) {
                jsonPropertyName = undefined;
            }
        }
    }

    return fields;
}

function parseRecordParams(params: string): JavaField[] {
    const fields: JavaField[] = [];
    const parts = params.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // Remove annotations
        const cleaned = trimmed.replace(/@\w+\s*(?:\([^)]*\)\s*)?/g, '').trim();
        const match = cleaned.match(/([\w<>\[\]?,\s]+?)\s+(\w+)$/);
        if (match) {
            const jpMatch = trimmed.match(/@JsonProperty\s*\(\s*"([^"]+)"\s*\)/);
            fields.push({ type: match[1].trim(), name: match[2], jsonPropertyName: jpMatch?.[1] });
        }
    }
    return fields;
}

function buildJsonObject(cls: JavaClass, allClasses: JavaClass[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const field of cls.fields) {
        const key = field.jsonPropertyName || field.name;
        obj[key] = resolveValue(field.type, allClasses);
    }
    return obj;
}

function resolveValue(type: string, allClasses: JavaClass[]): unknown {
    // Check if it's a List/Collection
    const listMatch = type.match(/(?:List|Set|Collection|ArrayList|HashSet)<\s*(\w+)\s*>/);
    if (listMatch) {
        const inner = listMatch[1];
        const nested = allClasses.find(c => c.name === inner);
        if (nested) return [buildJsonObject(nested, allClasses)];
        const mapping = javaTypeToJson(inner);
        return [mapping.jsonDefault];
    }

    // Check if it's a Map
    if (/^Map</.test(type)) return {};

    // Check if it's a nested class
    const nested = allClasses.find(c => c.name === type);
    if (nested) return buildJsonObject(nested, allClasses);

    // Primitive/known type
    const mapping = javaTypeToJson(type);
    return mapping.jsonDefault;
}
