// GraphQL Schema Parser

export interface GqlField {
    name: string;
    type: string;
    isNonNull: boolean;
    isList: boolean;
    isListNonNull: boolean;
    args?: GqlArgument[];
}

export interface GqlArgument {
    name: string;
    type: string;
    isNonNull: boolean;
    defaultValue?: string;
}

export interface GqlType {
    kind: 'type' | 'input' | 'interface';
    name: string;
    fields: GqlField[];
    implements?: string[];
    description?: string;
}

export interface GqlEnum {
    name: string;
    values: string[];
    description?: string;
}

export interface GqlUnion {
    name: string;
    types: string[];
}

export interface GqlScalar {
    name: string;
}

export interface GqlSchema {
    types: GqlType[];
    enums: GqlEnum[];
    unions: GqlUnion[];
    scalars: GqlScalar[];
    queries: GqlField[];
    mutations: GqlField[];
    subscriptions: GqlField[];
}

const BUILTIN_SCALARS = new Set(['Int', 'Float', 'String', 'Boolean', 'ID']);

export function parseGraphQL(input: string): GqlSchema {
    const schema: GqlSchema = {
        types: [], enums: [], unions: [], scalars: [],
        queries: [], mutations: [], subscriptions: [],
    };

    // Remove comments
    const cleaned = input.replace(/#.*$/gm, '').replace(/"""[\s\S]*?"""/g, '');

    // Enums
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let m;
    while ((m = enumRegex.exec(cleaned)) !== null) {
        const values = m[2].split(/\s+/).map(v => v.trim()).filter(v => v && !v.startsWith('@'));
        schema.enums.push({ name: m[1], values });
    }

    // Scalars
    const scalarRegex = /scalar\s+(\w+)/g;
    while ((m = scalarRegex.exec(cleaned)) !== null) {
        if (!BUILTIN_SCALARS.has(m[1])) {
            schema.scalars.push({ name: m[1] });
        }
    }

    // Unions
    const unionRegex = /union\s+(\w+)\s*=\s*([^{;\n]+)/g;
    while ((m = unionRegex.exec(cleaned)) !== null) {
        const types = m[2].split('|').map(t => t.trim()).filter(Boolean);
        schema.unions.push({ name: m[1], types });
    }

    // Types, inputs, interfaces
    const typeRegex = /(type|input|interface)\s+(\w+)(?:\s+implements\s+([\w\s&,]+))?\s*\{/g;
    while ((m = typeRegex.exec(cleaned)) !== null) {
        const kind = m[1] as 'type' | 'input' | 'interface';
        const name = m[2];
        const implementsStr = m[3];
        const body = extractBlock(cleaned, m.index + m[0].length - 1);
        const fields = parseFields(body);
        const implements_ = implementsStr
            ? implementsStr.split(/[&,]/).map(s => s.trim()).filter(Boolean)
            : undefined;

        // Separate Query/Mutation/Subscription from regular types
        if (name === 'Query') {
            schema.queries = fields;
        } else if (name === 'Mutation') {
            schema.mutations = fields;
        } else if (name === 'Subscription') {
            schema.subscriptions = fields;
        } else {
            schema.types.push({ kind, name, fields, implements: implements_ });
        }
    }

    return schema;
}

function extractBlock(text: string, openIdx: number): string {
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) return text.substring(openIdx + 1, i); }
    }
    return text.substring(openIdx + 1);
}

function parseFields(body: string): GqlField[] {
    const fields: GqlField[] = [];
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    for (const line of lines) {
        // fieldName(arg: Type, arg2: Type!): ReturnType!
        const match = line.match(/^(\w+)(?:\(([^)]*)\))?\s*:\s*(.+?)(?:\s*@.*)?$/);
        if (!match) continue;

        const name = match[1];
        const argsStr = match[2];
        const typeStr = match[3].trim();

        const { type, isNonNull, isList, isListNonNull } = parseType(typeStr);
        const args = argsStr ? parseArguments(argsStr) : undefined;

        fields.push({ name, type, isNonNull, isList, isListNonNull, args });
    }
    return fields;
}

function parseArguments(argsStr: string): GqlArgument[] {
    const args: GqlArgument[] = [];
    // Split carefully on commas
    const parts = argsStr.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
        const m = part.match(/(\w+)\s*:\s*(.+?)(?:\s*=\s*(.+))?$/);
        if (!m) continue;
        const typeStr = m[2].trim();
        const nonNull = typeStr.endsWith('!');
        args.push({
            name: m[1],
            type: typeStr.replace(/!$/, '').replace(/[\[\]]/g, ''),
            isNonNull: nonNull,
            defaultValue: m[3]?.trim(),
        });
    }
    return args;
}

function parseType(typeStr: string): { type: string; isNonNull: boolean; isList: boolean; isListNonNull: boolean } {
    let s = typeStr.trim();
    const isNonNull = s.endsWith('!');
    if (isNonNull) s = s.slice(0, -1);

    const listMatch = s.match(/^\[(.+?)(!?)\]$/);
    if (listMatch) {
        return {
            type: listMatch[1].replace(/!$/, ''),
            isNonNull,
            isList: true,
            isListNonNull: listMatch[1].endsWith('!') || !!listMatch[2],
        };
    }

    return { type: s, isNonNull, isList: false, isListNonNull: false };
}

// Generate GraphQL schema from structured data
export function generateGraphQL(schema: GqlSchema): string {
    const lines: string[] = [];

    // Scalars
    for (const s of schema.scalars) {
        lines.push(`scalar ${s.name}`);
    }
    if (schema.scalars.length > 0) lines.push('');

    // Enums
    for (const en of schema.enums) {
        lines.push(`enum ${en.name} {`);
        for (const v of en.values) lines.push(`  ${v}`);
        lines.push('}');
        lines.push('');
    }

    // Unions
    for (const u of schema.unions) {
        lines.push(`union ${u.name} = ${u.types.join(' | ')}`);
    }
    if (schema.unions.length > 0) lines.push('');

    // Types
    for (const t of schema.types) {
        const impl = t.implements?.length ? ` implements ${t.implements.join(' & ')}` : '';
        lines.push(`${t.kind} ${t.name}${impl} {`);
        for (const f of t.fields) {
            lines.push(`  ${formatField(f)}`);
        }
        lines.push('}');
        lines.push('');
    }

    // Query
    if (schema.queries.length > 0) {
        lines.push('type Query {');
        for (const q of schema.queries) lines.push(`  ${formatField(q)}`);
        lines.push('}');
        lines.push('');
    }

    // Mutation
    if (schema.mutations.length > 0) {
        lines.push('type Mutation {');
        for (const m of schema.mutations) lines.push(`  ${formatField(m)}`);
        lines.push('}');
        lines.push('');
    }

    // Subscription
    if (schema.subscriptions.length > 0) {
        lines.push('type Subscription {');
        for (const s of schema.subscriptions) lines.push(`  ${formatField(s)}`);
        lines.push('}');
        lines.push('');
    }

    return lines.join('\n').trimEnd() + '\n';
}

function formatField(f: GqlField): string {
    let typeStr = f.type;
    if (f.isList) {
        typeStr = `[${typeStr}${f.isListNonNull ? '!' : ''}]`;
    }
    if (f.isNonNull) typeStr += '!';

    let argsStr = '';
    if (f.args && f.args.length > 0) {
        const parts = f.args.map(a => {
            let s = `${a.name}: ${a.type}${a.isNonNull ? '!' : ''}`;
            if (a.defaultValue) s += ` = ${a.defaultValue}`;
            return s;
        });
        argsStr = `(${parts.join(', ')})`;
    }

    return `${f.name}${argsStr}: ${typeStr}`;
}
