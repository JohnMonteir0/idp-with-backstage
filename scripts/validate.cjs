// Render the Backstage templates and validate their intent-based platform requests.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const YAML = require('yaml');
const nunjucks = require('nunjucks');
const Ajv = require('ajv');

const env = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: true,
  tags: { variableStart: '${{', variableEnd: '}}' },
});
const ajv = new Ajv({ strict: false, validateFormats: false });
const xrd = YAML.parse(fs.readFileSync('platform/crossplane/apis/postgresql-database-xrd.yaml', 'utf8'));
const xrSchema = xrd.spec.versions.find(v => v.name === 'v1alpha1').schema.openAPIV3Schema;
const validateXr = ajv.compile(xrSchema);

for (const name of ['rds-postgres', 'aurora-postgres']) {
  const template = YAML.parse(fs.readFileSync(`catalog/templates/${name}/template.yaml`, 'utf8'));
  const sample = {
    name: 'orders', owner: 'payments-team', environment: 'production',
    databaseName: 'appdb', size: 'small', availability: 'highly-available',
    region: 'us-east-1', vpcId: 'vpc-0123456789abcdef0',
    subnetIds: ['subnet-0123456789abcdef0', 'subnet-0123456789abcdef1'],
    clientSecurityGroupId: 'sg-0123456789abcdef0',
  };
  if (name.startsWith('aurora')) delete sample.availability;
  for (const section of template.spec.parameters) {
    const validate = ajv.compile({ type: 'object', ...section });
    assert(validate(sample), `${name}: ${JSON.stringify(validate.errors)}`);
  }
  const render = template.spec.steps.find(step => step.id === 'render');
  for (const key of Object.keys(sample)) {
    assert.equal(render.input.values[key], `\${{ parameters.${key} }}`);
  }
  const text = env.renderString(
    fs.readFileSync(`catalog/templates/${name}/skeleton/database.yaml`, 'utf8'),
    { values: sample },
  );
  assert(!text.includes('${{'));
  const request = YAML.parse(text);
  assert(validateXr(request), `${name}: ${JSON.stringify(validateXr.errors)}`);
  assert.equal(request.kind, 'PostgreSQLDatabase');
  assert.equal(request.spec.engine, name.startsWith('aurora') ? 'aurora' : 'rds');
  assert.equal(request.spec.crossplane.compositionRef.name, name.startsWith('aurora') ? 'postgresql-aurora' : 'postgresql-rds');
  assert.equal(request.spec.owner, sample.owner);
  assert.deepEqual(request.spec.network.subnetIds, sample.subnetIds);
  assert.match(template.spec.steps.find(step => step.id === 'publish').input.targetPath, /^requests\/databases\//);
  console.log(`${name}: one PostgreSQLDatabase request passed`);
}

const compositions = YAML.parseAllDocuments(
  fs.readFileSync('platform/crossplane/apis/postgresql-compositions.yaml', 'utf8'),
).map(document => document.toJS());
assert.deepEqual(compositions.map(c => c.metadata.name), ['postgresql-rds', 'postgresql-aurora']);
for (const composition of compositions) {
  assert.equal(composition.spec.mode, 'Pipeline');
  assert.equal(composition.spec.pipeline[0].functionRef.name, 'function-patch-and-transform');
}
