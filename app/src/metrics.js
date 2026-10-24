'use strict';
const client=require('prom-client');
const {pool}=require('./db');
const registry=new client.Registry();
client.collectDefaultMetrics({register:registry,prefix:'lam_'});
const requests=new client.Counter({name:'lam_http_requests_total',help:'HTTP responses by route',labelNames:['method','route','status_code'],registers:[registry]});
const latency=new client.Histogram({name:'lam_http_request_duration_seconds',help:'HTTP latency',labelNames:['method','route'],buckets:[.005,.01,.025,.05,.1,.25,.5,1,2,5],registers:[registry]});
const actions=new client.Counter({name:'lam_fleet_actions_total',help:'Successful fleet workflow transitions',labelNames:['kind','action'],registers:[registry]});
const conflicts=new client.Counter({name:'lam_fleet_conflicts_total',help:'Rejected conflicting business requests',registers:[registry]});
for(const [table,name] of [['vehicles','vehicles'],['trips','trips'],['maintenance','maintenance']])new client.Gauge({name:`lam_fleet_${name}_by_status`,help:`Persisted ${table} by status`,labelNames:['status'],registers:[registry],async collect(){
 const rows=(await pool.query(`SELECT status,count(*)::int n FROM ${table} GROUP BY status`)).rows;this.reset();for(const state of table==='vehicles'?['active','retired']:['planned','in_progress','completed','cancelled'])this.set({status:state},rows.find(r=>r.status===state)?.n||0);
}});
function observe(req,res,next){const start=performance.now();res.on('finish',()=>{if(['/metrics','/healthz','/readyz'].includes(req.path))return;const route=String(req.route?.path||'unmatched');requests.inc({method:req.method,route,status_code:String(res.statusCode)});latency.observe({method:req.method,route},(performance.now()-start)/1000);});next();}
module.exports={registry,observe,actions,conflicts};
