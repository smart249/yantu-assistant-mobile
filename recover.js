(()=>{
 'use strict';
 const button=document.querySelector('#restore'),summary=document.querySelector('#summary'),status=document.querySelector('#status');
 const fragment=location.hash;
 // The recovery payload stays in the fragment and browser memory; it is never sent to the host.
 try{history.replaceState(null,'',location.pathname);}catch{}
 let incoming;
 try{
  if(!fragment.startsWith('#data='))throw Error('请从聊天中打开专属课表恢复链接。');
  incoming=CourseRecovery.decode(fragment.slice(6));
  summary.textContent='可恢复 '+incoming.course.length+' 条课程，开学日期为 '+incoming.semesterStart+'。';
  button.disabled=false;
 }catch(error){summary.textContent='暂时无法恢复';status.textContent=error.message;}
 button.onclick=()=>{
  button.disabled=true;
  try{CourseRecovery.restore(localStorage,incoming);status.textContent='课表已恢复，正在打开首页…';location.replace('./');}
  catch(error){status.textContent=error.message;button.disabled=false;}
 };
})();
