document.addEventListener('DOMContentLoaded', () => {
    const unifiedForm = document.getElementById('unified-form');
    const outputTextarea = document.getElementById('output');
    const copyAllButton = document.getElementById('copy-all');

    unifiedForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Extraer valores del formulario
        const project1 = document.getElementById('project1').value.trim();
        const dataset1 = document.getElementById('dataset1').value.trim();
        const table1 = document.getElementById('table1').value.trim();
        const project2 = document.getElementById('project2').value.trim() || project1;
        const dataset2 = document.getElementById('dataset2').value.trim();
        const table2 = document.getElementById('table2').value.trim();
        const keyColumns = document.getElementById('key-columns').value.trim();
        const filters = document.getElementById('filters').value.trim();

        if (!project1 || !dataset1 || !table1 || !project2 || !dataset2 || !table2) {
            alert('Para generar la consulta de resumen, debe proporcionar los detalles completos para la Tabla 1 (origen) y la Tabla 2 (destino).');
            return;
        }

        const fullTable1Path = `\`${project1}.${dataset1}.${table1}\``;
        const fullTable2Path = `\`${project2}.${dataset2}.${table2}\``;
        const whereClause = filters ? `WHERE ${filters}` : '';

        const ctes = [];
        const finalUnionClauses = [];

        // CTE 1: Row Count Validation
        ctes.push(`
count_t1 AS (
  SELECT COUNT(*) as count FROM ${fullTable1Path} ${whereClause}
),
count_t2 AS (
  SELECT COUNT(*) as count FROM ${fullTable2Path} ${whereClause}
),
validation_row_count AS (
  SELECT
    '1. Cantidad de Registros' AS tipo_de_validacion,
    CAST((SELECT count FROM count_t1) AS STRING) AS valor_tabla_1,
    CAST((SELECT count FROM count_t2) AS STRING) AS valor_tabla_2,
    IF((SELECT count FROM count_t1) = (SELECT count FROM count_t2), 'OK', 'Diferencia') AS resultado
)`);
        finalUnionClauses.push("SELECT * FROM validation_row_count");

        // CTE 2: Schema/Structure Validation
        ctes.push(`
schema_t1 AS (
  SELECT column_name, data_type, ordinal_position FROM \`${project1}.${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}'
),
schema_t2 AS (
  SELECT column_name, data_type, ordinal_position FROM \`${project2}.${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}'
),
schema_discrepancies AS (
  SELECT COUNT(*) AS count
  FROM schema_t1 t1
  FULL OUTER JOIN schema_t2 t2 ON t1.column_name = t2.column_name
  WHERE t1.column_name IS NULL
     OR t2.column_name IS NULL
     OR t1.data_type != t2.data_type
     OR t1.ordinal_position != t2.ordinal_position
),
validation_structure AS (
  SELECT
    '2. Validación de Estructura' AS tipo_de_validacion,
    CONCAT('Columnas: ', CAST((SELECT COUNT(*) FROM schema_t1) AS STRING)) AS valor_tabla_1,
    CONCAT('Columnas: ', CAST((SELECT COUNT(*) FROM schema_t2) AS STRING)) AS valor_tabla_2,
    IF((SELECT count FROM schema_discrepancies) = 0, 'OK', CONCAT('Diferencia (', CAST((SELECT count FROM schema_discrepancies) AS STRING), ' columnas)')) AS resultado
)`);
        finalUnionClauses.push("SELECT * FROM validation_structure");

        // CTE 3: Data Diff Validation (Optional)
        if (keyColumns) {
            const keys = keyColumns.split(',').map(c => c.trim());
            if (keys.length > 0 && keys[0] !== '') {
                const joinConditions = keys.map(c => `s.\`${c}\` = d.\`${c}\``).join(' AND ');
                const nonNullKeyCheck = keys.map(c => `s.\`${c}\` IS NOT NULL AND d.\`${c}\` IS NOT NULL`).join(' AND ');

                ctes.push(`
source_data AS (
  SELECT * FROM ${fullTable1Path} ${whereClause}
),
dest_data AS (
  SELECT * FROM ${fullTable2Path} ${whereClause}
),
data_diff AS (
  SELECT
    COUNTIF(d.\`${keys[0]}\` IS NULL) AS only_in_source,
    COUNTIF(s.\`${keys[0]}\` IS NULL) AS only_in_dest,
    COUNTIF(${nonNullKeyCheck} AND TO_JSON_STRING(s) != TO_JSON_STRING(d)) as mismatched_data
  FROM source_data s
  FULL OUTER JOIN dest_data d ON ${joinConditions}
),
validation_data_diff AS (
  SELECT
    '3. Validación de Datos (Campo a Campo)' AS tipo_de_validacion,
    CONCAT('Solo en Origen: ', CAST(only_in_source AS STRING), '\\nDatos Diferentes: ', CAST(mismatched_data AS STRING)) AS valor_tabla_1,
    CONCAT('Solo en Destino: ', CAST(only_in_dest AS STRING), '\\nDatos Diferentes: ', CAST(mismatched_data AS STRING)) AS valor_tabla_2,
    IF(only_in_source = 0 AND only_in_dest = 0 AND mismatched_data = 0, 'OK', 'Diferencia') AS resultado
  FROM data_diff
)`);
                finalUnionClauses.push("SELECT * FROM validation_data_diff");
            }
        }

        // Combine all CTEs and the final SELECT statement
        const summaryQuery = `WITH\n${ctes.join(',\n\n')}\n\n-- =============================================\n-- Resultado Final Combinado\n-- =============================================\n${finalUnionClauses.join('\nUNION ALL\n')}\nORDER BY tipo_de_validacion;`;

        outputTextarea.value = summaryQuery;
    });

    copyAllButton.addEventListener('click', () => {
        if (outputTextarea.value) {
            outputTextarea.select();
            document.execCommand('copy');
            alert('Consulta de Resumen copiada al portapapeles');
        }
    });
});
