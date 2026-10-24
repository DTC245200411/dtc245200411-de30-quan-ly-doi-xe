'use strict';
const assert=require('node:assert/strict');
const queries=["{job=\"nginx\", project=\"de30lam\"} | json | status >= 400", "{job=\"app\", project=\"de30lam\"} | json | event=~\"(trip|maintenance)_(scheduled|started|completed|cancelled)\"", "{job=\"postgres\", project=\"de30lam\"} | json | error_severity=~\"ERROR|FATAL|PANIC\""];
(async()=>{
 const results=[];
 for(let i=0;i<queries.length;i++){
  const params=new URLSearchParams({query:queries[i],since:'1h',limit:'20',direction:'backward'});
  const r=await fetch('http://loki:3100/loki/api/v1/query_range?'+params,{signal:AbortSignal.timeout(15000)});assert.ok(r.ok,'LogQL '+(i+1)+' HTTP '+r.status);const data=await r.json();assert.equal(data.status,'success');const events=data.data.result.reduce((n,s)=>n+s.values.length,0);assert.ok(events>0,'LogQL '+(i+1)+' has no events; run test/demo and wait for Promtail.');results.push({query:queries[i],events});
 }
 console.log(JSON.stringify({passed:true,results},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
