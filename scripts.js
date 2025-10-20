document.addEventListener('DOMContentLoaded', () => {
    const unifiedForm = document.getElementById('unified-form');
    const outputTextarea = document.getElementById('output');
    const copyAllButton = document.getElementById('copy-all');

    /**
     * Construye una expresión de tabla SQL a partir de una lista de nombres de tabla.
     * Si hay una tabla, devuelve la ruta completa.
     * Si hay varias, las une con UNION ALL dentro de una subconsulta.
     * @param {string} project - El proyecto de GCP.
     * @param {string} dataset - El dataset de BigQuery.
     * @param {string} tablesString - Un string de nombres de tabla separados por comas.
     * @returns {string} La expresión de tabla SQL.
     */
    function buildTableExpression(project, dataset, tablesString) {
        const tableNames = tablesString.split(',').map(t => t.trim()).filter(t => t);
        if (tableNames.length === 1) {
            return `\`${project}.${dataset}.${tableNames[0]}\``;
        }

        const unionAllClauses = tableNames.map(tableName =>
            `  SELECT * FROM \`${project}.${dataset}.${tableName}\``
        );

        return `(\n${unionAllClauses.join('\n  UNION ALL\n')}\n)`;
    }

    unifiedForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Extraer valores del formulario
        const project1 = document.getElementById('project1').value.trim();
        const dataset1 = document.getElementById('dataset1').value.trim();
        const table1Input = document.getElementById('table1').value.trim();
        const project2 = document.getElementById('project2').value.trim() || project1;
        const dataset2 = document.getElementById('dataset2').value.trim();
        const table2Input = document.getElementById('table2').value.trim();
        const keyColumns = document.getElementById('key-columns').value.trim();
        const filters = document.getElementById('filters').value.trim();

        if (!project1 || !dataset1 || !table1Input || !project2 || !dataset2 || !table2Input) {
            alert('Para generar la consulta de resumen, debe proporcionar los detalles completos para la Tabla 1 (origen) y la Tabla 2 (destino).');
            return;
        }

        // Construir las expresiones de tabla para las validaciones de datos
        const dataTable1Path = buildTableExpression(project1, dataset1, table1Input);
        const dataTable2Path = buildTableExpression(project2, dataset2, table2Input);

        // Para la validación de esquema, usar solo la primera tabla de la lista
        const schemaTable1Name = table1Input.split(',')[0].trim();
        const schemaTable2Name = table2Input.split(',')[0].trim();

        const whereClause = filters ? `WHERE ${filters}` : '';

        const ctes = [];
        const finalUnionClauses = [];

        // CTE 1: Validación de Conteo de Registros
        ctes.push(`
count_t1 AS (
  SELECT COUNT(*) as count FROM ${dataTable1Path} ${whereClause}
),
count_t2 AS (
  SELECT COUNT(*) as count FROM ${dataTable2Path} ${whereClause}
),
validation_row_count AS (
  SELECT
    '1. Cantidad de Registros' AS tipo_de_validacion,
    CAST((SELECT count FROM count_t1) AS STRING) AS valor_tabla_1,
    CAST((SELECT count FROM count_t2) AS STRING) AS valor_tabla_2,
    IF((SELECT count FROM count_t1) = (SELECT count FROM count_t2), 'OK', 'Diferencia') AS resultado
)`);
        finalUnionClauses.push("SELECT * FROM validation_row_count");

        // CTE 2: Validación de Estructura (basada en la primera tabla de cada lista)
        ctes.push(`
schema_t1 AS (
  SELECT column_name, data_type, ordinal_position FROM \`${project1}.${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${schemaTable1Name}'
),
schema_t2 AS (
  SELECT column_name, data_type, ordinal_position FROM \`${project2}.${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${schemaTable2Name}'
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
    '2. Validación de Estructura (usando ${schemaTable1Name} y ${schemaTable2Name})' AS tipo_de_validacion,
    CONCAT('Columnas: ', CAST((SELECT COUNT(*) FROM schema_t1) AS STRING)) AS valor_tabla_1,
    CONCAT('Columnas: ', CAST((SELECT COUNT(*) FROM schema_t2) AS STRING)) AS valor_tabla_2,
    IF((SELECT count FROM schema_discrepancies) = 0, 'OK', CONCAT('Diferencia (', CAST((SELECT count FROM schema_discrepancies) AS STRING), ' columnas)')) AS resultado
)`);
        finalUnionClauses.push("SELECT * FROM validation_structure");

        // CTE 3: Validación de Datos (Opcional)
        if (keyColumns) {
            const keys = keyColumns.split(',').map(c => c.trim());
            if (keys.length > 0 && keys[0] !== '') {
                const joinConditions = keys.map(c => `s.\`${c}\` = d.\`${c}\``).join(' AND ');
                const nonNullKeyCheck = keys.map(c => `s.\`${c}\` IS NOT NULL AND d.\`${c}\` IS NOT NULL`).join(' AND ');

                ctes.push(`
source_data AS (
  SELECT * FROM ${dataTable1Path} ${whereClause}
),
dest_data AS (
  SELECT * FROM ${dataTable2Path} ${whereClause}
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
