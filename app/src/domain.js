'use strict';
const {pool,tx}=require('./db');
class UserError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const states={planned:'Dự kiến',in_progress:'Đang thực hiện',completed:'Hoàn tất',cancelled:'Đã hủy'};
function text(value,label,max=120,optional=false){const s=String(value??'').trim();if((!optional&&!s)||s.length>max)throw new UserError(`${label} cần ${optional?'tối đa':'1–'}${max} ký tự.`);return s;}
function integer(value,label='Số',max=1000000000){if(!/^\d+$/.test(String(value)))throw new UserError(`${label} phải là số nguyên không âm.`);const n=Number(value);if(!Number.isSafeInteger(n)||n>max)throw new UserError(`${label} vượt giới hạn.`);return n;}
function id(value){const n=integer(value,'Mã định danh',2147483647);if(!n)throw new UserError('Mã định danh không hợp lệ.');return n;}
function code(value){const s=text(value,'Mã',32).toUpperCase();if(!/^[A-Z0-9][A-Z0-9_-]*$/.test(s))throw new UserError('Mã chỉ gồm chữ không dấu, số, gạch ngang hoặc gạch dưới.');return s;}
function timestamp(value){
  const s=String(value||'');
  // datetime-local form values are explicitly interpreted as Vietnamese local time.
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+]07:00)?$/.test(s))throw new UserError('Ngày giờ không hợp lệ.');
  const zone=/(Z|[+]07:00)$/.test(s)?'':'+07:00',d=new Date(s+zone);
  if(!Number.isFinite(d.getTime()))throw new UserError('Ngày giờ không hợp lệ.');
  const parts=s.slice(0,16),roundtrip=zone||s.endsWith('+07:00')?new Date(d.getTime()+7*3600000).toISOString().slice(0,16):d.toISOString().slice(0,16);
  if(parts!==roundtrip)throw new UserError('Ngày giờ không tồn tại.');
  return d.toISOString();
}
function interval(body){const start=timestamp(body.start_at),end=timestamp(body.end_at);if(end<=start)throw new UserError('Giờ kết thúc phải sau giờ bắt đầu.');return {start,end};}
function status(value,allowed){if(!allowed.includes(value))throw new UserError('Trạng thái không hợp lệ.');return value;}
function versionCheck(row,body){if(id(body.version)!==row.version)throw new UserError('Dữ liệu đã được thay đổi ở phiên khác. Hãy tải lại trang.',409);}
async function lock(c,table,ids){const unique=[...new Set(ids)].sort((a,b)=>a-b);const rows=(await c.query(`SELECT * FROM ${table} WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE`,[unique])).rows;if(rows.length!==unique.length)throw new UserError('Xe hoặc tài xế không còn tồn tại.',404);return rows;}
async function saveVehicle(body,recordId){
 const v={code:code(body.code),plate:text(body.plate,'Biển số',20).toUpperCase().replace(/\s/g,''),name:text(body.name,'Tên xe'),type:text(body.type,'Loại xe',80),odometer:integer(body.odometer,'Số kilomet'),status:status(body.status,['active','retired']),notes:text(body.notes,'Ghi chú',2000,true)};
 if(!/^[A-Z0-9.-]{5,20}$/.test(v.plate))throw new UserError('Biển số cần 5–20 ký tự chữ, số, dấu chấm hoặc gạch ngang.');
 return tx(async c=>{
  if(recordId){const old=(await lock(c,'vehicles',[id(recordId)]))[0];versionCheck(old,body);if(v.odometer<old.odometer)throw new UserError('Số kilomet không được giảm.');
   const running=await c.query(`SELECT 1 FROM trips WHERE vehicle_id=$1 AND status='in_progress' UNION ALL SELECT 1 FROM maintenance WHERE vehicle_id=$1 AND status='in_progress'`,[old.id]);
   if(running.rowCount&&v.odometer!==old.odometer)throw new UserError('Chỉ cập nhật kilomet khi hoàn tất công việc đang thực hiện.',409);
   if(v.status==='retired'){const open=await c.query(`SELECT 1 FROM trips WHERE vehicle_id=$1 AND status IN ('planned','in_progress') UNION ALL SELECT 1 FROM maintenance WHERE vehicle_id=$1 AND status IN ('planned','in_progress')`,[old.id]);if(open.rowCount)throw new UserError('Xe còn chuyến hoặc lịch bảo dưỡng mở, chưa thể ngừng sử dụng.',409);}
   await c.query('UPDATE vehicles SET code=$1,plate=$2,name=$3,type=$4,odometer=$5,status=$6,notes=$7,version=version+1 WHERE id=$8',[...Object.values(v),old.id]);return old.id;
  }
  return (await c.query('INSERT INTO vehicles(code,plate,name,type,odometer,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',Object.values(v))).rows[0].id;
 });
}
async function saveDriver(body,recordId){
 const v={code:code(body.code),name:text(body.name,'Họ tên'),phone:text(body.phone,'Điện thoại',20),license_no:text(body.license_no,'Giấy phép',32).toUpperCase(),status:status(body.status,['active','inactive']),notes:text(body.notes,'Ghi chú',2000,true)};
 if(!/^[+0-9 .()-]{8,20}$/.test(v.phone))throw new UserError('Số điện thoại chưa đúng định dạng.');
 return tx(async c=>{
  if(recordId){const old=(await lock(c,'drivers',[id(recordId)]))[0];versionCheck(old,body);if(v.status==='inactive'&&(await c.query("SELECT 1 FROM trips WHERE driver_id=$1 AND status IN ('planned','in_progress')",[old.id])).rowCount)throw new UserError('Tài xế còn lịch mở, chưa thể ngừng hoạt động.',409);
   await c.query('UPDATE drivers SET code=$1,name=$2,phone=$3,license_no=$4,status=$5,notes=$6,version=version+1 WHERE id=$7',[...Object.values(v),old.id]);return old.id;}
  return (await c.query('INSERT INTO drivers(code,name,phone,license_no,status,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',Object.values(v))).rows[0].id;
 });
}
async function conflict(c,vehicleId,driverId,start,end,excludeTable='',excludeId=0){
 const trips=await c.query(`SELECT 1 FROM trips WHERE status IN ('planned','in_progress') AND (vehicle_id=$1 OR driver_id=$2) AND start_at<$4 AND end_at>$3 AND NOT ($5='trips' AND id=$6) LIMIT 1`,[vehicleId,driverId||null,start,end,excludeTable,excludeId]);
 const maintenance=await c.query(`SELECT 1 FROM maintenance WHERE status IN ('planned','in_progress') AND vehicle_id=$1 AND start_at<$3 AND end_at>$2 AND NOT ($4='maintenance' AND id=$5) LIMIT 1`,[vehicleId,start,end,excludeTable,excludeId]);
 if(trips.rowCount||maintenance.rowCount)throw new UserError('Xe hoặc tài xế đã có lịch trùng khoảng thời gian này.',409);
}
async function saveBooking(kind,body,recordId){
 const table=kind==='trip'?'trips':'maintenance',vehicleId=id(body.vehicle_id),driverId=kind==='trip'?id(body.driver_id):null;
 const range=interval(body),bookingCode=code(body.code);
 const fields=kind==='trip'?{origin:text(body.origin,'Điểm đi',160),destination:text(body.destination,'Điểm đến',160),notes:text(body.notes,'Ghi chú',2000,true)}:{title:text(body.title,'Nội dung bảo dưỡng',160),provider:text(body.provider,'Đơn vị bảo dưỡng',160,true)};
 return tx(async c=>{
  const snapshot=recordId?(await c.query(`SELECT * FROM ${table} WHERE id=$1`,[id(recordId)])).rows[0]:null;
  if(recordId&&!snapshot)throw new UserError('Không tìm thấy lịch.',404);
  // Every booking mutation acquires vehicles, then drivers, then the booking row.
  const vehicles=await lock(c,'vehicles',[vehicleId,...(snapshot?[snapshot.vehicle_id]:[])]);
  const drivers=driverId?await lock(c,'drivers',[driverId,...(snapshot?[snapshot.driver_id]:[])]):[];
  if(vehicles.find(v=>v.id===vehicleId).status!=='active'||drivers.some(d=>d.id===driverId&&d.status!=='active'))throw new UserError('Chỉ xếp lịch cho xe và tài xế đang hoạt động.',409);
  if(snapshot){const fresh=(await c.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[snapshot.id])).rows[0];versionCheck(fresh,body);if(fresh.vehicle_id!==snapshot.vehicle_id||fresh.driver_id!==snapshot.driver_id||fresh.status!=='planned')throw new UserError('Lịch đã thay đổi hoặc đã bắt đầu, không thể sửa.',409);}
  await conflict(c,vehicleId,driverId,range.start,range.end,table,snapshot?.id||0);
  if(kind==='trip'){
   const values=[bookingCode,vehicleId,driverId,fields.origin,fields.destination,range.start,range.end,fields.notes];
   if(snapshot){await c.query('UPDATE trips SET code=$1,vehicle_id=$2,driver_id=$3,origin=$4,destination=$5,start_at=$6,end_at=$7,notes=$8,version=version+1 WHERE id=$9',[...values,snapshot.id]);return snapshot.id;}
   return (await c.query('INSERT INTO trips(code,vehicle_id,driver_id,origin,destination,start_at,end_at,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',values)).rows[0].id;
  }
  const values=[bookingCode,vehicleId,fields.title,range.start,range.end,fields.provider];
  if(snapshot){await c.query('UPDATE maintenance SET code=$1,vehicle_id=$2,title=$3,start_at=$4,end_at=$5,provider=$6,version=version+1 WHERE id=$7',[...values,snapshot.id]);return snapshot.id;}
  return (await c.query('INSERT INTO maintenance(code,vehicle_id,title,start_at,end_at,provider) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',values)).rows[0].id;
 });
}
async function transition(kind,recordId,action,body={}){
 const table=kind==='trip'?'trips':'maintenance';recordId=id(recordId);
 if(!['start','complete','cancel'].includes(action))throw new UserError('Thao tác không hợp lệ.');
 return tx(async c=>{
  const snapshot=(await c.query(`SELECT * FROM ${table} WHERE id=$1`,[recordId])).rows[0];if(!snapshot)throw new UserError('Không tìm thấy lịch.',404);
  const vehicle=(await lock(c,'vehicles',[snapshot.vehicle_id]))[0];
  const driver=kind==='trip'?(await lock(c,'drivers',[snapshot.driver_id]))[0]:null;
  const row=(await c.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[recordId])).rows[0];
  if(row.vehicle_id!==snapshot.vehicle_id||row.driver_id!==snapshot.driver_id)throw new UserError('Lịch vừa thay đổi. Hãy tải lại trang.',409);
  versionCheck(row,body);
  if(action==='start'){
   if(row.status!=='planned')throw new UserError('Chỉ bắt đầu được lịch dự kiến.',409);
   if(vehicle.status!=='active'||driver&&driver.status!=='active')throw new UserError('Xe hoặc tài xế không còn hoạt động.',409);
   const busy=await c.query(`SELECT 1 FROM trips WHERE status='in_progress' AND (vehicle_id=$1 OR driver_id=$2) UNION ALL SELECT 1 FROM maintenance WHERE status='in_progress' AND vehicle_id=$1`,[vehicle.id,driver?.id||null]);
   if(busy.rowCount)throw new UserError('Xe hoặc tài xế đang thực hiện công việc khác. Cần hoàn tất trước.',409);
   await conflict(c,vehicle.id,driver?.id,row.start_at,row.end_at,table,row.id);
   await c.query(`UPDATE ${table} SET status='in_progress',started_at=now(),version=version+1${kind==='trip'?',start_odometer=$2':''} WHERE id=$1`,kind==='trip'?[row.id,vehicle.odometer]:[row.id]);
  }else if(action==='cancel'){
   if(row.status!=='planned')throw new UserError('Chỉ hủy được lịch chưa bắt đầu.',409);
   await c.query(`UPDATE ${table} SET status='cancelled',finished_at=now(),version=version+1 WHERE id=$1`,[row.id]);
  }else{
   if(row.status!=='in_progress')throw new UserError('Chỉ hoàn tất được công việc đang thực hiện.',409);
   const odometer=integer(body.odometer,'Số kilomet');if(odometer<vehicle.odometer||kind==='trip'&&odometer<row.start_odometer)throw new UserError('Số kilomet kết thúc không được giảm.');
   if(kind==='trip')await c.query("UPDATE trips SET status='completed',end_odometer=$2,finished_at=now(),version=version+1 WHERE id=$1",[row.id,odometer]);
   else await c.query("UPDATE maintenance SET status='completed',odometer=$2,cost_vnd=$3,result=$4,finished_at=now(),version=version+1 WHERE id=$1",[row.id,odometer,integer(body.cost_vnd,'Chi phí',99999999999999),text(body.result,'Kết quả',2000)]);
   await c.query('UPDATE vehicles SET odometer=$2,version=version+1 WHERE id=$1',[vehicle.id,odometer]);
  }
  return row.id;
 });
}
module.exports={UserError,states,text,integer,id,code,timestamp,interval,saveVehicle,saveDriver,saveBooking,transition};
