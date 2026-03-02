// Proto → Java converter
import type { ProtoFile, ProtoMessage, ProtoEnum, ProtoField, ProtoService } from './protoParser';
import type { JavaVersion } from './typeMapper';

export interface ProtoToJavaOptions {
    javaVersion: JavaVersion;
    packageName: string;
    useGrpcStubs: boolean;
    useLombok: boolean;
    useJakarta: boolean;
}

const protoToJavaType: Record<string, string> = {
    double: 'double', float: 'float',
    int32: 'int', int64: 'long',
    uint32: 'int', uint64: 'long',
    sint32: 'int', sint64: 'long',
    fixed32: 'int', fixed64: 'long',
    sfixed32: 'int', sfixed64: 'long',
    bool: 'boolean', string: 'String', bytes: 'byte[]',
};

const protoToJavaBoxed: Record<string, string> = {
    double: 'Double', float: 'Float',
    int32: 'Integer', int64: 'Long',
    uint32: 'Integer', uint64: 'Long',
    sint32: 'Integer', sint64: 'Long',
    fixed32: 'Integer', fixed64: 'Long',
    sfixed32: 'Integer', sfixed64: 'Long',
    bool: 'Boolean', string: 'String', bytes: 'byte[]',
};

function mapFieldType(field: ProtoField, boxed = false): string {
    if (field.mapKeyType && field.mapValueType) {
        const k = protoToJavaBoxed[field.mapKeyType] || field.mapKeyType;
        const v = protoToJavaBoxed[field.mapValueType] || field.mapValueType;
        return `Map<${k}, ${v}>`;
    }
    const base = boxed
        ? (protoToJavaBoxed[field.type] || field.type)
        : (protoToJavaType[field.type] || field.type);
    return field.repeated ? `List<${protoToJavaBoxed[field.type] || field.type}>` : base;
}

export function protoToJava(proto: ProtoFile, options: ProtoToJavaOptions): string {
    const output: string[] = [];
    const pkg = options.packageName || proto.package || 'com.example';

    for (const en of proto.enums) {
        output.push(generateJavaEnum(en, pkg));
    }

    for (const msg of proto.messages) {
        output.push(generateJavaMessage(msg, pkg, options));
    }

    if (options.useGrpcStubs) {
        for (const svc of proto.services) {
            output.push(generateJavaService(svc, pkg));
        }
    }

    return output.join('\n\n');
}

function generateJavaEnum(en: ProtoEnum, pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');
    lines.push(`public enum ${en.name} {`);
    lines.push(en.values.map(v => `    ${v.name}`).join(',\n') + ';');
    lines.push('}');
    return lines.join('\n');
}

function generateJavaMessage(msg: ProtoMessage, pkg: string, opts: ProtoToJavaOptions): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');

    // Imports
    const imports = new Set<string>();
    const hasLists = msg.fields.some(f => f.repeated);
    const hasMaps = msg.fields.some(f => f.mapKeyType);
    if (hasLists) { imports.add('java.util.List'); imports.add('java.util.ArrayList'); }
    if (hasMaps) { imports.add('java.util.Map'); imports.add('java.util.HashMap'); }
    if (opts.useLombok) {
        imports.add('lombok.Data');
        imports.add('lombok.NoArgsConstructor');
        imports.add('lombok.AllArgsConstructor');
        imports.add('lombok.Builder');
    }

    for (const imp of [...imports].sort()) lines.push(`import ${imp};`);
    if (imports.size > 0) lines.push('');

    // Class annotations
    if (opts.useLombok) {
        lines.push('@Data');
        lines.push('@NoArgsConstructor');
        lines.push('@AllArgsConstructor');
        lines.push('@Builder');
    }

    const useRecord = parseInt(opts.javaVersion) >= 16 && !opts.useLombok;

    if (useRecord) {
        // Java 16+ record
        const params = msg.fields.map(f => `    ${mapFieldType(f, true)} ${toCamelCase(f.name)}`).join(',\n');
        lines.push(`public record ${msg.name}(`);
        lines.push(params);
        lines.push(') {}');
    } else {
        lines.push(`public class ${msg.name} {`);
        lines.push('');

        // Fields
        for (const f of msg.fields) {
            const jType = mapFieldType(f);
            lines.push(`    private ${jType} ${toCamelCase(f.name)};`);
        }

        if (!opts.useLombok) {
            // Constructor
            lines.push('');
            lines.push(`    public ${msg.name}() {}`);

            // Getters & setters
            for (const f of msg.fields) {
                const jType = mapFieldType(f);
                const camel = toCamelCase(f.name);
                const cap = camel.charAt(0).toUpperCase() + camel.slice(1);
                lines.push('');
                lines.push(`    public ${jType} get${cap}() { return this.${camel}; }`);
                lines.push(`    public void set${cap}(${jType} ${camel}) { this.${camel} = ${camel}; }`);
            }
        }

        // Nested enums
        for (const ne of msg.enums) {
            lines.push('');
            lines.push(`    public enum ${ne.name} {`);
            lines.push(ne.values.map(v => `        ${v.name}`).join(',\n') + ';');
            lines.push('    }');
        }

        lines.push('}');
    }

    return lines.join('\n');
}

function generateJavaService(svc: ProtoService, pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');
    lines.push('import io.grpc.stub.StreamObserver;');
    lines.push('');
    lines.push(`/**`);
    lines.push(` * gRPC service stub for ${svc.name}`);
    lines.push(` */`);
    lines.push(`public abstract class ${svc.name}Grpc {`);
    lines.push('');
    for (const m of svc.methods) {
        const cs = m.clientStreaming ? `StreamObserver<${m.inputType}>` : m.inputType;
        const ret = m.serverStreaming
            ? `void ${m.name}(${cs} request, StreamObserver<${m.outputType}> responseObserver)`
            : m.clientStreaming
                ? `StreamObserver<${m.inputType}> ${m.name}(StreamObserver<${m.outputType}> responseObserver)`
                : `void ${m.name}(${m.inputType} request, StreamObserver<${m.outputType}> responseObserver)`;
        lines.push(`    public abstract ${ret};`);
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}

function toCamelCase(name: string): string {
    return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
