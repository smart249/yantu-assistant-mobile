(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  function parseWeeks(value){
    let text=String(value??'').trim();
    if(['全周','全部','每周','-',''].includes(text))text='1-20';
    text=text.replace(/单双周/g,'').replace(/[第周()（）\s]/g,'').replace(/[，、;；]/g,',').replace(/[~～至—–]/g,'-');
    const out=new Set();
    for(const part of text.split(',')){
      const m=part.match(/^(\d+)(?:-(\d+))?([单双])?$/);
      if(!m)throw new Error('周次请填写 1-16、1-16单周 或 2,4,6');
      const lo=+m[1],hi=+(m[2]||m[1]);
      if(lo<1||hi>60||lo>hi)throw new Error('周次须在 1–60 之间，起始周不能晚于结束周');
      for(let w=lo;w<=hi;w++)if(!m[3]||w%2===(m[3]==='单'?1:0))out.add(w);
    }
    if(!out.size)throw new Error('该周次范围没有实际上课周');
    return [...out].sort((a,b)=>a-b);
  }
  function formatWeeks(values){
    const sorted=[...new Set(values)].sort((a,b)=>a-b),parts=[];
    for(let i=0;i<sorted.length;i++){let end=i;while(sorted[end+1]===sorted[end]+1)end++;parts.push(end===i?String(sorted[i]):sorted[i]+'-'+sorted[end]);i=end;}
    return parts.join(',');
  }
  function parseCourseText(text){
    const lines=String(text||'').split(/\r?\n/).filter(l=>l.trim()),rows=[],warnings=[];
    const days={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7};
    function content(raw){
      const week=raw.match(/第?\d+(?:\s*[-~至]\s*\d+)?(?:\s*[,，、]\s*\d+(?:\s*[-~至]\s*\d+)?)*\s*周(?:\s*[（(]?(?:单双周|单周|双周)[）)]?)?/);
      const parts=raw.replace(week?week[0]:'','').trim().split(/\s+/).filter(Boolean);
      if(!parts.length)throw new Error('缺少课程名称');
      const name=parts.shift();let teacher='',location='';
      if(parts.length&&/老师|教授|^[\u4e00-\u9fff·]{2,4}$/.test(parts[0])&&!/[楼室馆区]/.test(parts[0]))teacher=parts.shift();
      location=parts.join(' ');return {name,teacher,location,weeks:week?formatWeeks(parseWeeks(week[0])):'1-16'};
    }
    const separator=lines.some(l=>l.includes('\t'))?'\t':'|';
    const header=lines.findIndex(l=>l.includes(separator)&&l.split(separator).some(c=>/^(周|星期)[一二三四五六日天]$/.test(c.trim())));
    if(header>=0){
      const columns={};lines[header].split(separator).forEach((v,i)=>{const m=v.trim().match(/^(?:周|星期)([一二三四五六日天])$/);if(m)columns[i]=days[m[1]];});
      lines.slice(header+1).forEach((line,index)=>{const cells=line.split(separator);let slots=null;
        for(let i=0;i<cells.length;i++)if(!columns[i]){const m=cells[i].trim().match(/^第?\s*(\d+)(?:\s*[-~至,，]\s*(\d+))?\s*节?$/);if(m){slots=[+m[1],+(m[2]||m[1])];break;}}
        if(!slots){warnings.push('第 '+(header+index+2)+' 行：没有识别到节次');return;}
        for(const [col,day] of Object.entries(columns)){const raw=String(cells[col]||'').trim();if(!raw)continue;try{rows.push({...content(raw),day,start:slots[0],end:slots[1]});}catch(e){warnings.push('第 '+(header+index+2)+' 行：'+e.message);}}
      });
    }else lines.forEach((line,index)=>{try{const m=line.trim().match(/^(?:周|星期)([一二三四五六日天])\s*第?\s*(\d+)(?:\s*[-~至]\s*(\d+))?\s*节\s+(.+)$/);if(!m)throw new Error('请按“周一 1-2节 课程 教师 教室 1-16周”填写');rows.push({...content(m[4]),day:days[m[1]],start:+m[2],end:+(m[3]||m[2])});}catch(e){warnings.push('第 '+(index+1)+' 行：'+e.message);}});
    if(!rows.length&&!warnings.length)warnings.push('请先粘贴课表内容');return {rows,warnings};
  }
  function dateNumber(s){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw new Error('日期格式应为年-月-日');
    const ms=Date.parse(s+'T00:00:00Z');
    if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==s)throw new Error('日期不存在');
    return ms;
  }
  const dateAdd=(s,n)=>new Date(dateNumber(s)+n*86400000).toISOString().slice(0,10);
  const weekAt=(s,d)=>Math.floor((dateNumber(d)-dateNumber(s))/604800000)+1;
  function validateSemester(s){if(new Date(dateNumber(s)).getUTCDay()!==1)throw new Error('开学日期请选择校历第一周的周一');return s;}
  function defaultSchedule(){
    const starts=['08:15','08:55','09:55','10:35','11:20','13:20','14:00','15:00','15:40','16:35','17:15','18:10','18:50','19:35','20:20'];
    const af=starts.map((v,i)=>i===3?'10:40':v),de=starts.map((v,i)=>({2:'10:15',3:'10:55',4:'11:40'}[i]||v));
    return {lengths:40,starts,byBuilding:{A:[...af],B:[...starts],C:[...starts],D:[...de],E:[...de],F:[...af],J301:[...af],J302:[...starts],J303:[...de]}};
  }
  function validateSchedule(s){
    if(!s||!Number.isInteger(s.lengths)||s.lengths<30||s.lengths>120)throw new Error('每节课时长须为 30–120 分钟');
    function check(a,count){
      if(!Array.isArray(a)||!a.length||a.length>24||(count&&a.length!==count))throw new Error('作息须有 1–24 节，各楼节次数必须相同');
      let end=-1;
      for(const t of a){if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw new Error('作息时间格式不正确');const m=minutes(t);if(m<end||m+s.lengths>1440)throw new Error('作息时间有重叠或跨日，请核对');end=m+s.lengths;}
      return [...a];
    }
    const result={lengths:s.lengths,starts:check(s.starts),byBuilding:{}};
    if(s.byBuilding!=null){
      if(typeof s.byBuilding!=='object'||Array.isArray(s.byBuilding))throw new Error('分楼作息格式不正确');
      for(const [k,v] of Object.entries(s.byBuilding)){if(!/^(?:[A-F]|J30[123])$/.test(k))throw new Error('无法识别的楼宇：'+k);result.byBuilding[k]=check(v,result.starts.length);}
    }
    return result;
  }
  function building(location){
    const s=String(location||'').toUpperCase().replace(/\s/g,'');
    const room=s.match(/(?:^|[^A-Z0-9])(J30[123])(?=$|[^0-9])/);if(room)return room[1];
    const b=s.match(/(?:教学楼)?([A-F])(?:楼|[-－]?\d)/);return b?b[1]:'';
  }
  function timeRange(c,s){
    const times=s.byBuilding?.[building(c.location)]||s.starts;
    if(!times[c.start-1]||!times[c.end-1])throw new Error('课程节次超出了作息设置');
    return {start:times[c.start-1],end:clock(minutes(times[c.end-1])+s.lengths)};
  }
  function normalizeCourse(c,s){
    if(!c||typeof c.name!=='string'||!c.name.trim())throw new Error('课程名称不能为空');
    const day=Number(c.day),start=Number(c.start),end=Number(c.end??c.start);
    if(!Number.isInteger(day)||day<1||day>7||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>s.starts.length)throw new Error('星期或节次不正确');
    const weeks=formatWeeks(parseWeeks(c.weeks));
    return {id:typeof c.id==='string'&&c.id?c.id:uid(),name:c.name.trim().slice(0,160),teacher:String(c.teacher||'').slice(0,100),location:String(c.location||'').slice(0,150),day,start,end,weeks,note:String(c.note||'').slice(0,1000),color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:''};
  }
  function normalizePackage(data,current){
    if(Array.isArray(data))data={course:data};
    if(!data||typeof data!=='object'||!Array.isArray(data.course))throw new Error('请选择课表 JSON、原助手备份或 Excel 课表');
    if(data.course.length>3000)throw new Error('排课记录超过 3000 条，请分学期导入');
    const semesterStart=data.preserveSemesterStart?current.semesterStart:(data.semesterStart||data.meta?.semStart||current.semesterStart);
    validateSemester(semesterStart);
    const schedule=validateSchedule(data.schedule||data.meta?.schedule||current.schedule);
    const ids=new Set();
    const course=data.course.map((r,i)=>{try{const c=normalizeCourse(r,schedule);if(ids.has(c.id))c.id=uid();ids.add(c.id);return c;}catch(e){throw new Error('第 '+(i+1)+' 条排课：'+e.message);}});
    return {semesterStart,schedule,course};
  }
  const courseKey=c=>JSON.stringify([c.name.trim().toLowerCase(),c.day,c.start,c.end,parseWeeks(c.weeks).join(','),c.teacher.trim(),c.location.trim()]);
  function conflicts(c,rows,s){
    const weeks=new Set(parseWeeks(c.weeks)),a=timeRange(c,s);
    return rows.filter(r=>{if(r.id===c.id||r.day!==c.day||!parseWeeks(r.weeks).some(w=>weeks.has(w)))return false;const b=timeRange(r,s);return minutes(a.start)<minutes(b.end)&&minutes(b.start)<minutes(a.end);});
  }
  function analyzeImport(rows,existing,s){
    const known=new Set(existing.map(courseKey)),added=[],invalid=[];let duplicates=0;
    rows.forEach((raw,i)=>{try{const c=normalizeCourse(raw,s),key=courseKey(c);if(known.has(key)){duplicates++;return;}known.add(key);c.id=uid();added.push(c);}catch(e){invalid.push('第 '+(i+1)+' 条：'+e.message);}});
    const collision=[];const checked=[...existing];
    for(const c of added){for(const r of conflicts(c,checked,s))collision.push([c.name,r.name]);checked.push(c);}
    return {added,duplicates,invalid,conflicts:collision};
  }
  function moveOccurrence(rows,id,week,target,semester,s){
    const original=rows.find(c=>c.id===id);if(!original)throw new Error('找不到课程');
    const weeks=parseWeeks(original.weeks);if(!weeks.includes(week))throw new Error('所选原周次没有这门课');
    const targetWeek=weekAt(semester,target.date);if(targetWeek<1||targetWeek>60)throw new Error('目标日期须在本学期的 1–60 周内');
    const day=new Date(dateNumber(target.date)).getUTCDay()||7;
    const moved=normalizeCourse({...original,...target,id:uid(),day,weeks:String(targetWeek),note:'由第 '+week+' 周调课。'+(original.note||'')},s);
    const out=rows.filter(c=>c.id!==id);const remaining=weeks.filter(w=>w!==week);
    if(remaining.length)out.push({...original,weeks:formatWeeks(remaining)});
    out.push(moved);return out;
  }
  function addTemporaryCourse(rows,draft,date,semester,s,source){
    const targetWeek=weekAt(semester,date);
    if(targetWeek<1||targetWeek>60)throw new Error('上课日期须在本学期的 1–60 周内');
    const day=new Date(dateNumber(date)).getUTCDay()||7;
    const next=normalizeCourse({...draft,id:uid(),day,weeks:String(targetWeek)},s);
    if(source){
      const moved=moveOccurrence(rows,source.id,source.week,{...next,date},semester,s);
      moved[moved.length-1].note='由第 '+source.week+' 周调课。'+next.note;
      return moved;
    }
    return [...rows,next];
  }
  function buildIcs(rows,semester,s){
    const esc=t=>String(t||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kebiao//Timetable//ZH-CN','CALSCALE:GREGORIAN','X-WR-TIMEZONE:Asia/Shanghai','BEGIN:VTIMEZONE','TZID:Asia/Shanghai','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0800','TZOFFSETTO:+0800','TZNAME:CST','END:STANDARD','END:VTIMEZONE'];
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
    for(const c of rows){const range=timeRange(c,s);for(const week of parseWeeks(c.weeks)){
      const date=dateAdd(semester,(week-1)*7+c.day-1).replace(/-/g,'');
      lines.push('BEGIN:VEVENT','UID:'+esc(c.id)+'-'+week+'@kebiao.local','DTSTAMP:'+stamp,'DTSTART;TZID=Asia/Shanghai:'+date+'T'+range.start.replace(':','')+'00','DTEND;TZID=Asia/Shanghai:'+date+'T'+range.end.replace(':','')+'00','SUMMARY:'+esc(c.name),'LOCATION:'+esc(c.location),'DESCRIPTION:'+esc([c.teacher,'第 '+week+' 周',c.note].filter(Boolean).join('\n')),'END:VEVENT');
    }}
    lines.push('END:VCALENDAR');
    // RFC 5545: fold at 75 UTF-8 octets without splitting a character.
    return lines.map(line=>{let out='',width=0;for(const char of line){const len=new TextEncoder().encode(char).length;if(width+len>75){out+='\r\n ';width=1;}out+=char;width+=len;}return out;}).join('\r\n')+'\r\n';
  }
  const api={clone,uid,minutes,clock,parseWeeks,formatWeeks,parseCourseText,dateNumber,dateAdd,weekAt,validateSemester,defaultSchedule,validateSchedule,building,timeRange,normalizeCourse,normalizePackage,courseKey,conflicts,analyzeImport,moveOccurrence,addTemporaryCourse,buildIcs};
  root.TimetableCore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
