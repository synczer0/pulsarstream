import { type JavaVersion, jsonTypeToJava } from './typeMapper';

export interface JsonToJavaOptions {
    className: string;
    packageName: string;
    javaVersion: JavaVersion;
    useLombok: boolean;
    useJackson: boolean;
    useRecords: boolean; // Java 16+
    generateGettersSetters: boolean;
}

const defaults: JsonToJavaOptions = {
    className: 'MyClass',
    packageName: '',
    javaVersion: '21',
    useLombok: true,
    useJackson: true,
    useRecords: false,
    generateGettersSetters: true,
};

function toPascalCase(s: string): string {
    return s.replace(/(^|[_\-\s])(\w)/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(s: string): string {
    const p = toPascalCase(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
}

interface NestedClass {
    name: string;
    code: string;
}

export function jsonToJava(jsonStr: string, opts?: Partial<JsonToJavaOptions>): string {
    const o = { ...defaults, ...opts };
    const javaVer = parseInt(o.javaVersion);
    const useRecords = o.useRecords && javaVer >= 16;

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        return '// Error: Invalid JSON input';
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return '// Error: JSON root must be an object';
    }

    const nested: NestedClass[] = [];
    const code = generateClass(parsed as Record<string, unknown>, o.className, o, useRecords, nested, 0);

    const lines: string[] = [];

    if (o.packageName) lines.push(`package ${o.packageName};`, '');

    // Collect imports
    const imports = new Set<string>();
    if (o.useLombok && !useRecords) imports.add('import lombok.Data;');
    if (o.useJackson) imports.add('import com.fasterxml.jackson.annotation.JsonProperty;');

    const fullCode = code + nested.map(n => '\n\n' + n.code).join('');
    if (fullCode.includes('List<')) imports.add('import java.util.List;');
    if (fullCode.includes('Map<')) imports.add('import java.util.Map;');
    if (fullCode.includes('BigDecimal')) imports.add('import java.math.BigDecimal;');
    if (fullCode.includes('LocalDate;') || fullCode.includes('LocalDate ')) imports.add('import java.time.LocalDate;');
    if (fullCode.includes('LocalDateTime')) imports.add('import java.time.LocalDateTime;');

    if (imports.size) {
        lines.push(...Array.from(imports).sort(), '');
    }

    lines.push(code);
    nested.forEach(n => { lines.push('', n.code); });

    return lines.join('\n');
}

function generateClass(
    obj: Record<string, unknown>,
    className: string,
    opts: JsonToJavaOptions,
    useRecords: boolean,
    nested: NestedClass[],
    depth: number
): string {
    const indent = '    ';
    const entries = Object.entries(obj);

    if (useRecords) {
        // Generate record
        const params = entries.map(([key, value]) => {
            const { type } = resolveJavaType(key, value, nested, opts, depth);
            const fieldName = toCamelCase(key);
            const annotations: string[] = [];
            if (opts.useJackson && key !== fieldName) {
                annotations.push(`${indent}@JsonProperty("${key}")`);
            }
            return { annotations, declaration: `${indent}${type} ${fieldName}` };
        });

        const lines: string[] = [];
        lines.push(`public record ${className}(`);
        params.forEach((p, i) => {
            p.annotations.forEach(a => lines.push(a));
            lines.push(p.declaration + (i < params.length - 1 ? ',' : ''));
        });
        lines.push(') {}');
        return lines.join('\n');
    }

    // Generate class
    const lines: string[] = [];
    if (opts.useLombok) lines.push('@Data');
    lines.push(`public class ${className} {`);

    const fields: { javaType: string; name: string; key: string }[] = [];
    for (const [key, value] of entries) {
        const { type } = resolveJavaType(key, value, nested, opts, depth);
        const fieldName = toCamelCase(key);
        fields.push({ javaType: type, name: fieldName, key });

        if (opts.useJackson && key !== fieldName) {
            lines.push(`${indent}@JsonProperty("${key}")`);
        }
        lines.push(`${indent}private ${type} ${fieldName};`);
        lines.push('');
    }

    if (opts.generateGettersSetters && !opts.useLombok) {
        for (const f of fields) {
            const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
            const getter = f.javaType === 'boolean' ? 'is' : 'get';
            lines.push(`${indent}public ${f.javaType} ${getter}${cap}() {`);
            lines.push(`${indent}${indent}return this.${f.name};`);
            lines.push(`${indent}}`);
            lines.push('');
            lines.push(`${indent}public void set${cap}(${f.javaType} ${f.name}) {`);
            lines.push(`${indent}${indent}this.${f.name} = ${f.name};`);
            lines.push(`${indent}}`);
            lines.push('');
        }
    }

    lines.push('}');
    return lines.join('\n');
}

function resolveJavaType(
    key: string,
    value: unknown,
    nested: NestedClass[],
    opts: JsonToJavaOptions,
    depth: number
): { type: string; nestedName?: string } {
    if (value === null || value === undefined) return { type: 'Object' };

    if (typeof value === 'object' && !Array.isArray(value)) {
        const nestedName = toPascalCase(key);
        const useRecords = opts.useRecords && parseInt(opts.javaVersion) >= 16;
        const code = generateClass(value as Record<string, unknown>, nestedName, opts, useRecords, nested, depth + 1);
        nested.push({ name: nestedName, code });
        return { type: nestedName, nestedName };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return { type: 'List<Object>' };
        const first = value[0];
        if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
            const nestedName = toPascalCase(key);
            const useRecords = opts.useRecords && parseInt(opts.javaVersion) >= 16;
            const code = generateClass(first as Record<string, unknown>, nestedName, opts, useRecords, nested, depth + 1);
            nested.push({ name: nestedName, code });
            return { type: `List<${nestedName}>`, nestedName };
        }
        const innerType = jsonTypeToJava(first);
        const boxed = boxJavaType(innerType);
        return { type: `List<${boxed}>` };
    }

    return { type: jsonTypeToJava(value) };
}

function boxJavaType(t: string): string {
    const map: Record<string, string> = {
        'int': 'Integer', 'long': 'Long', 'double': 'Double',
        'float': 'Float', 'boolean': 'Boolean', 'short': 'Short', 'byte': 'Byte',
    };
    return map[t] || t;
}
