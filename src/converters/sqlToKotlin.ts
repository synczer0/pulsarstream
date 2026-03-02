// SQL DDL → Kotlin Entity converter
import { parseSqlDDL, type SqlTable } from './sqlParser';
import { sqlToKotlinType, type KotlinVersion, getJpaImportPrefix, type JavaVersion } from './typeMapper';

export interface SqlToKotlinOptions {
    packageName: string;
    kotlinVersion: KotlinVersion;
    javaVersion: JavaVersion; // for JPA import prefix
    useKotlinxSerialization: boolean;
}

const defaults: SqlToKotlinOptions = {
    packageName: '',
    kotlinVersion: '2.1',
    javaVersion: '21',
    useKotlinxSerialization: false,
};

function toPascalCase(s: string): string {
    return s.replace(/(^|[_\-\s])(\w)/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(s: string): string {
    const p = toPascalCase(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
}

export function sqlToKotlin(sqlStr: string, opts?: Partial<SqlToKotlinOptions>): string {
    const o = { ...defaults, ...opts };
    const tables = parseSqlDDL(sqlStr);
    if (tables.length === 0) return '// Error: No CREATE TABLE statements found';
    return tables.map(t => generateEntity(t, o)).join('\n\n// ' + '='.repeat(60) + '\n\n');
}

function generateEntity(table: SqlTable, opts: SqlToKotlinOptions): string {
    const jpaPrefix = getJpaImportPrefix(opts.javaVersion);
    const className = toPascalCase(table.name);
    const lines: string[] = [];
    const imports = new Set<string>();

    imports.add(`import ${jpaPrefix}.Entity`);
    imports.add(`import ${jpaPrefix}.Table`);
    imports.add(`import ${jpaPrefix}.Id`);
    imports.add(`import ${jpaPrefix}.Column`);

    if (opts.useKotlinxSerialization) {
        imports.add('import kotlinx.serialization.Serializable');
    }

    const hasAutoIncrement = table.columns.some(c => c.isAutoIncrement);
    if (hasAutoIncrement) {
        imports.add(`import ${jpaPrefix}.GeneratedValue`);
        imports.add(`import ${jpaPrefix}.GenerationType`);
    }

    const fields: { name: string; kotlinType: string; col: typeof table.columns[0] }[] = [];
    for (const col of table.columns) {
        const mapping = sqlToKotlinType(col.type, opts.kotlinVersion);
        let kotlinType = mapping.kotlinType;
        if (mapping.kotlinImport) {
            imports.add(`import ${mapping.kotlinImport}`);
            kotlinType = kotlinType.split('.').pop()!;
        }
        if (col.nullable) kotlinType += '?';
        fields.push({ name: toCamelCase(col.name), kotlinType, col });
    }

    if (opts.packageName) lines.push(`package ${opts.packageName}`, '');
    lines.push(...Array.from(imports).sort(), '');

    lines.push('@Entity');
    lines.push(`@Table(name = "${table.name}")`);
    if (opts.useKotlinxSerialization) lines.push('@Serializable');
    lines.push(`data class ${className}(`);

    fields.forEach((field, i) => {
        const { col } = field;
        const annotations: string[] = [];

        if (col.isPrimaryKey) {
            annotations.push('    @Id');
            if (col.isAutoIncrement) {
                annotations.push('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
            }
        }

        const colParts: string[] = [`name = "${col.name}"`];
        if (!col.nullable) colParts.push('nullable = false');
        if (col.isUnique) colParts.push('unique = true');
        annotations.push(`    @Column(${colParts.join(', ')})`);

        annotations.forEach(a => lines.push(a));

        const defaultVal = col.isPrimaryKey && col.isAutoIncrement
            ? (col.nullable ? ' = null' : ' = 0')
            : (col.nullable ? ' = null' : '');
        const comma = i < fields.length - 1 ? ',' : '';
        lines.push(`    var ${field.name}: ${field.kotlinType}${defaultVal}${comma}`);
    });

    lines.push(')');
    return lines.join('\n');
}
