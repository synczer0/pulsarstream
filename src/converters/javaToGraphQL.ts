// Java → GraphQL converter
import type { GqlSchema, GqlType, GqlField, GqlEnum } from './graphqlParser';
import { generateGraphQL } from './graphqlParser';

export interface JavaToGraphQLOptions {
    generateQueries: boolean;
    generateMutations: boolean;
}

const javaToGqlType: Record<string, string> = {
    int: 'Int', Integer: 'Int', long: 'Int', Long: 'Int',
    float: 'Float', Float: 'Float', double: 'Float', Double: 'Float',
    boolean: 'Boolean', Boolean: 'Boolean',
    String: 'String', 'byte[]': 'String',
    short: 'Int', Short: 'Int', char: 'String', Character: 'String',
    BigDecimal: 'Float', BigInteger: 'Int',
    Date: 'String', Instant: 'String', LocalDate: 'String',
    LocalDateTime: 'String', UUID: 'ID',
};

export function javaToGraphQL(code: string, options: JavaToGraphQLOptions): string {
    const schema: GqlSchema = {
        types: [], enums: [], unions: [], scalars: [],
        queries: [], mutations: [], subscriptions: [],
    };

    // Parse enums
    const enumRegex = /(?:public\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g;
    let m;
    while ((m = enumRegex.exec(code)) !== null) {
        const values = m[2].split(',').map(v => v.trim().split('(')[0].replace(/;.*/, '')).filter(Boolean);
        schema.enums.push({ name: m[1], values });
    }

    // Parse classes/records
    const classRegex = /(?:public\s+)?(?:record|class)\s+(\w+)(?:\s+implements\s+([\w\s,]+))?\s*(?:\(|[^{]*\{)/g;
    while ((m = classRegex.exec(code)) !== null) {
        const name = m[1];
        const impl = m[2]?.split(',').map(s => s.trim()).filter(Boolean);
        const body = extractBody(code, code.indexOf('{', m.index));
        const fields = extractFields(body);
        if (fields.length > 0) {
            schema.types.push({
                kind: 'type', name, fields,
                implements: impl,
            });

            // Auto-generate CRUD queries & mutations
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

                // Add input type
                schema.types.push({
                    kind: 'input', name: `${name}Input`,
                    fields: fields.filter(f => f.name !== 'id'),
                });
            }
        }
    }

    return generateGraphQL(schema);
}

function extractBody(text: string, openIdx: number): string {
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) return text.substring(openIdx + 1, i); }
    }
    return text.substring(openIdx + 1);
}

function extractFields(body: string): GqlField[] {
    const fields: GqlField[] = [];
    const regex = /(?:private|protected|public)\s+(?:final\s+)?(?:(?:List|ArrayList)<\s*(\w+)\s*>|(\w[\w.<>[\]]*?))\s+(\w+)\s*[;=]/g;
    let m;
    while ((m = regex.exec(body)) !== null) {
        if (m[1]) {
            // List type
            fields.push({
                name: m[3], type: mapType(m[1]),
                isNonNull: true, isList: true, isListNonNull: true,
            });
        } else {
            fields.push({
                name: m[3], type: mapType(m[2]),
                isNonNull: true, isList: false, isListNonNull: false,
            });
        }
    }
    return fields;
}

function mapType(javaType: string): string {
    return javaToGqlType[javaType] || javaType;
}
