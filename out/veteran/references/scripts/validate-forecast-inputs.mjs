import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseLedger} from './forecast-evaluator.mjs';

const require = createRequire(import.meta.url);
const usage = 'node validate-forecast-inputs.mjs --ledger FILE --plan FILE [--evidence FILE] [--modules NODE_MODULES_DIR]';
const sha256 = raw => createHash('sha256').update(raw).digest('hex');

export async function validateInputs({ledgerFile, planFile, evidenceFile, modulesDirectory}) {
  let Ajv, addFormats, versions;
  try {
    const dependency = name => require(modulesDirectory ? resolve(modulesDirectory, name) : name);
    Ajv = dependency('ajv/dist/2020.js').default;
    addFormats = dependency('ajv-formats');
    versions = {ajv: dependency('ajv/package.json').version, ajv_formats: dependency('ajv-formats/package.json').version};
  } catch (error) {
    throw new Error(`JSON Schema validation needs ajv and ajv-formats. Install them in a separate tools folder and pass its node_modules directory with --modules. ${error.message}`);
  }
  const ajv = new Ajv({strict: false, allErrors: true, validateFormats: true});
  addFormats(ajv);
  const checks = [];
  for (const [file, schemaName, recordByRecord] of [
    [ledgerFile, 'forecast-ledger.schema.json', true],
    [planFile, 'forecast-evaluation-plan.schema.json', false],
    ...(evidenceFile ? [[evidenceFile, 'research-evidence-record.schema.json', false]] : [])
  ]) {
    const [raw, schemaRaw] = await Promise.all([readFile(file, 'utf8'), readFile(new URL('../' + schemaName, import.meta.url), 'utf8')]);
    const schema = JSON.parse(schemaRaw);
    if (!ajv.validateSchema(schema)) throw new Error(`${schemaName}: invalid schema: ${JSON.stringify(ajv.errors)}`);
    const validate = ajv.compile(schema);
    const data = recordByRecord ? parseLedger(raw) : JSON.parse(raw);
    const entries = recordByRecord ? data.map((record, index) => [index, record]) : [[null, data]];
    for (const [index, value] of entries) {
      if (!validate(value)) throw new Error(`${file}${index === null ? '' : `[${index}]`}: ${JSON.stringify(validate.errors)}`);
    }
    checks.push({file, schema: schemaName, records_checked: recordByRecord ? data.length : (Array.isArray(data) ? data.length : 1), result: 'passed', input_sha256: sha256(raw), schema_sha256: sha256(schemaRaw)});
  }
  return {validator: 'Ajv 2020-12 with date-time and URI formats asserted', versions, checks, limits: 'Structure and formats only. Run the evaluator for semantic checks; independently review source truth, availability and historical precommitment.'};
}

async function main() {
  const args = process.argv.slice(2), opts = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--(ledger|plan|evidence|modules)$/.test(args[i]) || !args[i + 1] || opts[args[i]]) throw new Error(usage);
    opts[args[i]] = args[i + 1];
  }
  if (!opts['--ledger'] || !opts['--plan']) throw new Error(usage);
  const report = await validateInputs({ledgerFile: opts['--ledger'], planFile: opts['--plan'], evidenceFile: opts['--evidence'], modulesDirectory: opts['--modules']});
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  process.stderr.write(`Input schema validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
