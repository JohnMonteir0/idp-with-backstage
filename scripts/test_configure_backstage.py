"""Validate GitOps updates without touching repository deployment settings."""
import copy
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
import yaml

spec = importlib.util.spec_from_file_location('configure', Path(__file__).with_name('configure-backstage.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ROOT = Path(__file__).resolve().parents[1]


class ConfigureTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        shutil.copytree(ROOT / 'manifests/backstage', self.root / 'manifests/backstage')
        self.env = {
            'AWS_ACCOUNT_ID': '123456789012', 'BACKSTAGE_ENVIRONMENT': 'prod',
            'IMAGE': '123456789012.dkr.ecr.us-east-1.amazonaws.com/backstage@sha256:' + 'a' * 64,
            'CLOUDFLARE_PROXIED': 'false',
        }

    def test_consistent_hostname_and_image(self):
        module.configure(self.root, self.env)
        directory = self.root / 'manifests/backstage'
        ingress = yaml.safe_load((directory / 'ingress.yaml').read_text())
        hostname = 'backstage-prod.123456789012.montlabz.com'
        self.assertEqual(ingress['spec']['ingressClassName'], 'cilium')
        self.assertEqual(ingress['spec']['rules'][0]['host'], hostname)
        self.assertNotIn('tls', ingress['spec'])
        self.assertEqual(ingress['metadata']['annotations']['ingress.cilium.io/force-https'], 'disabled')
        self.assertEqual(ingress['metadata']['annotations']['ingress.cilium.io/backend-service-port'], 'http')
        for prefix in ('external-dns.alpha.kubernetes.io', 'external-dns.kubernetes.io'):
            self.assertEqual(ingress['metadata']['annotations'][prefix + '/hostname'], hostname)
        deployment = yaml.safe_load((directory / 'backstage-deployment.yaml').read_text())
        container = deployment['spec']['template']['spec']['containers'][0]
        self.assertEqual(container['image'], self.env['IMAGE'])
        self.assertIn({'name': 'BACKSTAGE_BASE_URL', 'value': 'http://' + hostname}, container['env'])
        before = (directory / 'backstage-deployment.yaml').read_text()
        module.configure(self.root, self.env)
        self.assertEqual((directory / 'backstage-deployment.yaml').read_text(), before)

    def test_invalid_inputs_do_not_write(self):
        path = self.root / 'manifests/backstage/backstage-deployment.yaml'
        before = path.read_text()
        for field, invalid in [('AWS_ACCOUNT_ID', 'bad'), ('BACKSTAGE_ENVIRONMENT', '../prod'),
                               ('IMAGE', 'untrusted/image:latest'),
                               ('CLOUDFLARE_PROXIED', 'yes')]:
            env = copy.copy(self.env)
            env[field] = invalid
            with self.subTest(field=field), self.assertRaises(ValueError):
                module.configure(self.root, env)
            self.assertEqual(path.read_text(), before)


if __name__ == '__main__':
    unittest.main()
