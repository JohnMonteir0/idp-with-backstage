"""Set the image and consistent portal/DNS hostname. Run from the repo root."""
import os
import re
from pathlib import Path
import yaml


def configure(root, env):
    def required(name, pattern):
        value = env.get(name, '')
        if not re.fullmatch(pattern, value):
            raise ValueError(f'Invalid or missing {name}')
        return value

    account = required('AWS_ACCOUNT_ID', r'\d{12}')
    environment = required('BACKSTAGE_ENVIRONMENT', r'[a-z0-9]+(?:-[a-z0-9]+)*')
    hostname = f'backstage-{environment}.{account}.montlabz.com'
    if len(hostname.split('.')[0]) > 63:
        raise ValueError('Environment produces a DNS label longer than 63 characters')
    image = required('IMAGE', rf'{account}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9/_.-]+@sha256:[a-f0-9]{{64}}')
    proxied = env.get('CLOUDFLARE_PROXIED', 'false')
    if proxied not in ('true', 'false'):
        raise ValueError('Invalid CLOUDFLARE_PROXIED')
    directory = Path(root) / 'manifests/backstage'
    deployment_path = directory / 'backstage-deployment.yaml'
    deployment = yaml.safe_load(deployment_path.read_text())
    container = next(c for c in deployment['spec']['template']['spec']['containers'] if c['name'] == 'backstage')
    container['image'] = image
    container['env'] = [v for v in container.get('env', []) if v['name'] != 'BACKSTAGE_BASE_URL']
    container['env'].append({'name': 'BACKSTAGE_BASE_URL', 'value': f'http://{hostname}'})
    ingress_path = directory / 'ingress.yaml'
    ingress = yaml.safe_load(ingress_path.read_text())
    annotations = ingress['metadata']['annotations']
    for prefix in ('external-dns.alpha.kubernetes.io', 'external-dns.kubernetes.io'):
        annotations[f'{prefix}/hostname'] = hostname
        annotations[f'{prefix}/cloudflare-proxied'] = proxied
    ingress['spec']['rules'][0]['host'] = hostname
    ingress['spec'].pop('tls', None)
    deployment_path.write_text(yaml.safe_dump(deployment, sort_keys=False))
    ingress_path.write_text(yaml.safe_dump(ingress, sort_keys=False))
    print(f'Configured {hostname} with {image}')


if __name__ == '__main__':
    configure('.', os.environ)
