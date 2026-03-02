// Java → Proto converter
import type { ProtoFile, ProtoMessage, ProtoField, ProtoVersion } from './protoParser';
import { generateProto } from './protoParser';

export interface JavaToProtoOptions {
    protoVersion: ProtoVersion;
    packageName: string;
}

const javaToProtoType: Record<string, string> = {
    int: 'int32', long: 'int64', float: 'float', double: 'double',
    boolean: 'bool', String: 'string', 'byte[]': 'bytes',
    Integer: 'int32', Long: 'int64', Float: 'float', Double: 'double',
    Boolean: 'bool', short: 'int32', Short: 'int32', char: 'int32',
    Character: 'int32', BigDecimal: 'string', BigInteger: 'string',
    Date: 'int64', Instant: 'int64', LocalDate: 'string',
    LocalDateTime: 'string', UUID: 'string',
};

export function javaToProto(javaCode: string, options: JavaToProtoOptions): string {
    const classes = parseJavaClasses(javaCode);
    const file: ProtoFile = {
        syntax: options.protoVersion,
        package: options.packageName || extractPackage(javaCode) || 'com.example',
        imports: [],
        options: { java_multiple_files: 'true' },
        messages: classes.map(c => classToMessage(c)),
        enums: parseJavaEnums(javaCode),
        services: [],
    };
    return generateProto(file);
}

interface JavaClass {
    name: string;
    fields: { type: string; name: string; isList: boolean; isMap: boolean; mapKey?: string; mapVal?: string }[];
}

function extractPackage(code: string): string {
    const m = code.match(/package\s+([\w.]+)\s*;/);
    return m ? m[1] : '';
}

function parseJavaClasses(code: string): JavaClass[] {
    const classes: JavaClass[] = [];
    const classRegex = /(?:public\s+)?(?:record|class)\s+(\w+)[\s\S]*?\{/g;
    let m;
    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const body = extractBody(code, m.index + m[0].length - 1);
        const fields = extractJavaFields(body);
        if (fields.length > 0) classes.push({ name, fields });
    }
    return classes;
}

function extractBody(text: string, openIdx: number): string {
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) return text.substring(openIdx + 1, i); }
    }
    return text.substring(openIdx + 1);
}

function extractJavaFields(body: string): JavaClass['fields'] {
    const fields: JavaClass['fields'] = [];
    // Match private/protected/public fields or record components
    const fieldRegex = /(?:private|protected|public)\s+(?:final\s+)?(?:(?:List|ArrayList)<\s*(\w+)\s*>|(?:Map|HashMap)<\s*(\w+)\s*,\s*(\w+)\s*>|(\w[\w.<>[\]]*?))\s+(\w+)\s*[;=,)]/g;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
        if (m[1]) {
            fields.push({ type: m[1], name: m[5], isList: true, isMap: false });
        } else if (m[2] && m[3]) {
            fields.push({ type: `map<${m[2]},${m[3]}>`, name: m[5], isList: false, isMap: true, mapKey: m[2], mapVal: m[3] });
        } else {
            fields.push({ type: m[4], name: m[5], isList: false, isMap: false });
        }
    }
    return fields;
}

function parseJavaEnums(code: string): ProtoFile['enums'] {
    const enums: ProtoFile['enums'] = [];
    const enumRegex = /(?:public\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g;
    let m;
    while ((m = enumRegex.exec(code)) !== null) {
        const values = m[2].split(',').map(v => v.trim().replace(/;.*/, '')).filter(Boolean);
        enums.push({
            name: m[1],
            values: values.map((v, i) => ({ name: v.split('(')[0].trim(), number: i })),
        });
    }
    return enums;
}

function classToMessage(cls: JavaClass): ProtoMessage {
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

function mapType(javaType: string): string {
    return javaToProtoType[javaType] || toSnakeCase(javaType).replace(/_/g, '');
}

function toSnakeCase(name: string): string {
    return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}
