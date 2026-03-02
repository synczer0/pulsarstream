// ERD → Kotlin Entity converter
import type { ErdSchema, ErdEntity, ErdRelationship } from './erdSchema';
import { type KotlinVersion, type JavaVersion, getJpaImportPrefix } from './typeMapper';

export interface ErdToKotlinOptions {
    packageName: string;
    kotlinVersion: KotlinVersion;
    javaVersion: JavaVersion;
}

const defaults: ErdToKotlinOptions = {
    packageName: '',
    kotlinVersion: '2.1',
    javaVersion: '21',
};

function toPascalCase(s: string): string {
    return s.replace(/(^|[_\-\s])(\w)/g, (_, __, c) => c.toUpperCase());
}
function toCamelCase(s: string): string {
    const p = toPascalCase(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
}

export function erdToKotlin(schema: ErdSchema, opts?: Partial<ErdToKotlinOptions>): string {
    const o = { ...defaults, ...opts };
    return schema.entities
        .map(e => generateEntity(e, schema.relationships, schema.entities, o))
        .join('\n\n// ' + '='.repeat(60) + '\n\n');
}

function generateEntity(
    entity: ErdEntity,
    relationships: ErdRelationship[],
    allEntities: ErdEntity[],
    opts: ErdToKotlinOptions
): string {
    const jpaPrefix = getJpaImportPrefix(opts.javaVersion);
    const className = toPascalCase(entity.name);
    const lines: string[] = [];
    const imports = new Set<string>();

    imports.add(`import ${jpaPrefix}.Entity`);
    imports.add(`import ${jpaPrefix}.Table`);
    imports.add(`import ${jpaPrefix}.Id`);
    imports.add(`import ${jpaPrefix}.Column`);
    imports.add(`import ${jpaPrefix}.GeneratedValue`);
    imports.add(`import ${jpaPrefix}.GenerationType`);

    const entityRels = relationships.filter(r => r.fromEntityId === entity.id || r.toEntityId === entity.id);
    for (const rel of entityRels) {
        const isFrom = rel.fromEntityId === entity.id;
        if (rel.type === 'ONE_TO_MANY' && isFrom) imports.add(`import ${jpaPrefix}.OneToMany`);
        if (rel.type === 'MANY_TO_ONE' || (rel.type === 'ONE_TO_MANY' && !isFrom)) {
            imports.add(`import ${jpaPrefix}.ManyToOne`);
            imports.add(`import ${jpaPrefix}.JoinColumn`);
        }
        if (rel.type === 'ONE_TO_ONE') {
            imports.add(`import ${jpaPrefix}.OneToOne`);
            if (!isFrom) imports.add(`import ${jpaPrefix}.JoinColumn`);
        }
        if (rel.type === 'MANY_TO_MANY') {
            imports.add(`import ${jpaPrefix}.ManyToMany`);
            if (isFrom) imports.add(`import ${jpaPrefix}.JoinTable`);
        }
    }

    if (opts.packageName) lines.push(`package ${opts.packageName}`, '');
    lines.push(...Array.from(imports).sort(), '');

    lines.push('@Entity');
    lines.push(`@Table(name = "${entity.name}")`);
    lines.push(`data class ${className}(`);

    const allFields: string[] = [];

    for (const field of entity.fields) {
        const fieldLines: string[] = [];
        const fName = toCamelCase(field.name);
        const kType = mapErdTypeKotlin(field.type) + (field.isNullable ? '?' : '');

        if (field.isPrimaryKey) {
            fieldLines.push('    @Id');
            fieldLines.push('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
        }
        const colParts: string[] = [`name = "${field.name}"`];
        if (!field.isNullable) colParts.push('nullable = false');
        if (field.isUnique) colParts.push('unique = true');
        fieldLines.push(`    @Column(${colParts.join(', ')})`);
        const defVal = field.isPrimaryKey ? ' = 0' : (field.isNullable ? ' = null' : '');
        fieldLines.push(`    var ${fName}: ${kType}${defVal}`);
        allFields.push(fieldLines.join('\n'));
    }

    // Relationship fields
    for (const rel of entityRels) {
        const isFrom = rel.fromEntityId === entity.id;
        const otherId = isFrom ? rel.toEntityId : rel.fromEntityId;
        const other = allEntities.find(e => e.id === otherId);
        if (!other) continue;
        const otherClass = toPascalCase(other.name);
        const otherField = toCamelCase(other.name);
        const relLines: string[] = [];

        if (rel.type === 'ONE_TO_MANY' && isFrom) {
            relLines.push(`    @OneToMany(mappedBy = "${toCamelCase(entity.name)}")`);
            relLines.push(`    var ${otherField}s: List<${otherClass}> = emptyList()`);
        } else if (rel.type === 'MANY_TO_ONE' || (rel.type === 'ONE_TO_MANY' && !isFrom)) {
            relLines.push(`    @ManyToOne`);
            relLines.push(`    @JoinColumn(name = "${rel.toField || otherField + '_id'}")`);
            relLines.push(`    var ${otherField}: ${otherClass}? = null`);
        } else if (rel.type === 'ONE_TO_ONE') {
            if (isFrom) relLines.push(`    @OneToOne(mappedBy = "${toCamelCase(entity.name)}")`);
            else { relLines.push(`    @OneToOne`); relLines.push(`    @JoinColumn(name = "${rel.toField || otherField + '_id'}")`); }
            relLines.push(`    var ${otherField}: ${otherClass}? = null`);
        } else if (rel.type === 'MANY_TO_MANY') {
            if (isFrom) { relLines.push(`    @ManyToMany`); relLines.push(`    @JoinTable(name = "${entity.name}_${other.name}")`); }
            else relLines.push(`    @ManyToMany(mappedBy = "${toCamelCase(entity.name)}s")`);
            relLines.push(`    var ${otherField}s: List<${otherClass}> = emptyList()`);
        }
        if (relLines.length) allFields.push(relLines.join('\n'));
    }

    lines.push(allFields.join(',\n\n'));
    lines.push(')');
    return lines.join('\n');
}

function mapErdTypeKotlin(type: string): string {
    const map: Record<string, string> = {
        'string': 'String', 'String': 'String',
        'int': 'Int', 'integer': 'Int', 'Int': 'Int', 'INTEGER': 'Int',
        'long': 'Long', 'Long': 'Long', 'BIGINT': 'Long',
        'boolean': 'Boolean', 'Boolean': 'Boolean',
        'double': 'Double', 'Double': 'Double',
        'float': 'Float', 'Float': 'Float',
        'date': 'java.time.LocalDate', 'Date': 'java.time.LocalDate',
        'datetime': 'java.time.LocalDateTime', 'timestamp': 'java.time.LocalDateTime',
        'uuid': 'java.util.UUID', 'UUID': 'java.util.UUID',
    };
    return map[type] || type;
}
