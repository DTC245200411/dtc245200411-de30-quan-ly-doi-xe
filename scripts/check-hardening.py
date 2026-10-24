import json, os, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parent.parent
args=['docker','compose','-f','compose.yaml','-f','compose.monitoring.yaml','-f','compose.logging.yaml']
def container(service):
    cid=subprocess.check_output([*args,'ps','-q',service],cwd=root,text=True).strip()
    assert cid, service+' not running'
    return json.loads(subprocess.check_output(['docker','inspect',cid],text=True))[0]
for name in ['app','nginx']:
    c=container(name)
    assert c['Config']['User'] not in ['', '0', 'root','0:0'], name+' runs as root'
    assert c['HostConfig']['ReadonlyRootfs'], name+' writable root filesystem'
    assert 'ALL' in c['HostConfig']['CapDrop'], name+' capabilities not dropped'
    assert any('no-new-privileges' in x for x in c['HostConfig']['SecurityOpt']), name+' privilege escalation allowed'
for name in ['app','postgres','loki','promtail','nginx-exporter','postgres-exporter','cadvisor']:
    assert not container(name)['HostConfig']['PortBindings'], name+' publishes an internal port'
for name in ['nginx','pgadmin','grafana','prometheus']:
    for bindings in container(name)['HostConfig']['PortBindings'].values():
        for b in bindings: assert b['HostIp']=='127.0.0.1', name+' has a non-localhost binding'
assert set(container('postgres')['NetworkSettings']['Networks'])=={'de30lam_database'}
assert all(m['RW'] is False for m in container('promtail')['Mounts'] if m['Destination'].startswith('/var/log/'))
assert os.stat(root/'.local').st_mode & 0o777 == 0o700
assert os.stat(root/'.local/secrets').st_mode & 0o777 == 0o700
tracked=subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
assert not any(x.startswith('.local/') or x=='.env' for x in tracked)
print('PASS: app/nginx non-root, read-only, dropped capabilities, no-new-privileges; internal ports isolated; public ports bound to localhost; PostgreSQL network isolated; Promtail log mounts read-only; secret directory 0700; runtime files ignored by Git.')
print('Documented exceptions: storage init uses temporary root capabilities; PostgreSQL bootstrap starts root then switches user; cAdvisor is privileged and can access the host Docker socket.')
