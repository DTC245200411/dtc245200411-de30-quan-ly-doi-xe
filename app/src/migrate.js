'use strict';
const fs=require('node:fs');
const {pool,tx,secret}=require('./db');
const {hashPassword}=require('./security');
async function main(){
 const passwordHash=await hashPassword(secret('ADMIN_PASSWORD_FILE'));
 await tx(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(300411)');
  await c.query(fs.readFileSync('/app/db/schema.sql','utf8'));
  await c.query('INSERT INTO admins(username,password_hash) VALUES($1,$2) ON CONFLICT DO NOTHING',['admin',passwordHash]);
  if(!(await c.query('SELECT 1 FROM seed_versions WHERE version=1')).rowCount){
   const vehicles=[['XE-001','20A-100.01','Toyota Vios','Sedan',34200],['XE-002','20B-200.02','Ford Transit','Xe 16 chỗ',68250],['XE-003','20C-300.03','Hyundai Porter','Xe tải nhẹ',45200],['XE-004','20A-400.04','Mitsubishi Xpander','MPV',28750],['XE-005','20C-500.05','Isuzu QKR','Xe tải',83100],['XE-006','20A-600.06','Kia Carnival','MPV',19800],['XE-007','20B-700.07','Toyota Hiace','Xe 16 chỗ',91750],['XE-008','20C-800.08','Suzuki Carry','Xe tải nhẹ',142000]];
   const vids=[];
   for(let i=0;i<vehicles.length;i++)vids.push((await c.query('INSERT INTO vehicles(code,plate,name,type,odometer,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[...vehicles[i],i===7?'retired':'active','Dữ liệu minh họa phục vụ bài thực hành.'])).rows[0].id);
   const names=['Nguyễn Minh Anh','Trần Quốc Bảo','Lê Hoàng Nam','Phạm Đức Huy','Vũ Tuấn Kiệt','Đỗ Gia Khánh'],dids=[];
   for(let i=0;i<6;i++)dids.push((await c.query('INSERT INTO drivers(code,name,phone,license_no,status,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[`TX-00${i+1}`,names[i],`090000000${i+1}`,`DEMO-GPLX-00${i+1}`,i===5?'inactive':'active','Hồ sơ minh họa, không phải thông tin người thật.'])).rows[0].id);
   const routes=[['Thái Nguyên','Hà Nội'],['Sông Công','Bắc Ninh'],['Phổ Yên','Vĩnh Phúc'],['Thái Nguyên','Tuyên Quang'],['Thái Nguyên','Hà Nội'],['Thái Nguyên','Lạng Sơn'],['Phổ Yên','Bắc Giang'],['Thái Nguyên','Hải Phòng'],['Sông Công','Hà Nội'],['Thái Nguyên','Cao Bằng']];
   for(let i=0;i<10;i++){
    const v=i<4?i:i===4?1:i===5?0:i===6?2:i===7?3:i===8?4:5;
    const st=i<4?'completed':i===4?'in_progress':i===9?'cancelled':'planned';
    const day=i<4?i-5:i===4?0:i===5?1:i===6?2:i===7?3:i===8?1:-1;
    const start=i===4?"now()-interval '1 hour'":`CURRENT_DATE + interval '${day} day' + interval '${i===8?13:8} hour'`;
    const end=i===4?"now()+interval '2 hour'":`CURRENT_DATE + interval '${day} day' + interval '${i===8?17:12} hour'`;
    await c.query(`INSERT INTO trips(code,vehicle_id,driver_id,origin,destination,start_at,end_at,status,start_odometer,end_odometer,started_at,finished_at,notes) VALUES($1,$2,$3,$4,$5,${start},${end},$6,$7,$8,${['completed','in_progress'].includes(st)?start:'NULL'},${st==='completed'?end:st==='cancelled'?'now()':'NULL'},'Chuyến minh họa')`,[`LT-00${i+1}`,vids[v],dids[v],...routes[i],st,['completed','in_progress'].includes(st)?vehicles[v][4]-(st==='completed'?100:0):null,st==='completed'?vehicles[v][4]:null]);
   }
   const ms=[{v:7,day:-6,st:'completed',title:'Bảo dưỡng tổng thể trước khi ngừng sử dụng'},{v:6,day:0,st:'in_progress',title:'Thay dầu và kiểm tra hệ thống phanh'},{v:2,day:1,st:'planned',title:'Kiểm tra lốp và cân chỉnh thước lái'},{v:3,day:-1,st:'planned',title:'Bảo dưỡng định kỳ 30.000 km'},{v:5,day:5,st:'planned',title:'Kiểm tra điều hòa và lọc gió'}];
   for(let i=0;i<ms.length;i++){
    const m=ms[i],start=m.st==='in_progress'?"now()-interval '2 hour'":`CURRENT_DATE + interval '${m.day} day' + interval '8 hour'`,end=m.st==='in_progress'?"now()+interval '3 hour'":`CURRENT_DATE + interval '${m.day} day' + interval '12 hour'`;
    await c.query(`INSERT INTO maintenance(code,vehicle_id,title,start_at,end_at,status,provider,cost_vnd,odometer,result,started_at,finished_at) VALUES($1,$2,$3,${start},${end},$4,'Xưởng kỹ thuật Lam Fleet',$5,$6,$7,${m.st==='planned'?'NULL':start},${m.st==='completed'?end:'NULL'})`,[`BD-00${i+1}`,vids[m.v],m.title,m.st,m.st==='completed'?3500000:0,m.st==='completed'?vehicles[m.v][4]:null,m.st==='completed'?'Đã kiểm tra và lưu biên bản.':'']);
   }
   await c.query('INSERT INTO seed_versions(version) VALUES(1)');
  }
  await c.query(`GRANT SELECT ON admins,vehicles,drivers,trips,maintenance TO fleet_app;
   GRANT UPDATE(password_hash,auth_version) ON admins TO fleet_app;
   GRANT SELECT,INSERT,UPDATE,DELETE ON sessions TO fleet_app;
   GRANT INSERT,UPDATE ON vehicles,drivers,trips,maintenance TO fleet_app;
   GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO fleet_app;`);
 });
 console.log('Lam Fleet: schema, restricted privileges and seed ready.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
