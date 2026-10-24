'use strict';
// Automated browser regression/evidence capture. Secrets stay in memory.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.WORKSPACE_NODE_MODULES?path.join(process.env.WORKSPACE_NODE_MODULES,'playwright'):'playwright');
const root=process.env.FLEET_ROOT||path.resolve(__dirname,'..'),out=path.join(root,'docs/evidence');fs.mkdirSync(out,{recursive:true});
const secret=name=>fs.readFileSync(path.join(root,'.local/secrets',name),'utf8').trim();
const passwords=[secret('admin_password'),secret('pgadmin_password'),secret('grafana_password'),secret('db_migrate_password')];
const mode=process.argv[2]||'app';
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const files=[];
 async function shot(name,fullPage=true){await page.screenshot({path:path.join(out,name+'.png'),fullPage});files.push(name+'.png');}
 try{
  if(mode==='app'){
   await page.goto('http://localhost:8080/auth/login',{waitUntil:'domcontentloaded'});await shot('01-login');
   await page.getByLabel('Tên đăng nhập',{exact:true}).fill('admin');await page.getByLabel('Mật khẩu',{exact:true}).fill(passwords[0]);
   await Promise.all([page.waitForURL('http://localhost:8080/'),page.getByRole('button',{name:'Đăng nhập',exact:true}).click()]);
   for(const [url,name] of [['/','02-dashboard'],['/vehicles','03-vehicles'],['/drivers','04-drivers'],['/trips','05-trips'],['/maintenance','06-maintenance'],['/trips/new','07-trip-form'],['/maintenance/2','08-maintenance-detail']]){
    await page.goto('http://localhost:8080'+url,{waitUntil:'domcontentloaded'});
    if(await page.getByRole('heading',{name:'Hệ thống đang gặp lỗi'}).count())throw Error('Application error on '+url);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);if(overflow)throw Error('Desktop horizontal page overflow: '+url);
    await shot(name);
   }
   await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8080/',{waitUntil:'domcontentloaded'});
   await shot('09-mobile');if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)){const wide=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,overflow:getComputedStyle(e).overflowX})).slice(-12));throw Error('Mobile page overflow: '+JSON.stringify(wide));}
  }else if(mode==='monitoring'){
   await page.goto('http://localhost:9094/targets',{waitUntil:'domcontentloaded'});await page.getByText('lam-fleet',{exact:false}).first().waitFor();await shot('10-prometheus');
   await page.goto('http://localhost:3005/login',{waitUntil:'domcontentloaded'});
   await page.getByLabel('Email or username').fill('admin');await page.getByLabel('Password',{exact:true}).fill(passwords[2]);
   await page.getByRole('button',{name:'Log in',exact:true}).click();
   await page.waitForURL(url=>!url.pathname.includes('/login'));
   if(await page.getByRole('button',{name:'Skip',exact:true}).count())await page.getByRole('button',{name:'Skip',exact:true}).click();
   await page.goto('http://localhost:3005/d/lam-fleet-overview?from=now-30m&to=now&kiosk=tv',{waitUntil:'domcontentloaded'});
   await page.getByText('CPU container theo dịch vụ',{exact:true}).waitFor();
   await page.locator('[data-testid="data-testid Panel header Targets đang hoạt động"]').waitFor({state:'visible',timeout:15000}).catch(()=>{});
   await shot('11-grafana-metrics',false);
   await page.mouse.move(1200,800);await page.mouse.wheel(0,4000);const logs=page.getByText('Log điều phối và bảo dưỡng',{exact:true});await logs.waitFor({state:'visible',timeout:15000});await logs.scrollIntoViewIfNeeded();await page.getByText(/event.*(trip|maintenance)_(scheduled|started|completed)/).first().waitFor({state:'visible',timeout:45000});await shot('12-grafana-logs',false);
  }else if(mode==='pgadmin'){
   await page.goto('http://localhost:8091/login',{waitUntil:'domcontentloaded'});
   await page.locator('input[name="email"]').fill('admin@lam.edu.vn');await page.locator('input[name="password"]').fill(passwords[1]);
   await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL('**/browser/');
   await page.getByText('Servers',{exact:true}).first().dblclick();
   await page.getByText('Đề 30',{exact:true}).first().dblclick();
   await page.getByText('Lam Fleet PostgreSQL',{exact:true}).first().dblclick();
   const dbPassword=page.locator('input[type="password"]:visible');await dbPassword.waitFor({state:'visible',timeout:15000});await dbPassword.fill(passwords[3]);
   await page.getByText('OK',{exact:true}).last().click();
   await page.getByText('Databases',{exact:true}).first().waitFor({state:'visible',timeout:15000});await page.getByText('Databases',{exact:true}).first().dblclick();
   await page.getByText('fleet',{exact:true}).first().waitFor({state:'visible',timeout:15000});await page.getByText('fleet',{exact:true}).first().dblclick();await page.getByText('Schemas',{exact:true}).first().dblclick();await page.getByText('public',{exact:true}).first().dblclick();await page.getByText('Tables',{exact:true}).first().dblclick();await page.getByText('vehicles',{exact:true}).first().waitFor({state:'visible',timeout:15000});await shot('13-pgadmin');
  }
  if(errors.length&&mode==='app')throw Error('Browser errors: '+errors.join('; '));
  const summary={passed:true,mode,files,browserErrors:errors,capturedAt:new Date().toISOString()};fs.writeFileSync(path.join(out,'browser-'+mode+'.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }catch(e){await page.screenshot({path:path.join(root,'.local','browser-'+mode+'-error.png'),fullPage:true});if(mode!=='app')console.error((await page.locator('body').innerText()).slice(-3500));throw e;}finally{await browser.close();}
}
main().catch(e=>{let message=e.message;for(const value of passwords)message=message.split(value).join('[REDACTED]');console.error(message);process.exitCode=1;});
