// GraphQL → Java converter
import type { GqlSchema, GqlType, GqlField, GqlEnum } from './graphqlParser';
import type { JavaVersion } from './typeMapper';

export interface GraphQLToJavaOptions {
    javaVersion: JavaVersion;
    packageName: string;
    useSpringGraphQL: boolean;
    useLombok: boolean;
}

const gqlToJava: Record<string, string> = {
    Int: 'Integer', Float: 'Double', String: 'String',
    Boolean: 'Boolean', ID: 'String',
};

function mapType(field: GqlField): string {
    const base = gqlToJava[field.type] || field.type;
    if (field.isList) return `List<${base}>`;
    return field.isNonNull ? base : base;
}

export function graphqlToJava(schema: GqlSchema, options: GraphQLToJavaOptions): string {
    const output: string[] = [];
    const pkg = options.packageName || 'com.example';

    // Enums
    for (const en of schema.enums) {
        output.push(genEnum(en, pkg));
    }

    // Types + Inputs
    for (const t of schema.types) {
        output.push(genType(t, pkg, options));
    }

    // Queries as controller/resolver
    if (options.useSpringGraphQL && schema.queries.length > 0) {
        output.push(genResolver('Query', schema.queries, pkg));
    }

    if (options.useSpringGraphQL && schema.mutations.length > 0) {
        output.push(genResolver('Mutation', schema.mutations, pkg));
    }

    if (options.useSpringGraphQL && schema.subscriptions.length > 0) {
        output.push(genSubscription(schema.subscriptions, pkg));
    }

    return output.join('\n\n');
}

function genEnum(en: GqlEnum, pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');
    lines.push(`public enum ${en.name} {`);
    lines.push(en.values.map(v => `    ${v}`).join(',\n') + ';');
    lines.push('}');
    return lines.join('\n');
}

function genType(t: GqlType, pkg: string, opts: GraphQLToJavaOptions): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');

    const imports = new Set<string>();
    if (t.fields.some(f => f.isList)) imports.add('java.util.List');
    if (opts.useLombok) {
        imports.add('lombok.Data');
        imports.add('lombok.NoArgsConstructor');
        imports.add('lombok.AllArgsConstructor');
        imports.add('lombok.Builder');
    }
    for (const imp of [...imports].sort()) lines.push(`import ${imp};`);
    if (imports.size) lines.push('');

    if (opts.useLombok) {
        lines.push('@Data');
        lines.push('@NoArgsConstructor');
        lines.push('@AllArgsConstructor');
        lines.push('@Builder');
    }

    const useRecord = parseInt(opts.javaVersion) >= 16 && !opts.useLombok;
    const impl = t.implements?.length ? ` implements ${t.implements.join(', ')}` : '';

    if (useRecord && t.kind !== 'interface') {
        const params = t.fields.map(f => `    ${mapType(f)} ${f.name}`).join(',\n');
        lines.push(`public record ${t.name}(`);
        lines.push(params);
        lines.push(`)${impl} {}`);
    } else if (t.kind === 'interface') {
        lines.push(`public interface ${t.name} {`);
        for (const f of t.fields) {
            const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
            lines.push(`    ${mapType(f)} get${cap}();`);
        }
        lines.push('}');
    } else {
        lines.push(`public class ${t.name}${impl} {`);
        lines.push('');
        for (const f of t.fields) {
            lines.push(`    private ${mapType(f)} ${f.name};`);
        }
        if (!opts.useLombok) {
            lines.push('');
            lines.push(`    public ${t.name}() {}`);
            for (const f of t.fields) {
                const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
                lines.push('');
                lines.push(`    public ${mapType(f)} get${cap}() { return this.${f.name}; }`);
                lines.push(`    public void set${cap}(${mapType(f)} ${f.name}) { this.${f.name} = ${f.name}; }`);
            }
        }
        lines.push('}');
    }
    return lines.join('\n');
}

function genResolver(name: string, fields: GqlField[], pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');
    lines.push('import org.springframework.graphql.data.method.annotation.Argument;');
    lines.push(`import org.springframework.graphql.data.method.annotation.${name === 'Query' ? 'QueryMapping' : 'MutationMapping'};`);
    lines.push('import org.springframework.stereotype.Controller;');
    lines.push('');
    lines.push('@Controller');
    lines.push(`public class ${name}Resolver {`);
    lines.push('');
    for (const f of fields) {
        const annotation = name === 'Query' ? '@QueryMapping' : '@MutationMapping';
        const retType = mapType(f);
        const args = f.args?.map(a => `@Argument ${gqlToJava[a.type] || a.type} ${a.name}`).join(', ') || '';
        lines.push(`    ${annotation}`);
        lines.push(`    public ${retType} ${f.name}(${args}) {`);
        lines.push(`        // TODO: implement`);
        lines.push(`        throw new UnsupportedOperationException("Not implemented");`);
        lines.push('    }');
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}

function genSubscription(fields: GqlField[], pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg};`);
    lines.push('');
    lines.push('import org.springframework.graphql.data.method.annotation.SubscriptionMapping;');
    lines.push('import org.springframework.stereotype.Controller;');
    lines.push('import reactor.core.publisher.Flux;');
    lines.push('');
    lines.push('@Controller');
    lines.push('public class SubscriptionResolver {');
    lines.push('');
    for (const f of fields) {
        const retType = mapType(f);
        lines.push('    @SubscriptionMapping');
        lines.push(`    public Flux<${retType}> ${f.name}() {`);
        lines.push(`        // TODO: implement`);
        lines.push(`        throw new UnsupportedOperationException("Not implemented");`);
        lines.push('    }');
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}
