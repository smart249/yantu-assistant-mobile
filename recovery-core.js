(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else root.CourseRecovery=factory(root.TimetableCore);
})(globalThis,function(C){
 'use strict';
 const key='timetable_standalone_v1',backupKey='timetable_course_before_import_v1';
 function decode(value){
  if(typeof value!=='string'||!value.length||value.length>160000||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('恢复链接不完整，请重新打开聊天中的完整链接。');
  const base64=value.replace(/-/g,'+').replace(/_/g,'/');
  const bytes=Uint8Array.from(atob(base64+'='.repeat((4-base64.length%4)%4)),c=>c.charCodeAt(0));
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(data?.v!==1||!Array.isArray(data.r)||!data.r.length||data.r.length>1000)throw Error('这不是有效的课表恢复链接。');
  const course=data.r.map(row=>{
   if(!Array.isArray(row)||row.length!==7)throw Error('课程信息不完整。');
   return {name:row[0],teacher:row[1],location:row[2],day:row[3],start:row[4],end:row[5],weeks:row[6]};
  });
  return C.normalizePackage({semesterStart:data.s,schedule:data.schedule||C.defaultSchedule(),course},{semesterStart:'2026-09-14',schedule:C.defaultSchedule()});
 }
 function restore(storage,incoming){
  const next=C.normalizePackage(incoming,{semesterStart:'2026-09-14',schedule:C.defaultSchedule()});
  if(!next.course.length)throw Error('恢复课表不能为空。');
  const before=storage.getItem(key);
  if(before!==null){
   let current;
   try{current=JSON.parse(before);}catch{throw Error('当前课表无法读取，请先在首页导出原始数据。');}
   if(!current||!Array.isArray(current.course))throw Error('当前课表格式无法识别，请先在首页导出原始数据。');
   if(current.course.length)throw Error('这个浏览器里已经有课表，已保留现有内容。请返回首页查看，或使用“导入课表”选择合并。');
   C.normalizePackage(current,next);
   storage.setItem(backupKey,before);
   if(storage.getItem(backupKey)!==before)throw Error('导入前备份未能保存，原课表已保留。');
  }
  if(storage.getItem(key)!==before)throw Error('课表在其他窗口发生了变化，请返回首页查看。');
  const raw=JSON.stringify(next);
  storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)throw Error('写入未能确认，请返回首页检查。');
  return next.course.length;
 }
 return {key,backupKey,decode,restore};
});
