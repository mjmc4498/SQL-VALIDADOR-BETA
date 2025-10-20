document.addEventListener('DOMContentLoaded', () => {
    const unifiedForm = document.getElementById('unified-form');
    const datasetInput = document.getElementById('dataset');
    const table1Input = document.getElementById('table1');
    const table2Input = document.getElementById('table2');
    const keyColumnsInput = document.getElementById('key-columns');
    const outputTextarea = document.getElementById('output');
    const copyAllButton = document.getElementById('copy-all');

    unifiedForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const dataset = datasetInput.value.trim();
        const table1 = table1Input.value.trim();
        const table2 = table2Input.value.trim();
        const keyColumns = keyColumnsInput.value.trim();

        if (!dataset || !table1 || !table2) {
            alert('Por favor, complete todos los campos obligatorios.');
            return;
        }

        let allQueries = '';

        // 1. Cantidad de registros de tablas dentro de un data set
        allQueries += '-- 1. Cantidad de registros de la tabla de origen\n';
        allQueries += `SELECT COUNT(*) AS total_registros FROM \`${dataset}.${table1}\`;\n\n`;
        allQueries += '-- 1. Cantidad de registros de la tabla de destino\n';
        allQueries += `SELECT COUNT(*) AS total_registros FROM \`${dataset}.${table2}\`;\n\n`;

        // 2. Tipos de datos entre tabla 1 y tabla 2
        allQueries += '-- 2. Tipos de datos entre tabla 1 y tabla 2\n';
        allQueries += `SELECT
    COALESCE(a.column_name, b.column_name) as column_name,
    a.data_type AS tipo_tabla_1,
    b.data_type AS tipo_tabla_2
FROM
    (SELECT column_name, data_type FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}') a
FULL OUTER JOIN
    (SELECT column_name, data_type FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}') b ON a.column_name = b.column_name
WHERE
    a.data_type IS DISTINCT FROM b.data_type;\n\n`;

        // 3. Conteo de campos internos y tipo de datos
        allQueries += '-- 3. Conteo de campos internos y tipo de datos para la tabla de origen\n';
        allQueries += `SELECT column_name, data_type FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}';\n\n`;
        allQueries += '-- 3. Conteo de campos internos y tipo de datos para la tabla de destino\n';
        allQueries += `SELECT column_name, data_type FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}';\n\n`;

        // 4. Validación campo a campo, tabla origen y tabla destino
        if (keyColumns) {
            const keys = keyColumns.split(',').map(c => c.trim());
            const joinConditions = keys.map(c => `s.${c} = d.${c}`).join(' AND ');
            const firstKey = keys[0];
            allQueries += '-- 4. Validación campo a campo, tabla origen y tabla destino\n';
            allQueries += `SELECT *
FROM \`${dataset}.${table1}\` s
FULL OUTER JOIN \`${dataset}.${table2}\` d ON ${joinConditions}
WHERE TO_JSON_STRING(s) != TO_JSON_STRING(d) OR s.${firstKey} IS NULL OR d.${firstKey} IS NULL;\n\n`;
        }

        // 5. Orden de columnas y orden de campos
        allQueries += '-- 5. Orden de columnas y orden de campos para la tabla de origen\n';
        allQueries += `SELECT column_name, ordinal_position FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}' ORDER BY ordinal_position;\n\n`;
        allQueries += '-- 5. Orden de columnas y orden de campos para la tabla de destino\n';
        allQueries += `SELECT column_name, ordinal_position FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}' ORDER BY ordinal_position;\n\n`;

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
