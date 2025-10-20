document.addEventListener('DOMContentLoaded', () => {
    const recordCountForm = document.getElementById('record-count-form');
    const rcDataset = document.getElementById('rc-dataset');
    const rcTable = document.getElementById('rc-table');
    const rcOutput = document.getElementById('rc-output');
    const rcCopy = document.getElementById('rc-copy');

    recordCountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dataset = rcDataset.value.trim();
        const table = rcTable.value.trim();
        if (dataset && table) {
            const sql = `SELECT COUNT(*) FROM \`${dataset}.${table}\`;`;
            rcOutput.value = sql;
        }
    });

    rcCopy.addEventListener('click', () => {
        rcOutput.select();
        document.execCommand('copy');
        alert('SQL copiado al portapapeles');
    });

    const dataTypeComparisonForm = document.getElementById('data-type-comparison-form');
    const dtcDataset = document.getElementById('dtc-dataset');
    const dtcTable1 = document.getElementById('dtc-table1');
    const dtcTable2 = document.getElementById('dtc-table2');
    const dtcOutput = document.getElementById('dtc-output');
    const dtcCopy = document.getElementById('dtc-copy');

    dataTypeComparisonForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dataset = dtcDataset.value.trim();
        const table1 = dtcTable1.value.trim();
        const table2 = dtcTable2.value.trim();
        if (dataset && table1 && table2) {
            const sql = `SELECT
    COALESCE(a.column_name, b.column_name) as column_name,
    a.data_type AS tipo_tabla_1,
    b.data_type AS tipo_tabla_2
FROM
    (SELECT column_name, data_type FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table1}') a
FULL OUTER JOIN
    (SELECT column_name, data_type FROM \`${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${table2}') b ON a.column_name = b.column_name
WHERE
    a.data_type IS DISTINCT FROM b.data_type;`;
            dtcOutput.value = sql;
        }
    });

    dtcCopy.addEventListener('click', () => {
        dtcOutput.select();
        document.execCommand('copy');
        alert('SQL copiado al portapapeles');
    });

    const fieldCountForm = document.getElementById('field-count-form');
    const fcDataset = document.getElementById('fc-dataset');
    const fcTable = document.getElementById('fc-table');
    const fcOutput = document.getElementById('fc-output');
    const fcCopy = document.getElementById('fc-copy');

    fieldCountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dataset = fcDataset.value.trim();
        const table = fcTable.value.trim();
        if (dataset && table) {
            const sql = `SELECT
    column_name,
    data_type
FROM
    \`${dataset}.INFORMATION_SCHEMA.COLUMNS\`
WHERE
    table_name = '${table}';`;
            fcOutput.value = sql;
        }
    });

    fcCopy.addEventListener('click', () => {
        fcOutput.select();
        document.execCommand('copy');
        alert('SQL copiado al portapapeles');
    });

    const fieldValidationForm = document.getElementById('field-validation-form');
    const fvDataset = document.getElementById('fv-dataset');
    const fvTableSource = document.getElementById('fv-table-source');
    const fvTableDest = document.getElementById('fv-table-dest');
    const fvKeyColumns = document.getElementById('fv-key-columns');
    const fvOutput = document.getElementById('fv-output');
    const fvCopy = document.getElementById('fv-copy');

    fieldValidationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dataset = fvDataset.value.trim();
        const sourceTable = fvTableSource.value.trim();
        const destTable = fvTableDest.value.trim();
        const keyColumns = fvKeyColumns.value.trim().split(',').map(c => c.trim());

        if (dataset && sourceTable && destTable && keyColumns.length > 0) {
            const joinConditions = keyColumns.map(c => `s.${c} = d.${c}`).join(' AND ');
            const firstKey = keyColumns[0];
            const sql = `SELECT *
FROM \`${dataset}.${sourceTable}\` s
FULL OUTER JOIN \`${dataset}.${destTable}\` d ON ${joinConditions}
WHERE TO_JSON_STRING(s) != TO_JSON_STRING(d) OR s.${firstKey} IS NULL OR d.${firstKey} IS NULL;`;
            fvOutput.value = sql;
        }
    });

    fvCopy.addEventListener('click', () => {
        fvOutput.select();
        document.execCommand('copy');
        alert('SQL copiado al portapapeles');
    });

    const columnOrderForm = document.getElementById('column-order-form');
    const coDataset = document.getElementById('co-dataset');
    const coTable = document.getElementById('co-table');
    const coOutput = document.getElementById('co-output');
    const coCopy = document.getElementById('co-copy');

    columnOrderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dataset = coDataset.value.trim();
        const table = coTable.value.trim();
        if (dataset && table) {
            const sql = `SELECT
    column_name,
    ordinal_position
FROM
    \`${dataset}.INFORMATION_SCHEMA.COLUMNS\`
WHERE
    table_name = '${table}'
ORDER BY
    ordinal_position;`;
            coOutput.value = sql;
        }
    });

    coCopy.addEventListener('click', () => {
        coOutput.select();
        document.execCommand('copy');
        alert('SQL copiado al portapapeles');
    });
});