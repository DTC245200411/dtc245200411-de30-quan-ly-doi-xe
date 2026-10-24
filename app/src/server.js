'use strict';
const express=require('express'),session=require('express-session'),PgStore=require('connect-pg-simple')(session),{rateLimit}=require('express-rate-limit'),crypto=require('node:crypto'),path=require('node:path');
const {pool,secret}=require('./db'),{verifyPassword,hashPassword,csrf}=require('./security'),d=require('./domain'),metrics=require('./metrics'),log=require('./logger');
const app=express();app.locals.icon=require('./icons');app.disable('x-powered-by');app.set('trust proxy',1);app.set('view engine','ejs');app.set('views',path.join(__dirname,'../views'));
app.use((req,res,next)=>{req.id=crypto.randomUUID();res.set('X-Request-ID',req.id);const start=performance.now();res.on('finish',()=>{if(!['/healthz','/readyz','/metrics'].includes(req.path))log('http_request',{request_id:req.id,method:req.method,path:req.path,status:res.statusCode,duration_ms:Math.round(performance.now()-start)});});next();});
app.use(metrics.observe);
app.get('/metrics',async(req,res)=>res.type(metrics.registry.contentType).send(await metrics.registry.metrics()));
app.get('/healthz',(req,res)=>res.json({status:'ok'}));
app.get('/readyz',async(req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable'});}});
app.use(express.static(path.join(__dirname,'../public'),{maxAge:'1h',index:false}));
app.use(express.urlencoded({extended:false,limit:'24kb',parameterLimit:30}));
app.use(session({store:new PgStore({pool,tableName:'sessions',createTableIfMissing:false}),name:'lam.fleet.sid',secret:secret('SESSION_SECRET_FILE'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:8*3600000}}));
app.use((req,res,next)=>{
 Object.assign(res.locals,{user:req.session.user||null,path:req.path,states:d.states,flash:req.session.flash||null,
  money:v=>Number(v||0).toLocaleString('vi-VN')+' ₫',number:v=>Number(v||0).toLocaleString('vi-VN'),
  date:v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—',
  local:v=>v?new Date(new Date(v).getTime()+7*3600000).toISOString().slice(0,16):'',
  initials:name=>String(name).split(' ').slice(-2).map(p=>p[0]).join('').toUpperCase()});delete req.session.flash;next();
});
app.use(csrf);
const limiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,handler:(req,res)=>res.status(429).render('error',{title:'Tạm giới hạn đăng nhập',message:'Vui lòng thử lại sau 15 phút.'})});
app.get('/auth/login',(req,res)=>req.session.user?res.redirect('/'):res.render('login',{title:'Đăng nhập',error:null}));
app.post('/auth/login',limiter,async(req,res)=>{
 const admin=(await pool.query('SELECT * FROM admins WHERE username=$1',[String(req.body.username||'').slice(0,40)])).rows[0];
 if(!admin||!await verifyPassword(String(req.body.password||'').slice(0,256),admin.password_hash)){log('login_failed',{request_id:req.id});return res.status(401).render('login',{title:'Đăng nhập',error:'Tên đăng nhập hoặc mật khẩu chưa đúng.'});}
 await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.user={id:admin.id,username:admin.username,version:admin.auth_version};log('login_success',{admin_id:admin.id,request_id:req.id});
 req.session.save(e=>e?res.status(500).end('Không thể lưu phiên.'):res.redirect(303,'/'));
});
app.use(async(req,res,next)=>{if(!req.session.user)return res.redirect('/auth/login');const row=(await pool.query('SELECT auth_version FROM admins WHERE id=$1',[req.session.user.id])).rows[0];if(!row||row.auth_version!==req.session.user.version)return req.session.destroy(()=>res.redirect('/auth/login'));next();});
app.post('/auth/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('lam.fleet.sid');res.redirect(303,'/auth/login');}));
app.get('/auth/password',(req,res)=>res.render('password',{title:'Đổi mật khẩu'}));
app.post('/auth/password',limiter,async(req,res)=>{
 const password=String(req.body.password||'');if(password.length<12||password.length>128||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password))throw new d.UserError('Mật khẩu cần 12–128 ký tự, có chữ hoa, chữ thường và chữ số.');if(password!==req.body.confirm)throw new d.UserError('Xác nhận mật khẩu chưa khớp.');
 const row=(await pool.query('SELECT password_hash FROM admins WHERE id=$1',[req.session.user.id])).rows[0];if(!await verifyPassword(String(req.body.current||''),row.password_hash))throw new d.UserError('Mật khẩu hiện tại chưa đúng.');
 await pool.query('UPDATE admins SET password_hash=$1,auth_version=auth_version+1 WHERE id=$2',[await hashPassword(password),req.session.user.id]);log('password_changed',{admin_id:req.session.user.id});req.session.destroy(()=>{res.clearCookie('lam.fleet.sid');res.redirect(303,'/auth/login');});
});
const vehicleSelect=`SELECT v.*,CASE WHEN v.status='retired' THEN 'retired' WHEN EXISTS(SELECT 1 FROM maintenance m WHERE m.vehicle_id=v.id AND m.status='in_progress') THEN 'maintenance' WHEN EXISTS(SELECT 1 FROM trips t WHERE t.vehicle_id=v.id AND t.status='in_progress') THEN 'on_trip' ELSE 'available' END operating FROM vehicles v`;
const bookingSelect=kind=>kind==='trip'?`SELECT b.*,v.plate,v.name vehicle_name,v.odometer current_odometer,d.name driver_name FROM trips b JOIN vehicles v ON v.id=b.vehicle_id JOIN drivers d ON d.id=b.driver_id`:`SELECT b.*,v.plate,v.name vehicle_name,v.odometer current_odometer FROM maintenance b JOIN vehicles v ON v.id=b.vehicle_id`;
async function choices(){return {vehicles:(await pool.query("SELECT * FROM vehicles WHERE status='active' ORDER BY code")).rows,drivers:(await pool.query("SELECT * FROM drivers WHERE status='active' ORDER BY code")).rows};}
async function getRecord(table,recordId){const row=(await pool.query(`SELECT * FROM ${table} WHERE id=$1`,[d.id(recordId)])).rows[0];if(!row)throw new d.UserError('Không tìm thấy dữ liệu.',404);return row;}
function done(req,res,event,url,message,fields={}){log(event,{...fields,request_id:req.id});req.session.flash=message;res.redirect(303,url);}
app.get('/',async(req,res)=>{
 const vehicles=(await pool.query(vehicleSelect+' ORDER BY v.code')).rows;
 const trips=(await pool.query(bookingSelect('trip')+" WHERE b.status IN ('planned','in_progress') ORDER BY CASE WHEN b.status='in_progress' THEN 0 ELSE 1 END,b.start_at LIMIT 5")).rows;
 const due=(await pool.query(bookingSelect('maintenance')+" WHERE b.status IN ('planned','in_progress') ORDER BY b.start_at LIMIT 4")).rows;
 const stats=(await pool.query("SELECT (SELECT count(*) FROM drivers WHERE status='active')::int drivers,(SELECT count(*) FROM trips WHERE status='completed')::int completed,(SELECT COALESCE(sum(cost_vnd),0) FROM maintenance WHERE status='completed') cost")).rows[0];
 const counts={total:vehicles.length,available:vehicles.filter(v=>v.operating==='available').length,on_trip:vehicles.filter(v=>v.operating==='on_trip').length,maintenance:vehicles.filter(v=>v.operating==='maintenance').length};
 res.render('dashboard',{title:'Tổng quan',vehicles,trips,due,stats,counts,now:new Date()});
});
for(const [resource,save] of [['vehicles',d.saveVehicle],['drivers',d.saveDriver]]){
 const isVehicle=resource==='vehicles',label=isVehicle?'Xe':'Tài xế';
 app.get('/'+resource,async(req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,120),state=String(req.query.status||'');if(state&&!['active',isVehicle?'retired':'inactive'].includes(state))throw new d.UserError('Bộ lọc không hợp lệ.');
  const params=[q?'%'+q+'%':'',state],columns=isVehicle?'v.code ILIKE $1 OR v.plate ILIKE $1 OR v.name ILIKE $1':'code ILIKE $1 OR name ILIKE $1 OR license_no ILIKE $1';
  const sql=isVehicle?vehicleSelect:'SELECT * FROM drivers';const prefix=isVehicle?'v.':'';
  const rows=(await pool.query(sql+` WHERE ($1='' OR ${columns}) AND ($2='' OR ${prefix}status=$2) ORDER BY ${prefix}code`,params)).rows;
  res.render(resource,{title:isVehicle?'Đội xe':'Tài xế',rows,q,state});
 });
 app.get('/'+resource+'/new',async(req,res)=>res.render('resource-form',{title:'Thêm '+label.toLowerCase(),resource,record:{status:'active',odometer:0}}));
 app.post('/'+resource,async(req,res)=>{const recordId=await save(req.body);done(req,res,resource+'_created','/'+resource+'/'+recordId,'Đã thêm '+label.toLowerCase()+'.',{record_id:recordId});});
 app.get('/'+resource+'/:id/edit',async(req,res)=>res.render('resource-form',{title:'Cập nhật '+label.toLowerCase(),resource,record:await getRecord(resource,req.params.id)}));
 app.post('/'+resource+'/:id',async(req,res)=>{const recordId=await save(req.body,req.params.id);done(req,res,resource+'_updated','/'+resource+'/'+recordId,'Đã lưu thay đổi.',{record_id:recordId});});
 app.get('/'+resource+'/:id',async(req,res)=>{
  const record=await getRecord(resource,req.params.id),trips=(await pool.query(bookingSelect('trip')+` WHERE b.${isVehicle?'vehicle_id':'driver_id'}=$1 ORDER BY b.start_at DESC`,[record.id])).rows;
  const maintenance=isVehicle?(await pool.query(bookingSelect('maintenance')+' WHERE b.vehicle_id=$1 ORDER BY b.start_at DESC',[record.id])).rows:[];
  res.render('resource-detail',{title:record.name,resource,record,trips,maintenance});
 });
}
for(const [resource,kind] of [['trips','trip'],['maintenance','maintenance']]){
 const label=kind==='trip'?'chuyến đi':'bảo dưỡng';
 app.get('/'+resource,async(req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,120),state=String(req.query.status||'');if(state&&!Object.hasOwn(d.states,state))throw new d.UserError('Bộ lọc không hợp lệ.');
  const search=kind==='trip'?'b.origin ILIKE $1 OR b.destination ILIKE $1 OR d.name ILIKE $1':'b.title ILIKE $1';
  const rows=(await pool.query(bookingSelect(kind)+` WHERE ($1='' OR b.code ILIKE $1 OR v.plate ILIKE $1 OR ${search}) AND ($2='' OR b.status=$2) ORDER BY CASE b.status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END,b.start_at DESC`,[q?'%'+q+'%':'',state])).rows;
  res.render('bookings',{title:kind==='trip'?'Lịch trình':'Bảo dưỡng',resource,kind,rows,q,state,now:new Date()});
 });
 app.get('/'+resource+'/new',async(req,res)=>res.render('booking-form',{title:'Lập lịch '+label,resource,kind,record:{},...await choices()}));
 app.post('/'+resource,async(req,res)=>{const recordId=await d.saveBooking(kind,req.body);done(req,res,kind+'_scheduled','/'+resource+'/'+recordId,'Đã lập lịch '+label+'.',{record_id:recordId});});
 app.get('/'+resource+'/:id/edit',async(req,res)=>{const record=await getRecord(resource,req.params.id);if(record.status!=='planned')throw new d.UserError('Chỉ sửa được lịch dự kiến.',409);res.render('booking-form',{title:'Điều chỉnh lịch '+label,resource,kind,record,...await choices()});});
 app.post('/'+resource+'/:id',async(req,res)=>{const recordId=await d.saveBooking(kind,req.body,req.params.id);done(req,res,kind+'_updated','/'+resource+'/'+recordId,'Đã cập nhật lịch.',{record_id:recordId});});
 app.get('/'+resource+'/:id',async(req,res)=>{const record=(await pool.query(bookingSelect(kind)+' WHERE b.id=$1',[d.id(req.params.id)])).rows[0];if(!record)throw new d.UserError('Không tìm thấy lịch.',404);res.render('booking-detail',{title:record.code,resource,kind,record});});
 app.post('/'+resource+'/:id/:action',async(req,res)=>{await d.transition(kind,req.params.id,req.params.action,req.body);metrics.actions.inc({kind,action:req.params.action});done(req,res,kind+'_'+{start:'started',complete:'completed',cancel:'cancelled'}[req.params.action],'/'+resource+'/'+req.params.id,'Đã cập nhật trạng thái.',{record_id:Number(req.params.id)});});
}
app.use((req,res)=>res.status(404).render('error',{title:'Không tìm thấy trang',message:'Đường dẫn bạn truy cập không tồn tại.'}));
app.use((err,req,res,next)=>{
 if(res.headersSent)return next(err);
 Object.assign(res.locals,{user:req.session?.user||null,path:req.path,csrf:req.session?.csrf||''});let status=err.status||500,message=err.message;
 if(err.code==='23505'){status=409;message='Mã, biển số hoặc giấy phép đã tồn tại.';}if(err.code==='23503'){status=400;message='Xe hoặc tài xế không tồn tại. Hãy tải lại trang.';}if(err.code==='23514'){status=400;message='Dữ liệu chưa phù hợp với quy tắc hệ thống.';}
 if(status===409)metrics.conflicts.inc();log(status>=500?'application_error':'request_rejected',{level:status>=500?'error':'warn',status,request_id:req.id,...(status>=500?{code:err.code||'internal'}:{})});
 res.status(status).render('error',{title:status>=500?'Hệ thống đang gặp lỗi':'Chưa thể thực hiện',message:status>=500?'Vui lòng thử lại. Mã tra cứu: '+req.id:message});
});
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>log('application_started'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>pool.end().then(()=>process.exit(0))));
