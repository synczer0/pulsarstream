// GraphQL → Kotlin converter
import type { GqlSchema, GqlType, GqlField, GqlEnum } from './graphqlParser';
import type { KotlinVersion } from './typeMapper';

export interface GraphQLToKotlinOptions {
    kotlinVersion: KotlinVersion;
    packageName: string;
    useSpringGraphQL: boolean;
    useKotlinxSerialization: boolean;
}

const gqlToKt: Record<string, string> = {
    Int: 'Int', Float: 'Double', String: 'String',
    Boolean: 'Boolean', ID: 'String',
};

function mapType(field: GqlField): string {
    const base = gqlToKt[field.type] || field.type;
    const nullable = !field.isNonNull ? '?' : '';
    if (field.isList) return `List<${base}>${nullable}`;
    return `${base}${nullable}`;
}

function defaultVal(field: GqlField): string {
    if (field.isList) return 'emptyList()';
    if (!field.isNonNull) return 'null';
    const defaults: Record<string, string> = {
        Int: '0', Float: '0.0', String: '""', Boolean: 'false', ID: '""',
    };
    return defaults[field.type] || `${field.type}()`;
}

export function graphqlToKotlin(schema: GqlSchema, options: GraphQLToKotlinOptions): string {
    const output: string[] = [];
    const pkg = options.packageName || 'com.example';

    for (const en of schema.enums) {
        output.push(genEnum(en, pkg));
    }

    for (const t of schema.types) {
        output.push(genType(t, pkg, options));
    }

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
    lines.push(`package ${pkg}`);
    lines.push('');
    lines.push(`enum class ${en.name} {`);
    lines.push(en.values.map(v => `    ${v}`).join(',\n') + ';');
    lines.push('}');
    return lines.join('\n');
}

function genType(t: GqlType, pkg: string, opts: GraphQLToKotlinOptions): string {
    const lines: string[] = [];
    lines.push(`package ${pkg}`);
    lines.push('');

    if (opts.useKotlinxSerialization && t.kind !== 'interface') {
        lines.push('import kotlinx.serialization.Serializable');
        lines.push('');
        lines.push('@Serializable');
    }

    if (t.kind === 'interface') {
        lines.push(`interface ${t.name} {`);
        for (const f of t.fields) {
            lines.push(`    val ${f.name}: ${mapType(f)}`);
        }
        lines.push('}');
    } else {
        const impl = t.implements?.length ? ` : ${t.implements.join(', ')}` : '';
        lines.push(`data class ${t.name}(`);
        const params = t.fields.map(f =>
            `    val ${f.name}: ${mapType(f)} = ${defaultVal(f)}`
        );
        lines.push(params.join(',\n'));
        lines.push(`)${impl}`);
    }
    return lines.join('\n');
}

function genResolver(name: string, fields: GqlField[], pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg}`);
    lines.push('');
    lines.push('import org.springframework.graphql.data.method.annotation.Argument');
    const ann = name === 'Query' ? 'QueryMapping' : 'MutationMapping';
    lines.push(`import org.springframework.graphql.data.method.annotation.${ann}`);
    lines.push('import org.springframework.stereotype.Controller');
    lines.push('');
    lines.push('@Controller');
    lines.push(`class ${name}Resolver {`);
    lines.push('');
    for (const f of fields) {
        const retType = mapType(f);
        const args = f.args?.map(a => `@Argument ${a.name}: ${gqlToKt[a.type] || a.type}`).join(', ') || '';
        lines.push(`    @${ann}`);
        lines.push(`    fun ${f.name}(${args}): ${retType} {`);
        lines.push(`        TODO("Not implemented")`);
        lines.push('    }');
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}

function genSubscription(fields: GqlField[], pkg: string): string {
    const lines: string[] = [];
    lines.push(`package ${pkg}`);
    lines.push('');
    lines.push('import org.springframework.graphql.data.method.annotation.SubscriptionMapping');
    lines.push('import org.springframework.stereotype.Controller');
    lines.push('import kotlinx.coroutines.flow.Flow');
    lines.push('');
    lines.push('@Controller');
    lines.push('class SubscriptionResolver {');
    lines.push('');
    for (const f of fields) {
        const retType = mapType(f);
        lines.push('    @SubscriptionMapping');
        lines.push(`    fun ${f.name}(): Flow<${retType}> {`);
        lines.push(`        TODO("Not implemented")`);
        lines.push('    }');
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}
