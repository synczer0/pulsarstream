// SQL DDL → Java Entity converter
import { parseSqlDDL, type SqlTable } from './sqlParser';
import { sqlToJavaType, type JavaVersion, getJpaImportPrefix } from './typeMapper';

export interface SqlToJavaOptions {
    packageName: string;
    javaVersion: JavaVersion;
    useLombok: boolean;
    useRecords: boolean;
    generateGettersSetters: boolean;
}

const defaults: SqlToJavaOptions = {
    packageName: '',
    javaVersion: '21',
    useLombok: true,
    useRecords: false,
    generateGettersSetters: true,
};

function toPascalCase(s: string): string {
    return s.replace(/(^|[_\-\s])(\w)/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(s: string): string {
    const p = toPascalCase(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
}

export function sqlToJava(sqlStr: string, opts?: Partial<SqlToJavaOptions>): string {
    const o = { ...defaults, ...opts };
    const tables = parseSqlDDL(sqlStr);
    if (tables.length === 0) return '// Error: No CREATE TABLE statements found';
    return tables.map(t => generateEntity(t, o)).join('\n\n// ' + '='.repeat(60) + '\n\n');
}

function generateEntity(table: SqlTable, opts: SqlToJavaOptions): string {
    const jpaPrefix = getJpaImportPrefix(opts.javaVersion);
    const className = toPascalCase(table.name);
    const lines: string[] = [];
    const imports = new Set<string>();

    imports.add(`import ${jpaPrefix}.Entity;`);
    imports.add(`import ${jpaPrefix}.Table;`);
    imports.add(`import ${jpaPrefix}.Id;`);
    imports.add(`import ${jpaPrefix}.Column;`);

    if (opts.useLombok) {
        imports.add('import lombok.Data;');
        imports.add('import lombok.NoArgsConstructor;');
        imports.add('import lombok.AllArgsConstructor;');
    }

    // Collect field info first to determine needed imports
    const fields: { name: string; javaType: string; col: typeof table.columns[0] }[] = [];
    for (const col of table.columns) {
        const mapping = sqlToJavaType(col.type, opts.javaVersion);
        let javaType = mapping.javaType;
        // Simplify fully qualified types
        if (mapping.javaImport) {
            imports.add(`import ${mapping.javaImport};`);
            javaType = javaType.split('.').pop()!;
        }
        fields.push({ name: toCamelCase(col.name), javaType, col });
    }

    const hasAutoIncrement = table.columns.some(c => c.isAutoIncrement);
    if (hasAutoIncrement) {
        imports.add(`import ${jpaPrefix}.GeneratedValue;`);
        imports.add(`import ${jpaPrefix}.GenerationType;`);
    }

    // Build output
    if (opts.packageName) lines.push(`package ${opts.packageName};`, '');
    lines.push(...Array.from(imports).sort(), '');

    lines.push('@Entity');
    lines.push(`@Table(name = "${table.name}")`);
    if (opts.useLombok) {
        lines.push('@Data');
        lines.push('@NoArgsConstructor');
        lines.push('@AllArgsConstructor');
    }
    lines.push(`public class ${className} {`);
    lines.push('');

    for (const field of fields) {
        const { col } = field;
        if (col.isPrimaryKey) {
            lines.push('    @Id');
            if (col.isAutoIncrement) {
                lines.push('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
            }
        }

        const colAnnotation: string[] = [];
        colAnnotation.push(`name = "${col.name}"`);
        if (!col.nullable) colAnnotation.push('nullable = false');
        if (col.isUnique) colAnnotation.push('unique = true');
        lines.push(`    @Column(${colAnnotation.join(', ')})`);
        lines.push(`    private ${field.javaType} ${field.name};`);
        lines.push('');
    }

    if (opts.generateGettersSetters && !opts.useLombok) {
        for (const f of fields) {
            const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
            const getter = f.javaType === 'boolean' ? 'is' : 'get';
            lines.push(`    public ${f.javaType} ${getter}${cap}() { return this.${f.name}; }`);
            lines.push(`    public void set${cap}(${f.javaType} ${f.name}) { this.${f.name} = ${f.name}; }`);
            lines.push('');
        }
    }

    lines.push('}');
    return lines.join('\n');
}
