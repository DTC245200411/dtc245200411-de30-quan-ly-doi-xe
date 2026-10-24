'use strict';
const fs=require('node:fs');
module.exports=function log(event,fields={}) {
  const line=JSON.stringify({time:new Date().toISOString(),level:fields.level||'info',event,...fields})+'\n';
  process.stdout.write(line);
  try { fs.appendFileSync('/var/log/app/events.log',line); } catch { process.stderr.write('Application log file unavailable\n'); }
};
