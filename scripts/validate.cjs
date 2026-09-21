// Run from the repository root. Dependencies are installed outside the repository.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const YAML = require('yaml');
const nunjucks = require('nunjucks');
const Ajv = require('ajv');
const env = new nunjucks.Environment(null, {
  autoescape: false, throwOnUndefined: true,
  tags: { variableStart: '${{', variableEnd: '}}' },
});
const ajv = new Ajv({ strict: false, validateFormats: false });
const values = {
  name: 'test-db', databaseName: 'appdb', region: 'us-east-1',
  instanceClass: 'db.t3.micro', storageGiB: 20,
  vpcId: 'vpc-0123456789abcdef0',
  subnetIds: ['subnet-0123456789abcdef0', 'subnet-0123456789abcdef1'],
  clientSecurityGroupId: 'sg-0123456789abcdef0',
};
const schemas = new Map();
const schemaFlag = process.argv.indexOf('--schemas');
if (schemaFlag !== -1) {
  for (const file of fs.readdirSync(process.argv[schemaFlag + 1])) {
    if (!file.endsWith('.yaml')) continue;
    const crd = YAML.parse(fs.readFileSync(path.join(process.argv[schemaFlag + 1], file), 'utf8'));
    if (crd?.kind !== 'CustomResourceDefinition') continue;
    for (const version of crd.spec.versions) {
      const schema = version.schema.openAPIV3Schema;
      // Catch fields Kubernetes would otherwise silently prune.
      function forbidUnknown(s) {
        if (s.properties && !s.additionalProperties && !s['x-kubernetes-preserve-unknown-fields']) s.additionalProperties = false;
        for (const child of Object.values(s.properties || {})) forbidUnknown(child);
        if (s.items) forbidUnknown(s.items);
      }
      forbidUnknown(schema.properties.spec);
      schemas.set(`${crd.spec.group}/${version.name}/${crd.spec.names.kind}`, ajv.compile(schema));
    }
  }
}
for (const name of ['rds-postgres', 'aurora-postgres']) {
  const dir = `catalog/templates/${name}`;
  const template = YAML.parse(fs.readFileSync(`${dir}/template.yaml`, 'utf8'));
  const sample = { ...values, instanceClass: name.startsWith('aurora') ? 'db.r6g.large' : 'db.t3.micro' };
  if (name.startsWith('aurora')) delete sample.storageGiB;
  for (const section of template.spec.parameters) {
    const validate = ajv.compile({ type: 'object', ...section });
    assert(validate(sample), JSON.stringify(validate.errors));
  }
  const renderStep = template.spec.steps.find(s => s.id === 'render');
  for (const key of Object.keys(sample)) assert.equal(renderStep.input.values[key], '${{ parameters.' + key + ' }}');
  const resources = fs.readdirSync(`${dir}/skeleton`).filter(f => f.endsWith('.yaml')).map(file => {
    const text = env.renderString(fs.readFileSync(`${dir}/skeleton/${file}`, 'utf8'), { values: sample });
    assert(!text.includes('${{'));
    const obj = YAML.parse(text);
    if (obj.apiVersion === 'backstage.io/v1alpha1' && obj.kind === 'Resource') return null;
    if (schemaFlag !== -1) {
      const validate = schemas.get(`${obj.apiVersion}/${obj.kind}`);
      assert(validate, `Missing schema for ${obj.kind}`);
      assert(validate(obj), `${file}: ${JSON.stringify(validate.errors)}`);
    }
    return obj;
  }).filter(Boolean);
  const names = new Set(resources.map(r => r.metadata.name));
  assert.equal(names.size, resources.length);
  for (const resource of resources) {
    const fp = resource.spec.forProvider;
    assert.equal(resource.spec.deletionPolicy, 'Orphan');
    assert.equal(resource.spec.providerConfigRef.name, 'aws');
    for (const [key, value] of Object.entries(fp)) {
      if (key.endsWith('Ref')) assert(names.has(value.name), `${key}: missing ${value.name}`);
      if (key.endsWith('Refs')) value.forEach(ref => assert(names.has(ref.name)));
    }
    if (['Instance', 'ClusterInstance'].includes(resource.kind)) assert.equal(fp.publiclyAccessible, false);
    if (['Instance', 'Cluster'].includes(resource.kind)) {
      assert.equal(fp.manageMasterUserPassword, true);
      assert.equal(fp.storageEncrypted, true);
      assert.equal(fp.deletionProtection, true);
      assert.equal(fp.backupRetentionPeriod, 7);
    }
  }
  assert.deepEqual(resources.find(r => r.kind === 'SubnetGroup').spec.forProvider.subnetIds, sample.subnetIds);
  const subnetGroup = resources.find(r => r.kind === 'SubnetGroup');
  const securityGroup = resources.find(r => r.kind === 'SecurityGroup');
  assert.equal(subnetGroup.metadata.annotations['crossplane.io/external-name'], `platform-prod-crossplane-${sample.name}-subnets`);
  assert.equal(securityGroup.spec.forProvider.name, `platform-prod-crossplane-${sample.name}-db`);
  for (const resource of [subnetGroup, securityGroup]) {
    assert.equal(resource.spec.forProvider.tags['crossplane-owner'], 'platform-prod');
  }
  for (const resource of resources.filter(r => ['Instance', 'Cluster', 'ClusterInstance'].includes(r.kind))) {
    const suffix = resource.kind === 'ClusterInstance' ? `-${resource.metadata.name.split('-').at(-1)}` : '';
    assert.equal(resource.metadata.annotations['crossplane.io/external-name'], `platform-prod-crossplane-${sample.name}${suffix}`);
  }
  for (const resource of resources.filter(r => ['Instance', 'Cluster'].includes(r.kind))) {
    assert.equal(resource.spec.forProvider.finalSnapshotIdentifier, `platform-prod-crossplane-${sample.name}-final`);
  }

  for (const resource of resources.filter(r => r.kind === 'Instance')) {
    assert.equal(resource.spec.forProvider.identifier, `platform-prod-crossplane-${sample.name}`);
  }
  const ingress = resources.find(r => r.kind === 'SecurityGroupRule').spec.forProvider;
  assert.equal(ingress.sourceSecurityGroupId, sample.clientSecurityGroupId);
  assert.equal(ingress.fromPort, 5432);
  assert.equal(ingress.toPort, 5432);
  assert.equal(resources.filter(r => r.kind === 'ClusterInstance').length, name.startsWith('aurora') ? 2 : 0);
  console.log(`${name}: ${resources.length} rendered resources passed${schemaFlag !== -1 ? ' provider schema validation' : ''}`);
}
