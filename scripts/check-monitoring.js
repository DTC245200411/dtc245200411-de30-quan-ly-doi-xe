'use strict';
const assert=require('node:assert/strict');
async function get(path){const r=await fetch('http://prometheus:9090'+path,{signal:AbortSignal.timeout(10000)});assert.ok(r.ok,'Prometheus HTTP '+r.status);return r.json();}
async function query(expr){const data=await get('/api/v1/query?query='+encodeURIComponent(expr));assert.equal(data.status,'success');return data.data.result;}
(async()=>{
 const targets=(await get('/api/v1/targets')).data.activeTargets;assert.equal(targets.length,5);for(const t of targets)assert.equal(t.health,'up',t.labels.job+': '+t.lastError);
 for(const metric of ['nginx_up','pg_up'])assert.ok((await query(metric)).some(r=>Number(r.value[1])===1),metric);
 const services={};
 for(const service of ['app','nginx','postgres']){
  const labels=`container_label_com_docker_compose_project="de30lam",container_label_com_docker_compose_service="${service}"`;
  const ram=await query(`container_memory_working_set_bytes{${labels}}`),cpu=await query(`rate(container_cpu_usage_seconds_total{${labels}}[2m])`);
  assert.ok(ram.some(r=>Number(r.value[1])>0),'Missing real RAM '+service);assert.ok(cpu.some(r=>Number.isFinite(Number(r.value[1]))),'Missing real CPU '+service);
  services[service]={ram_bytes:Number(ram[0].value[1]),cpu_cores:Number(cpu[0].value[1])};
 }
 const vehicles=Number((await query('sum(lam_fleet_vehicles_by_status)'))[0]?.value[1]);assert.equal(vehicles,8);
 assert.ok((await query('pg_stat_database_numbackends{datname="fleet"}')).length);
 assert.ok((await fetch('http://grafana:3000/api/health')).ok);
 console.log(JSON.stringify({passed:true,targets:targets.map(t=>({job:t.labels.job,health:t.health})),services,vehicles,grafana:'healthy'},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
