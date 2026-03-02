// JSON → Kotlin Data Class converter
import { type KotlinVersion, jsonTypeToKotlin } from './typeMapper';

export interface JsonToKotlinOptions {
    className: string;
    packageName: string;
    kotlinVersion: KotlinVersion;
    useKotlinxSerialization: boolean;
    useJackson: boolean;
    useNullableForOptional: boolean;
}

const defaults: JsonToKotlinOptions = {
    className: 'MyClass',
    packageName: '',
    kotlinVersion: '2.1',
    useKotlinxSerialization: true,
    useJackson: false,
    useNullableForOptional: false,
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

export function jsonToKotlin(jsonStr: string, opts?: Partial<JsonToKotlinOptions>): string {
    const o = { ...defaults, ...opts };
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
    const code = generateDataClass(parsed as Record<string, unknown>, o.className, o, nested);

    const lines: string[] = [];
    if (o.packageName) lines.push(`package ${o.packageName}`, '');

    const imports = new Set<string>();
    if (o.useKotlinxSerialization) {
        imports.add('import kotlinx.serialization.Serializable');
        imports.add('import kotlinx.serialization.SerialName');
    }
    if (o.useJackson) {
        imports.add('import com.fasterxml.jackson.annotation.JsonProperty');
    }

    if (imports.size) lines.push(...Array.from(imports).sort(), '');

    lines.push(code);
    nested.forEach(n => { lines.push('', n.code); });

    return lines.join('\n');
}

function generateDataClass(
    obj: Record<string, unknown>,
    className: string,
    opts: JsonToKotlinOptions,
    nested: NestedClass[]
): string {
    const entries = Object.entries(obj);
    const lines: string[] = [];

    if (opts.useKotlinxSerialization) lines.push('@Serializable');
    lines.push(`data class ${className}(`);

    entries.forEach(([key, value], i) => {
        const { type } = resolveKotlinType(key, value, nested, opts);
        const fieldName = toCamelCase(key);
        const comma = i < entries.length - 1 ? ',' : '';
        const annotations: string[] = [];

        if (opts.useKotlinxSerialization && key !== fieldName) {
            annotations.push(`    @SerialName("${key}")`);
        }
        if (opts.useJackson && key !== fieldName) {
            annotations.push(`    @JsonProperty("${key}")`);
        }

        annotations.forEach(a => lines.push(a));
        const nullable = value === null || (opts.useNullableForOptional && value === undefined);
        const nullSuffix = nullable ? '?' : '';
        const defaultVal = nullable ? ' = null' : '';
        lines.push(`    val ${fieldName}: ${type}${nullSuffix}${defaultVal}${comma}`);
    });

    lines.push(')');
    return lines.join('\n');
}

function resolveKotlinType(
    key: string,
    value: unknown,
    nested: NestedClass[],
    opts: JsonToKotlinOptions
): { type: string } {
    if (value === null || value === undefined) return { type: 'Any' };

    if (typeof value === 'object' && !Array.isArray(value)) {
        const nestedName = toPascalCase(key);
        const code = generateDataClass(value as Record<string, unknown>, nestedName, opts, nested);
        nested.push({ name: nestedName, code });
        return { type: nestedName };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return { type: 'List<Any>' };
        const first = value[0];
        if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
            const nestedName = toPascalCase(key);
            const code = generateDataClass(first as Record<string, unknown>, nestedName, opts, nested);
            nested.push({ name: nestedName, code });
            return { type: `List<${nestedName}>` };
        }
        return { type: `List<${jsonTypeToKotlin(first)}>` };
    }

    return { type: jsonTypeToKotlin(value) };
}
