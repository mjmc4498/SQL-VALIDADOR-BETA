document.addEventListener('DOMContentLoaded', () => {
    const unifiedForm = document.getElementById('unified-form');
    const outputTextarea = document.getElementById('output');
    const copyAllButton = document.getElementById('copy-all');
    const generateBtn = document.querySelector('button[type="submit"]');
    const generateBtnText = document.getElementById('generate-btn-text');
    const generateSpinner = document.getElementById('generate-spinner');

    function buildTableExpression(project, dataset, tablesString) {
        const tableNames = tablesString.split(',').map(t => t.trim()).filter(t => t);
        if (tableNames.length === 1) {
            return `\`${project}.${dataset}.${tableNames[0]}\``;
        }
        const unionAllClauses = tableNames.map(tableName => `  SELECT * FROM \`${project}.${dataset}.${tableName}\``);
        return `(\n${unionAllClauses.join('\n  UNION ALL\n')}\n)`;
    }

    unifiedForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // --- Bootstrap validation ---
        if (!unifiedForm.checkValidity()) {
            e.stopPropagation();
            unifiedForm.classList.add('was-validated');
            return;
        }
        unifiedForm.classList.add('was-validated');

        // --- Show loading state ---
        generateBtn.disabled = true;
        generateBtnText.textContent = 'Generando...';
        generateSpinner.classList.remove('d-none');

        try {
            const project1 = document.getElementById('project1').value.trim();
            const dataset1 = document.getElementById('dataset1').value.trim();
            const table1Input = document.getElementById('table1').value.trim();
            const project2 = document.getElementById('project2').value.trim() || project1;
            const dataset2 = document.getElementById('dataset2').value.trim();
            const table2Input = document.getElementById('table2').value.trim();
            const keyColumns = document.getElementById('key-columns').value.trim();
            const filters = document.getElementById('filters').value.trim();

            const sourceTables = table1Input.split(',').map(t => t.trim()).filter(t => t);
            const destTables = table2Input.split(',').map(t => t.trim()).filter(t => t);

            const dataTable1Path = buildTableExpression(project1, dataset1, table1Input);
            const dataTable2Path = buildTableExpression(project2, dataset2, table2Input);

            const whereClause = filters ? `WHERE ${filters}` : '';
            const ctes = [];
            const finalUnionClauses = [];

            // CTE 1: Row Count Validation
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
CASE
WHEN (SELECT count FROM count_t1) = (SELECT count FROM count_t2) THEN 'OK'
ELSE CONCAT('Diferencia: ', CAST(ABS((SELECT count FROM count_t1) - (SELECT count FROM count_t2)) AS STRING))
END AS resultado
)`);
            finalUnionClauses.push("SELECT * FROM validation_row_count");

            // CTE 2: Enhanced Schema Validation
            const sourceTableList = sourceTables.map(t => `'${t}'`).join(', ');
            const destTableList = destTables.map(t => `'${t}'`).join(', ');

            ctes.push(`
all_source_schemas AS (
SELECT table_name, STRING_AGG(CONCAT(column_name, ':', data_type), '|' ORDER BY ordinal_position) AS schema_signature
FROM \`${project1}.${dataset1}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name IN (${sourceTableList})
GROUP BY table_name
),
distinct_source_schemas AS (
SELECT COUNT(DISTINCT schema_signature) as count FROM all_source_schemas
),
all_dest_schemas AS (
SELECT table_name, STRING_AGG(CONCAT(column_name, ':', data_type), '|' ORDER BY ordinal_position) AS schema_signature
FROM \`${project2}.${dataset2}.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name IN (${destTableList})
GROUP BY table_name
),
distinct_dest_schemas AS (
SELECT COUNT(DISTINCT schema_signature) as count FROM all_dest_schemas
),
cross_schema_comparison AS (
SELECT
(SELECT schema_signature FROM all_source_schemas LIMIT 1) AS source_schema,
(SELECT schema_signature FROM all_dest_schemas LIMIT 1) AS dest_schema
),
validation_structure AS (
SELECT
'2. Validación de Estructura (Completa)' AS tipo_de_validacion,
CONCAT('Tablas: ${sourceTables.length}, Esquemas únicos: ', CAST((SELECT count FROM distinct_source_schemas) AS STRING)) AS valor_tabla_1,
CONCAT('Tablas: ${destTables.length}, Esquemas únicos: ', CAST((SELECT count FROM distinct_dest_schemas) AS STRING)) AS valor_tabla_2,
CASE
WHEN (SELECT count FROM distinct_source_schemas) > 1 THEN 'Error: Inconsistencia interna en esquemas de Origen'
WHEN (SELECT count FROM distinct_dest_schemas) > 1 THEN 'Error: Inconsistencia interna en esquemas de Destino'
WHEN (SELECT source_schema FROM cross_schema_comparison) != (SELECT dest_schema FROM cross_schema_comparison) THEN 'Diferencia entre esquemas de Origen y Destino'
ELSE 'OK'
END AS resultado
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

            } finally {
                // --- Hide loading state ---
                generateBtn.disabled = false;
                generateBtnText.textContent = 'Generar Consulta';
                generateSpinner.classList.add('d-none');
            }
        }, 500); // 500ms delay
    });

    copyAllButton.addEventListener('click', () => {
        if (outputTextarea.value) {
            navigator.clipboard.writeText(outputTextarea.value).then(() => {
                const originalText = copyAllButton.textContent;
                copyAllButton.textContent = '¡Copiado!';
                setTimeout(() => {
                    copyAllButton.textContent = originalText;
                }, 2000);
            });
        }
    });
});
