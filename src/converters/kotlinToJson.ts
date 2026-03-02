// Kotlin Data Class → JSON converter
import { kotlinTypeToJson } from './typeMapper';

export function kotlinToJson(kotlinStr: string): string {
    const classes = parseKotlinClasses(kotlinStr);
    if (classes.length === 0) return '// Error: No Kotlin data classes found';

    const main = classes[0];
    const obj = buildJsonObject(main, classes);
    return JSON.stringify(obj, null, 2);
}

interface KotlinField {
    name: string;
    type: string;
    serialName?: string;
}

interface KotlinClass {
    name: string;
    fields: KotlinField[];
}

function parseKotlinClasses(code: string): KotlinClass[] {
    const classes: KotlinClass[] = [];
    const classRegex = /(?:data\s+)?class\s+(\w+)\s*\(([\s\S]*?)\)/g;
    let m: RegExpExecArray | null;

    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const paramsBlock = m[2];
        const fields = parseKotlinParams(paramsBlock);
        classes.push({ name, fields });
    }

    return classes;
}

function parseKotlinParams(block: string): KotlinField[] {
    const fields: KotlinField[] = [];
    const lines = block.split('\n');
    let serialName: string | undefined;

    for (const line of lines) {
        const trimmed = line.trim().replace(/,$/, '');
        if (!trimmed) continue;

        const snMatch = trimmed.match(/@SerialName\s*\(\s*"([^"]+)"\s*\)/);
        if (snMatch) {
            serialName = snMatch[1];
            continue;
        }

        const jpMatch = trimmed.match(/@JsonProperty\s*\(\s*"([^"]+)"\s*\)/);
        if (jpMatch) {
            serialName = jpMatch[1];
            continue;
        }

        // Match val/var name: Type
        const fieldMatch = trimmed.replace(/@\w+\s*(?:\([^)]*\)\s*)*/g, '').trim()
            .match(/^(?:val|var)\s+(\w+)\s*:\s*([\w<>?,.\s\[\]]+?)(?:\s*=\s*.*)?$/);
        if (fieldMatch) {
            fields.push({
                name: fieldMatch[1],
                type: fieldMatch[2].trim(),
                serialName,
            });
            serialName = undefined;
        } else if (!trimmed.startsWith('@') && !trimmed.startsWith('//')) {
            serialName = undefined;
        }
    }

    return fields;
}

function buildJsonObject(cls: KotlinClass, allClasses: KotlinClass[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const field of cls.fields) {
        const key = field.serialName || field.name;
        obj[key] = resolveValue(field.type, allClasses);
    }
    return obj;
}

function resolveValue(type: string, allClasses: KotlinClass[]): unknown {
    const cleanType = type.replace(/\?$/, '');

    const listMatch = cleanType.match(/(?:List|Set|MutableList|MutableSet|Collection)<\s*(\w+)\s*>/);
    if (listMatch) {
        const inner = listMatch[1];
        const nested = allClasses.find(c => c.name === inner);
        if (nested) return [buildJsonObject(nested, allClasses)];
        const mapping = kotlinTypeToJson(inner);
        return [mapping.jsonDefault];
    }

    if (/^(?:Map|MutableMap)</.test(cleanType)) return {};

    const nested = allClasses.find(c => c.name === cleanType);
    if (nested) return buildJsonObject(nested, allClasses);

    const mapping = kotlinTypeToJson(cleanType);
    return mapping.jsonDefault;
}
