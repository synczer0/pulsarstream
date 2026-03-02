// Kotlin → GraphQL converter
import type { GqlSchema, GqlField } from './graphqlParser';
import { generateGraphQL } from './graphqlParser';

export interface KotlinToGraphQLOptions {
    generateQueries: boolean;
    generateMutations: boolean;
}

const ktToGqlType: Record<string, string> = {
    Int: 'Int', Long: 'Int', Float: 'Float', Double: 'Float',
    Boolean: 'Boolean', String: 'String', ByteArray: 'String',
    UInt: 'Int', ULong: 'Int', Short: 'Int', Byte: 'Int',
};

export function kotlinToGraphQL(code: string, options: KotlinToGraphQLOptions): string {
    const schema: GqlSchema = {
        types: [], enums: [], unions: [], scalars: [],
        queries: [], mutations: [], subscriptions: [],
    };

    // Parse enums
    const enumRegex = /enum\s+class\s+(\w+)\s*\{([^}]+)\}/g;
    let m;
    while ((m = enumRegex.exec(code)) !== null) {
        const values = m[2].split(',').map(v => v.trim().split('(')[0].replace(/;.*/, '')).filter(Boolean);
        schema.enums.push({ name: m[1], values });
    }

    // Parse data classes
    const classRegex = /data\s+class\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*:\s*([\w\s,]+))?/g;
    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const params = m[2];
        const impl = m[3]?.split(',').map(s => s.trim().split('(')[0]).filter(Boolean);
        const fields = parseParams(params);
        if (fields.length > 0) {
            schema.types.push({
                kind: 'type', name, fields,
                implements: impl,
            });

            if (options.generateQueries) {
                schema.queries.push(
                    {
                        name: `get${name}`, type: name, isNonNull: false, isList: false, isListNonNull: false,
                        args: [{ name: 'id', type: 'ID', isNonNull: true }]
                    },
                    { name: `all${name}s`, type: name, isNonNull: true, isList: true, isListNonNull: true },
                );
            }

            if (options.generateMutations) {
                schema.mutations.push(
                    {
                        name: `create${name}`, type: name, isNonNull: true, isList: false, isListNonNull: false,
                        args: [{ name: 'input', type: `${name}Input`, isNonNull: true }]
                    },
                    {
                        name: `update${name}`, type: name, isNonNull: false, isList: false, isListNonNull: false,
                        args: [
                            { name: 'id', type: 'ID', isNonNull: true },
                            { name: 'input', type: `${name}Input`, isNonNull: true },
                        ]
                    },
                    {
                        name: `delete${name}`, type: 'Boolean', isNonNull: true, isList: false, isListNonNull: false,
                        args: [{ name: 'id', type: 'ID', isNonNull: true }]
                    },
                );
                schema.types.push({
                    kind: 'input', name: `${name}Input`,
                    fields: fields.filter(f => f.name !== 'id'),
                });
            }
        }
    }

    return generateGraphQL(schema);
}

function parseParams(params: string): GqlField[] {
    const fields: GqlField[] = [];
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
        const match = part.match(/(?:val|var)\s+(\w+)\s*:\s*(.+?)(?:\s*=.*)?$/);
        if (!match) continue;
        const name = match[1];
        let type = match[2].trim();
        const nullable = type.endsWith('?');
        if (nullable) type = type.slice(0, -1);

        const listMatch = type.match(/^(?:List|MutableList)<\s*(.+?)\s*>$/);
        if (listMatch) {
            fields.push({
                name, type: mapType(listMatch[1]),
                isNonNull: !nullable, isList: true, isListNonNull: true,
            });
        } else {
            fields.push({
                name, type: mapType(type),
                isNonNull: !nullable, isList: false, isListNonNull: false,
            });
        }
    }
    return fields;
}

function mapType(ktType: string): string {
    return ktToGqlType[ktType] || ktType;
}
