// Proto Parser — parses .proto (proto2/proto3) files into structured data

export type ProtoVersion = 'proto2' | 'proto3';

export interface ProtoField {
    name: string;
    type: string;
    number: number;
    repeated: boolean;
    optional: boolean;
    mapKeyType?: string;
    mapValueType?: string;
    defaultValue?: string;
    label?: 'required' | 'optional' | 'repeated'; // proto2
}

export interface ProtoEnum {
    name: string;
    values: { name: string; number: number }[];
}

export interface ProtoMessage {
    name: string;
    fields: ProtoField[];
    enums: ProtoEnum[];
    nestedMessages: ProtoMessage[];
}

export interface ProtoRpcMethod {
    name: string;
    inputType: string;
    outputType: string;
    clientStreaming: boolean;
    serverStreaming: boolean;
}

export interface ProtoService {
    name: string;
    methods: ProtoRpcMethod[];
}

export interface ProtoFile {
    syntax: ProtoVersion;
    package: string;
    imports: string[];
    options: Record<string, string>;
    messages: ProtoMessage[];
    enums: ProtoEnum[];
    services: ProtoService[];
}

const PROTO_SCALAR_TYPES = new Set([
    'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
    'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
    'bool', 'string', 'bytes',
]);

export function isProtoScalar(type: string): boolean {
    return PROTO_SCALAR_TYPES.has(type);
}

export function parseProto(input: string): ProtoFile {
    const result: ProtoFile = {
        syntax: 'proto3',
        package: '',
        imports: [],
        options: {},
        messages: [],
        enums: [],
        services: [],
    };

    // Remove comments
    const cleaned = input
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

    // Syntax
    const syntaxMatch = cleaned.match(/syntax\s*=\s*"(proto[23])"\s*;/);
    if (syntaxMatch) result.syntax = syntaxMatch[1] as ProtoVersion;

    // Package
    const pkgMatch = cleaned.match(/package\s+([\w.]+)\s*;/);
    if (pkgMatch) result.package = pkgMatch[1];

    // Imports
    const importMatches = cleaned.matchAll(/import\s+"([^"]+)"\s*;/g);
    for (const m of importMatches) result.imports.push(m[1]);

    // Options
    const optMatches = cleaned.matchAll(/option\s+([\w.]+)\s*=\s*"?([^";]+)"?\s*;/g);
    for (const m of optMatches) result.options[m[1]] = m[2].trim();

    // Parse top-level blocks
    parseBlocks(cleaned, result);

    return result;
}

function parseBlocks(text: string, result: ProtoFile): void {
    // Messages
    const msgRegex = /message\s+(\w+)\s*\{/g;
    let match;
    while ((match = msgRegex.exec(text)) !== null) {
        const name = match[1];
        const body = extractBlock(text, match.index + match[0].length - 1);
        result.messages.push(parseMessage(name, body, result.syntax));
    }

    // Enums
    const enumRegex = /enum\s+(\w+)\s*\{/g;
    while ((match = enumRegex.exec(text)) !== null) {
        const name = match[1];
        const body = extractBlock(text, match.index + match[0].length - 1);
        result.enums.push(parseEnum(name, body));
    }

    // Services
    const svcRegex = /service\s+(\w+)\s*\{/g;
    while ((match = svcRegex.exec(text)) !== null) {
        const name = match[1];
        const body = extractBlock(text, match.index + match[0].length - 1);
        result.services.push(parseService(name, body));
    }
}

function extractBlock(text: string, openBraceIndex: number): string {
    let depth = 0;
    let i = openBraceIndex;
    for (; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) break;
        }
    }
    return text.substring(openBraceIndex + 1, i);
}

function parseMessage(name: string, body: string, syntax: ProtoVersion): ProtoMessage {
    const msg: ProtoMessage = { name, fields: [], enums: [], nestedMessages: [] };

    // Nested enums
    const enumRegex = /enum\s+(\w+)\s*\{/g;
    let m;
    while ((m = enumRegex.exec(body)) !== null) {
        const enumBody = extractBlock(body, m.index + m[0].length - 1);
        msg.enums.push(parseEnum(m[1], enumBody));
    }

    // Nested messages
    const nestedMsgRegex = /message\s+(\w+)\s*\{/g;
    while ((m = nestedMsgRegex.exec(body)) !== null) {
        const nestedBody = extractBlock(body, m.index + m[0].length - 1);
        msg.nestedMessages.push(parseMessage(m[1], nestedBody, syntax));
    }

    // Fields — strip out nested blocks first
    let fieldBody = body.replace(/(?:message|enum)\s+\w+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');

    // Map fields
    const mapRegex = /map\s*<\s*(\w+)\s*,\s*(\w+)\s*>\s+(\w+)\s*=\s*(\d+)/g;
    while ((m = mapRegex.exec(fieldBody)) !== null) {
        msg.fields.push({
            name: m[3],
            type: `map<${m[1]},${m[2]}>`,
            number: parseInt(m[4]),
            repeated: false,
            optional: false,
            mapKeyType: m[1],
            mapValueType: m[2],
        });
    }
    fieldBody = fieldBody.replace(mapRegex, '');

    // Regular fields
    const fieldRegex = /(repeated|optional|required)?\s*(\w[\w.]*)\s+(\w+)\s*=\s*(\d+)/g;
    while ((m = fieldRegex.exec(fieldBody)) !== null) {
        const label = m[1] as 'repeated' | 'optional' | 'required' | undefined;
        msg.fields.push({
            name: m[3],
            type: m[2],
            number: parseInt(m[4]),
            repeated: label === 'repeated',
            optional: label === 'optional' || (syntax === 'proto3' && !label),
            label: label || undefined,
        });
    }

    return msg;
}

function parseEnum(name: string, body: string): ProtoEnum {
    const values: { name: string; number: number }[] = [];
    const regex = /(\w+)\s*=\s*(\d+)/g;
    let m;
    while ((m = regex.exec(body)) !== null) {
        values.push({ name: m[1], number: parseInt(m[2]) });
    }
    return { name, values };
}

function parseService(name: string, body: string): ProtoService {
    const methods: ProtoRpcMethod[] = [];
    const rpcRegex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+)\s*\)/g;
    let m;
    while ((m = rpcRegex.exec(body)) !== null) {
        methods.push({
            name: m[1],
            inputType: m[3],
            outputType: m[5],
            clientStreaming: !!m[2],
            serverStreaming: !!m[4],
        });
    }
    return { name, methods };
}

// Generate Proto from structured data
export function generateProto(file: ProtoFile): string {
    const lines: string[] = [];
    lines.push(`syntax = "${file.syntax}";`);
    lines.push('');

    if (file.package) {
        lines.push(`package ${file.package};`);
        lines.push('');
    }

    for (const imp of file.imports) {
        lines.push(`import "${imp}";`);
    }
    if (file.imports.length > 0) lines.push('');

    for (const [key, val] of Object.entries(file.options)) {
        lines.push(`option ${key} = "${val}";`);
    }
    if (Object.keys(file.options).length > 0) lines.push('');

    for (const en of file.enums) {
        lines.push(...generateEnumLines(en, ''));
        lines.push('');
    }

    for (const msg of file.messages) {
        lines.push(...generateMessageLines(msg, ''));
        lines.push('');
    }

    for (const svc of file.services) {
        lines.push(`service ${svc.name} {`);
        for (const method of svc.methods) {
            const cs = method.clientStreaming ? 'stream ' : '';
            const ss = method.serverStreaming ? 'stream ' : '';
            lines.push(`  rpc ${method.name}(${cs}${method.inputType}) returns (${ss}${method.outputType});`);
        }
        lines.push('}');
        lines.push('');
    }

    return lines.join('\n').trimEnd() + '\n';
}

function generateEnumLines(en: ProtoEnum, indent: string): string[] {
    const lines: string[] = [];
    lines.push(`${indent}enum ${en.name} {`);
    for (const v of en.values) {
        lines.push(`${indent}  ${v.name} = ${v.number};`);
    }
    lines.push(`${indent}}`);
    return lines;
}

function generateMessageLines(msg: ProtoMessage, indent: string): string[] {
    const lines: string[] = [];
    lines.push(`${indent}message ${msg.name} {`);

    for (const en of msg.enums) {
        lines.push(...generateEnumLines(en, indent + '  '));
    }

    for (const nested of msg.nestedMessages) {
        lines.push(...generateMessageLines(nested, indent + '  '));
    }

    for (const f of msg.fields) {
        const label = f.repeated ? 'repeated ' : (f.label === 'required' ? 'required ' : '');
        lines.push(`${indent}  ${label}${f.type} ${f.name} = ${f.number};`);
    }

    lines.push(`${indent}}`);
    return lines;
}
