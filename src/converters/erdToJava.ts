// ERD → Java Entity converter
import type { ErdSchema, ErdEntity, ErdRelationship } from './erdSchema';
import { type JavaVersion, getJpaImportPrefix } from './typeMapper';

export interface ErdToJavaOptions {
    packageName: string;
    javaVersion: JavaVersion;
    useLombok: boolean;
}

const defaults: ErdToJavaOptions = {
    packageName: '',
    javaVersion: '21',
    useLombok: true,
};

function toPascalCase(s: string): string {
    return s.replace(/(^|[_\-\s])(\w)/g, (_, __, c) => c.toUpperCase());
}

function toCamelCase(s: string): string {
    const p = toPascalCase(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
}

export function erdToJava(schema: ErdSchema, opts?: Partial<ErdToJavaOptions>): string {
    const o = { ...defaults, ...opts };
    return schema.entities
        .map(entity => generateEntity(entity, schema.relationships, schema.entities, o))
        .join('\n\n// ' + '='.repeat(60) + '\n\n');
}

function generateEntity(
    entity: ErdEntity,
    relationships: ErdRelationship[],
    allEntities: ErdEntity[],
    opts: ErdToJavaOptions
): string {
    const jpaPrefix = getJpaImportPrefix(opts.javaVersion);
    const className = toPascalCase(entity.name);
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

    // Check for relationships involving this entity
    const entityRels = relationships.filter(
        r => r.fromEntityId === entity.id || r.toEntityId === entity.id
    );

    for (const rel of entityRels) {
        const isFrom = rel.fromEntityId === entity.id;
        if (rel.type === 'ONE_TO_MANY' && isFrom) {
            imports.add(`import ${jpaPrefix}.OneToMany;`);
            imports.add('import java.util.List;');
        }
        if (rel.type === 'MANY_TO_ONE' || (rel.type === 'ONE_TO_MANY' && !isFrom)) {
            imports.add(`import ${jpaPrefix}.ManyToOne;`);
            imports.add(`import ${jpaPrefix}.JoinColumn;`);
        }
        if (rel.type === 'ONE_TO_ONE') {
            imports.add(`import ${jpaPrefix}.OneToOne;`);
            if (!isFrom) imports.add(`import ${jpaPrefix}.JoinColumn;`);
        }
        if (rel.type === 'MANY_TO_MANY') {
            imports.add(`import ${jpaPrefix}.ManyToMany;`);
            if (isFrom) imports.add(`import ${jpaPrefix}.JoinTable;`);
            imports.add('import java.util.List;');
        }
    }

    const hasPK = entity.fields.some(f => f.isPrimaryKey);
    const hasAutoIncrement = entity.fields.some(f => f.isPrimaryKey);
    if (hasAutoIncrement) {
        imports.add(`import ${jpaPrefix}.GeneratedValue;`);
        imports.add(`import ${jpaPrefix}.GenerationType;`);
    }

    // Build output
    if (opts.packageName) lines.push(`package ${opts.packageName};`, '');
    lines.push(...Array.from(imports).sort(), '');

    lines.push('@Entity');
    lines.push(`@Table(name = "${entity.name}")`);
    if (opts.useLombok) {
        lines.push('@Data');
        lines.push('@NoArgsConstructor');
        lines.push('@AllArgsConstructor');
    }
    lines.push(`public class ${className} {`);
    lines.push('');

    // Fields
    for (const field of entity.fields) {
        const fieldName = toCamelCase(field.name);
        if (field.isPrimaryKey) {
            lines.push('    @Id');
            lines.push('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
        }
        const colParts: string[] = [`name = "${field.name}"`];
        if (!field.isNullable) colParts.push('nullable = false');
        if (field.isUnique) colParts.push('unique = true');
        lines.push(`    @Column(${colParts.join(', ')})`);
        lines.push(`    private ${mapErdType(field.type)} ${fieldName};`);
        lines.push('');
    }

    // Relationship fields
    for (const rel of entityRels) {
        const isFrom = rel.fromEntityId === entity.id;
        const otherEntityId = isFrom ? rel.toEntityId : rel.fromEntityId;
        const otherEntity = allEntities.find(e => e.id === otherEntityId);
        if (!otherEntity) continue;
        const otherClassName = toPascalCase(otherEntity.name);
        const otherFieldName = toCamelCase(otherEntity.name);

        if (rel.type === 'ONE_TO_MANY' && isFrom) {
            lines.push(`    @OneToMany(mappedBy = "${toCamelCase(entity.name)}")`);
            lines.push(`    private List<${otherClassName}> ${toCamelCase(otherEntity.name)}s;`);
            lines.push('');
        } else if (rel.type === 'MANY_TO_ONE' || (rel.type === 'ONE_TO_MANY' && !isFrom)) {
            lines.push(`    @ManyToOne`);
            lines.push(`    @JoinColumn(name = "${rel.toField || toCamelCase(otherEntity.name) + '_id'}")`);
            lines.push(`    private ${otherClassName} ${otherFieldName};`);
            lines.push('');
        } else if (rel.type === 'ONE_TO_ONE') {
            if (isFrom) {
                lines.push(`    @OneToOne(mappedBy = "${toCamelCase(entity.name)}")`);
            } else {
                lines.push(`    @OneToOne`);
                lines.push(`    @JoinColumn(name = "${rel.toField || toCamelCase(otherEntity.name) + '_id'}")`);
            }
            lines.push(`    private ${otherClassName} ${otherFieldName};`);
            lines.push('');
        } else if (rel.type === 'MANY_TO_MANY') {
            if (isFrom) {
                lines.push(`    @ManyToMany`);
                lines.push(`    @JoinTable(name = "${entity.name}_${otherEntity.name}")`);
            } else {
                lines.push(`    @ManyToMany(mappedBy = "${toCamelCase(entity.name)}s")`);
            }
            lines.push(`    private List<${otherClassName}> ${toCamelCase(otherEntity.name)}s;`);
            lines.push('');
        }
    }

    lines.push('}');
    return lines.join('\n');
}

function mapErdType(type: string): string {
    const map: Record<string, string> = {
        'string': 'String', 'String': 'String',
        'int': 'Integer', 'integer': 'Integer', 'Int': 'Integer', 'INTEGER': 'Integer',
        'long': 'Long', 'Long': 'Long', 'BIGINT': 'Long',
        'boolean': 'Boolean', 'Boolean': 'Boolean',
        'double': 'Double', 'Double': 'Double',
        'float': 'Float', 'Float': 'Float',
        'date': 'LocalDate', 'Date': 'LocalDate',
        'datetime': 'LocalDateTime', 'DateTime': 'LocalDateTime', 'timestamp': 'LocalDateTime',
        'uuid': 'UUID', 'UUID': 'UUID',
    };
    return map[type] || type;
}
