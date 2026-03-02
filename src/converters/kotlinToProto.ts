// Kotlin → Proto converter
import type { ProtoFile, ProtoMessage, ProtoField, ProtoVersion } from './protoParser';
import { generateProto } from './protoParser';

export interface KotlinToProtoOptions {
    protoVersion: ProtoVersion;
    packageName: string;
}

const ktToProtoType: Record<string, string> = {
    Int: 'int32', Long: 'int64', Float: 'float', Double: 'double',
    Boolean: 'bool', String: 'string', ByteArray: 'bytes',
    UInt: 'uint32', ULong: 'uint64', Short: 'int32',
    Byte: 'int32', Char: 'int32',
};

export function kotlinToProto(kotlinCode: string, options: KotlinToProtoOptions): string {
    const classes = parseKotlinDataClasses(kotlinCode);
    const file: ProtoFile = {
        syntax: options.protoVersion,
        package: options.packageName || extractPackage(kotlinCode) || 'com.example',
        imports: [],
        options: { java_multiple_files: 'true' },
        messages: classes.map(c => classToMessage(c)),
        enums: parseKotlinEnums(kotlinCode),
        services: [],
    };
    return generateProto(file);
}

function extractPackage(code: string): string {
    const m = code.match(/package\s+([\w.]+)/);
    return m ? m[1] : '';
}

interface KtClass {
    name: string;
    fields: { type: string; name: string; isList: boolean; isMap: boolean; mapKey?: string; mapVal?: string }[];
}

function parseKotlinDataClasses(code: string): KtClass[] {
    const classes: KtClass[] = [];
    const classRegex = /data\s+class\s+(\w+)\s*\(([\s\S]*?)\)/g;
    let m;
    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const params = m[2];
        const fields = parseParams(params);
        if (fields.length > 0) classes.push({ name, fields });
    }
    return classes;
}

function parseParams(params: string): KtClass['fields'] {
    const fields: KtClass['fields'] = [];
    // Split by commas, handling nested generics
    const parts: string[] = [];
    let depth = 0, current = '';
    for (const char of params) {
        if (char === '<') depth++;
        else if (char === '>') depth--;
        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) parts.push(current.trim());

    for (const part of parts) {
        // val/var name: Type = default
        const match = part.match(/(?:val|var)\s+(\w+)\s*:\s*(.+?)(?:\s*=.*)?$/);
        if (!match) continue;
        const name = match[1];
        let type = match[2].trim();

        // Check for List
        const listMatch = type.match(/^(?:List|MutableList|ArrayList)<\s*(.+?)\s*>$/);
        if (listMatch) {
            fields.push({ type: listMatch[1], name, isList: true, isMap: false });
            continue;
        }

        // Check for Map
        const mapMatch = type.match(/^(?:Map|MutableMap|HashMap)<\s*(.+?)\s*,\s*(.+?)\s*>$/);
        if (mapMatch) {
            fields.push({ type, name, isList: false, isMap: true, mapKey: mapMatch[1], mapVal: mapMatch[2] });
            continue;
        }

        // Nullable — strip ?
        type = type.replace(/\?$/, '');
        fields.push({ type, name, isList: false, isMap: false });
    }
    return fields;
}

function parseKotlinEnums(code: string): ProtoFile['enums'] {
    const enums: ProtoFile['enums'] = [];
    const enumRegex = /enum\s+class\s+(\w+)\s*\{([^}]+)\}/g;
    let m;
    while ((m = enumRegex.exec(code)) !== null) {
        const values = m[2].split(',').map(v => v.trim().split('(')[0].replace(/;.*/, '')).filter(Boolean);
        enums.push({
            name: m[1],
            values: values.map((v, i) => ({ name: v, number: i })),
        });
    }
    return enums;
}

function classToMessage(cls: KtClass): ProtoMessage {
    const fields: ProtoField[] = cls.fields.map((f, i) => {
        if (f.isMap && f.mapKey && f.mapVal) {
            return {
                name: toSnakeCase(f.name),
                type: `map<${mapType(f.mapKey)},${mapType(f.mapVal)}>`,
                number: i + 1,
                repeated: false,
                optional: false,
                mapKeyType: mapType(f.mapKey),
                mapValueType: mapType(f.mapVal),
            };
        }
        return {
            name: toSnakeCase(f.name),
            type: mapType(f.type),
            number: i + 1,
            repeated: f.isList,
            optional: false,
        };
    });
    return { name: cls.name, fields, enums: [], nestedMessages: [] };
}

function mapType(ktType: string): string {
    return ktToProtoType[ktType] || ktType.toLowerCase();
}

function toSnakeCase(name: string): string {
    return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}
