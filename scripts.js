document.addEventListener('DOMContentLoaded', () => {
    const unifiedForm = document.getElementById('unified-form');
    const dataset1Input = document.getElementById('dataset1');
    const table1Input = document.getElementById('table1');
    const dataset2Input = document.getElementById('dataset2');
    const table2Input = document.getElementById('table2');
    const keyColumnsInput = document.getElementById('key-columns');
    const filtersInput = document.getElementById('filters');
    const outputTextarea = document.getElementById('output');
    const copyAllButton = document.getElementById('copy-all');

    unifiedForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const dataset1 = dataset1Input.value.trim();
        const table1 = table1Input.value.trim();
        const dataset2 = dataset2Input.value.trim() || dataset1;
        const table2 = table2Input.value.trim();
        const keyColumns = keyColumnsInput.value.trim();
        const filters = filtersInput.value.trim();

        if (!dataset1 || !table1) {
            alert('Por favor, complete al menos el Dataset 1 y la Tabla 1.');
            return;
        }

        let allQueries = '';
        const whereClause = filters ? `\nWHERE ${filters}` : '';

        // 1. Cantidad de registros
        allQueries += '-- 1. Cantidad de registros de la tabla de origen\n';
        allQueries += `SELECT COUNT(*) AS total_registros FROM \`${dataset1}.${table1}\`${whereClause};\n\n`;

        if (table2) {
            allQueries += '-- 1. Cantidad de registros de la tabla de destino\n';
            allQueries += `SELECT COUNT(*) AS total_registros FROM \`${dataset2}.${table2}\`${whereClause};\n\n`;
        }

        // Conteo de campos y tipos de datos para la tabla de origen
        allQueries += '-- 2. Conteo de campos y tipos de datos para la tabla de origen\n';
        allQueries += `SELECT column_name, data_type, ordinal_position FROM \`${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}' ORDER BY ordinal_position;\n\n`;

        if (table2) {
            // Conteo de campos y tipos de datos para la tabla de destino
            allQueries += '-- 2. Conteo de campos y tipos de datos para la tabla de destino\n';
            allQueries += `SELECT column_name, data_type, ordinal_position FROM \`${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}' ORDER BY ordinal_position;\n\n`;

            // Nueva Validación de Estructura
            allQueries += '-- 3. Validación de Estructura (Columnas, Tipos de Datos y Posición)\n';
            allQueries += `WITH schema_t1 AS (
    SELECT column_name, data_type, ordinal_position FROM \`${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}'
),
schema_t2 AS (
    SELECT column_name, data_type, ordinal_position FROM \`${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}'
)
SELECT
    COALESCE(t1.column_name, t2.column_name) AS column_name,
    t1.ordinal_position AS posicion_t1,
    t2.ordinal_position AS posicion_t2,
    t1.data_type AS tipo_dato_t1,
    t2.data_type AS tipo_dato_t2,
    CASE
        WHEN t1.column_name IS NULL THEN 'Columna solo en tabla 2'
        WHEN t2.column_name IS NULL THEN 'Columna solo en tabla 1'
        WHEN t1.data_type != t2.data_type THEN 'Diferente tipo de dato'
        WHEN t1.ordinal_position != t2.ordinal_position THEN 'Diferente posición'
        ELSE 'OK'
    END AS estado
FROM schema_t1 t1
FULL OUTER JOIN schema_t2 t2 ON t1.column_name = t2.column_name
WHERE
    t1.column_name IS NULL
    OR t2.column_name IS NULL
    OR t1.data_type != t2.data_type
    OR t1.ordinal_position != t2.ordinal_position
ORDER BY
    COALESCE(t1.ordinal_position, t2.ordinal_position);\n\n`;

            // Validación campo a campo
            if (keyColumns) {
                const keys = keyColumns.split(',').map(c => c.trim());
                if(keys.length > 0){
                    const joinConditions = keys.map(c => `s.${c} = d.${c}`).join(' AND ');
                    const firstKey = keys[0];
                    allQueries += '-- 4. Validación campo a campo (datos)\n';
                    allQueries += `WITH source AS (
    SELECT * FROM \`${dataset1}.${table1}\`${whereClause}
),
destination AS (
    SELECT * FROM \`${dataset2}.${table2}\`${whereClause}
)
SELECT *
FROM source s
FULL OUTER JOIN destination d ON ${joinConditions}
WHERE TO_JSON_STRING(s) != TO_JSON_STRING(d) OR s.${firstKey} IS NULL OR d.${firstKey} IS NULL;\n\n`;
                }
            }
        }

        outputTextarea.value = allQueries;
    });

    copyAllButton.addEventListener('click', () => {
        if (outputTextarea.value) {
            outputTextarea.select();
            document.execCommand('copy');
            alert('Consultas SQL copiadas al portapapeles');
        }
    });
});
