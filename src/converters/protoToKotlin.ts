// Proto → Kotlin converter
import type { ProtoFile, ProtoMessage, ProtoEnum, ProtoField, ProtoService } from './protoParser';
import type { KotlinVersion } from './typeMapper';

export interface ProtoToKotlinOptions {
    kotlinVersion: KotlinVersion;
    packageName: string;
    useGrpcStubs: boolean;
    useKotlinxSerialization: boolean;
}

const protoToKtType: Record<string, string> = {
    double: 'Double', float: 'Float',
    int32: 'Int', int64: 'Long',
    uint32: 'UInt', uint64: 'ULong',
    sint32: 'Int', sint64: 'Long',
    fixed32: 'Int', fixed64: 'Long',
    sfixed32: 'Int', sfixed64: 'Long',
    bool: 'Boolean', string: 'String', bytes: 'ByteArray',
};

function mapFieldType(field: ProtoField): string {
    if (field.mapKeyType && field.mapValueType) {
        const k = protoToKtType[field.mapKeyType] || field.mapKeyType;
        const v = protoToKtType[field.mapValueType] || field.mapValueType;
        return `Map<${k}, ${v}>`;
    }
    const base = protoToKtType[field.type] || field.type;
    return field.repeated ? `List<${base}>` : base;
}

function defaultValue(field: ProtoField): string {
    if (field.mapKeyType) return 'emptyMap()';
    if (field.repeated) return 'emptyList()';
    const defaults: Record<string, string> = {
        double: '0.0', float: '0.0f', int32: '0', int64: '0L',
        uint32: '0u', uint64: '0uL', sint32: '0', sint64: '0L',
        fixed32: '0', fixed64: '0L', sfixed32: '0', sfixed64: '0L',
        bool: 'false', string: '""', bytes: 'byteArrayOf()',
    };
    return defaults[field.type] || 'null';
}

export function protoToKotlin(proto: ProtoFile, options: ProtoToKotlinOptions): string {
    const output: string[] = [];
    const pkg = options.packageName || proto.package || 'com.example';

    for (const en of proto.enums) {
        output.push(generateKtEnum(en, pkg));
    }

    for (const msg of proto.messages) {
        output.push(generateKtMessage(msg, pkg, options));
    }

    if (options.useGrpcStubs) {
        for (const svc of proto.services) {
            output.push(generateKtService(svc, pkg));
        }
    }

    return output.join('\n\n');
}

function generateKtEnum(en: ProtoEnum, pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg}`);
    lines.push('');
    lines.push(`enum class ${en.name} {`);
    lines.push(en.values.map(v => `    ${v.name}`).join(',\n') + ';');
    lines.push('}');
    return lines.join('\n');
}

function generateKtMessage(msg: ProtoMessage, pkg: string, opts: ProtoToKotlinOptions): string {
    const lines: string[] = [];
    lines.push(`package ${pkg}`);
    lines.push('');

    if (opts.useKotlinxSerialization) {
        lines.push('import kotlinx.serialization.Serializable');
        lines.push('import kotlinx.serialization.SerialName');
        lines.push('');
        lines.push('@Serializable');
    }

    const fields = msg.fields.map(f => {
        const type = mapFieldType(f);
        const name = toCamelCase(f.name);
        const sn = opts.useKotlinxSerialization && f.name !== name
            ? `    @SerialName("${f.name}")\n` : '';
        return `${sn}    val ${name}: ${type} = ${defaultValue(f)}`;
    });

    lines.push(`data class ${msg.name}(`);
    lines.push(fields.join(',\n'));
    lines.push(') {');

    // Nested enums
    for (const ne of msg.enums) {
        lines.push('');
        lines.push(`    enum class ${ne.name} {`);
        lines.push(ne.values.map(v => `        ${v.name}`).join(',\n') + ';');
        lines.push('    }');
    }

    lines.push('}');
    return lines.join('\n');
}

function generateKtService(svc: ProtoService, pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg}`);
    lines.push('');
    lines.push('import kotlinx.coroutines.flow.Flow');
    lines.push('');
    lines.push(`/**`);
    lines.push(` * gRPC service interface for ${svc.name}`);
    lines.push(` */`);
    lines.push(`interface ${svc.name}Grpc {`);
    lines.push('');
    for (const m of svc.methods) {
        let sig: string;
        if (m.clientStreaming && m.serverStreaming) {
            sig = `    fun ${toCamelCase(m.name)}(requests: Flow<${m.inputType}>): Flow<${m.outputType}>`;
        } else if (m.serverStreaming) {
            sig = `    fun ${toCamelCase(m.name)}(request: ${m.inputType}): Flow<${m.outputType}>`;
        } else if (m.clientStreaming) {
            sig = `    suspend fun ${toCamelCase(m.name)}(requests: Flow<${m.inputType}>): ${m.outputType}`;
        } else {
            sig = `    suspend fun ${toCamelCase(m.name)}(request: ${m.inputType}): ${m.outputType}`;
        }
        lines.push(sig);
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}

function toCamelCase(name: string): string {
    return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
