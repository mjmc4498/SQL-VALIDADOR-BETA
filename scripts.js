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
        const dataset2 = dataset2Input.value.trim() || dataset1; // Usa el dataset1 si el 2 está vacío
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

        // 3. Conteo de campos y tipos de datos (se ejecuta siempre para la tabla 1)
        allQueries += '-- 2. Conteo de campos y tipos de datos para la tabla de origen\n';
        allQueries += `SELECT column_name, data_type FROM \`${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}';\n\n`;

        // 5. Orden de columnas (se ejecuta siempre para la tabla 1)
        allQueries += '-- 3. Orden de columnas para la tabla de origen\n';
        allQueries += `SELECT column_name, ordinal_position FROM \`${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}' ORDER BY ordinal_position;\n\n`;


        if (table2) {
            // 2. Tipos de datos entre tabla 1 y tabla 2
            allQueries += '-- 4. Tipos de datos entre tabla 1 y tabla 2\n';
            allQueries += `SELECT
    COALESCE(a.column_name, b.column_name) as column_name,
    a.data_type AS tipo_tabla_1,
    b.data_type AS tipo_tabla_2
FROM
    (SELECT column_name, data_type FROM \`${dataset1}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}') a
FULL OUTER JOIN
    (SELECT column_name, data_type FROM \`${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}') b ON a.column_name = b.column_name
WHERE
    a.data_type IS DISTINCT FROM b.data_type;\n\n`;

            // Conteo y orden para tabla 2
            allQueries += '-- 2. Conteo de campos y tipos de datos para la tabla de destino\n';
            allQueries += `SELECT column_name, data_type FROM \`${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}';\n\n`;
            allQueries += '-- 3. Orden de columnas para la tabla de destino\n';
            allQueries += `SELECT column_name, ordinal_position FROM \`${dataset2}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}' ORDER BY ordinal_position;\n\n`;

            // 4. Validación campo a campo
            if (keyColumns) {
                const keys = keyColumns.split(',').map(c => c.trim());
                if(keys.length > 0){
                    const joinConditions = keys.map(c => `s.${c} = d.${c}`).join(' AND ');
                    const firstKey = keys[0];
                    allQueries += '-- 5. Validación campo a campo, tabla origen y tabla destino\n';
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
